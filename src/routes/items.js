const router = require("express").Router();
const { body, param, query, validationResult } = require("express-validator");
const multer = require("multer");
const sharp = require("sharp");
const convertHeic = require("heic-convert");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const Item = require("../models/Item");
const Claim = require("../models/Claim");
const { requireAuth } = require("../middleware/auth");

const CATEGORIES = ["Electronics", "ID & Cards", "Bags", "Books", "Clothing", "Accessories", "Other"];
const uploadDirectory = path.join(__dirname, "..", "..", "public", "uploads");
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
}).single("image");

function parseImageUpload(req, res, next) {
  imageUpload(req, res, (error) => {
    if (!error) return next();
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : error.status || 400;
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Image must be 5 MB or smaller."
      : error.message;
    res.status(status).json({ message });
  });
}

async function saveUploadedImage(file) {
  let optimizedImage;
  try {
    const isHeif = file.buffer.toString("ascii", 4, 8) === "ftyp" &&
      ["heic", "heix", "hevc", "hevx", "heif", "mif1", "msf1"].includes(file.buffer.toString("ascii", 8, 12));
    const imageBuffer = isHeif
      ? await convertHeic({ buffer: file.buffer, format: "JPEG", quality: 0.9 })
      : file.buffer;
    const image = sharp(imageBuffer, { limitInputPixels: 25_000_000 });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp", "tiff", "gif", "heif"].includes(metadata.format)) {
      const error = new Error("Unsupported image format.");
      error.status = 400;
      throw error;
    }
    optimizedImage = await image
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch (error) {
    if (error.status) throw error;
    const invalidImage = new Error("The selected file is not a valid supported image.");
    invalidImage.status = 400;
    throw invalidImage;
  }

  await fs.mkdir(uploadDirectory, { recursive: true });
  const fileName = `${randomUUID()}.jpg`;
  await fs.writeFile(path.join(uploadDirectory, fileName), optimizedImage, { flag: "wx" });
  return `/uploads/${fileName}`;
}

async function removeUploadedImage(imageUrl) {
  const prefix = "/uploads/";
  if (!imageUrl || !imageUrl.startsWith(prefix)) return;
  const fileName = imageUrl.slice(prefix.length);
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}\.jpg$/i.test(fileName)) return;
  try {
    await fs.unlink(path.join(uploadDirectory, fileName));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  next();
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/",
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
  query("q").optional().isString().isLength({ max: 100 }),
  query("location").optional().isString().isLength({ max: 120 }),
  query("category").optional({ values: "falsy" }).isIn(CATEGORIES),
  query("type").optional({ values: "falsy" }).isIn(["lost", "found"]),
  query("sort").optional({ values: "falsy" }).isIn(["newest", "oldest"]),
  query("status").optional({ values: "falsy" }).isIn(["open", "claimed", "closed", "all"]),
  validate,
  async (req, res, next) => {
    try {
      const { q, category, location, type, sort = "newest", status = "open" } = req.query;
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 12);
      const filter = {};
      if (status !== "all") filter.status = status;
      if (category) filter.category = category;
      if (type) filter.type = type;
      if (location) filter.location = { $regex: escapeRegex(location), $options: "i" };
      if (q) filter.$or = [
        { title: { $regex: escapeRegex(q), $options: "i" } },
        { description: { $regex: escapeRegex(q), $options: "i" } },
        { location: { $regex: escapeRegex(q), $options: "i" } }
      ];
      const [count, items] = await Promise.all([
        Item.countDocuments(filter),
        Item.find(filter)
          .populate("createdBy", "name")
          .sort(sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
      ]);
      res.json({ count, page, pages: Math.ceil(count / limit), limit, items });
    } catch (err) { next(err); }
  }
);

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const items = await Item.find({ createdBy: req.session.user.id }).sort({ createdAt: -1 });
    const claims = await Claim.find({ claimant: req.session.user.id }).populate({ path: "item", select: "title type status" }).sort({ createdAt: -1 });
    res.json({ items, claims });
  } catch (err) { next(err); }
});

router.get("/:id", param("id").isMongoId(), validate, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id).populate("createdBy", "name");
    if (!item) return res.status(404).json({ message: "Item not found." });
    res.json({ item });
  } catch (err) { next(err); }
});

router.post("/", requireAuth, parseImageUpload,
  body("title").trim().isLength({ min: 2, max: 100 }),
  body("category").isIn(CATEGORIES),
  body("description").trim().isLength({ min: 5, max: 1000 }),
  body("location").trim().isLength({ min: 2, max: 120 }),
  body("date").isISO8601(),
  body("type").isIn(["lost", "found"]),
  body("imageUrl").optional({ values: "falsy" }).isURL({ protocols: ["http", "https"], require_protocol: true }),
  validate,
  async (req, res, next) => {
    let imageUrl = req.body.imageUrl || "";
    try {
      if (req.file) imageUrl = await saveUploadedImage(req.file);
      const item = await Item.create({
        title: req.body.title,
        category: req.body.category,
        description: req.body.description,
        location: req.body.location,
        date: req.body.date,
        type: req.body.type,
        imageUrl,
        status: "open",
        createdBy: req.session.user.id
      });
      res.status(201).json({ message: "Item reported successfully.", item });
    } catch (err) {
      if (imageUrl.startsWith("/uploads/")) {
        try {
          await removeUploadedImage(imageUrl);
        } catch (cleanupError) {
          console.error("Could not remove unused uploaded image:", cleanupError);
        }
      }
      next(err);
    }
  }
);

router.patch("/:id", requireAuth,
  param("id").isMongoId(),
  body("title").optional().trim().isLength({ min: 2, max: 100 }),
  body("category").optional().isIn(CATEGORIES),
  body("description").optional().trim().isLength({ min: 5, max: 1000 }),
  body("location").optional().trim().isLength({ min: 2, max: 120 }),
  body("date").optional().isISO8601(),
  body("type").optional().isIn(["lost", "found"]),
  body("imageUrl").optional({ values: "falsy" }).isURL({ protocols: ["http", "https"], require_protocol: true }),
  body("status").optional().isIn(["open", "claimed", "closed"]),
  validate,
  async (req, res, next) => {
    try {
      const item = await Item.findById(req.params.id);
      if (!item) return res.status(404).json({ message: "Item not found." });
      const isOwner = item.createdBy.toString() === String(req.session.user.id);
      const isAdmin = req.session.user.role === "admin";
      if (!isOwner && !isAdmin) return res.status(403).json({ message: "You cannot edit this listing." });
      const oldImageUrl = item.imageUrl;
      const allowed = ["title", "category", "description", "location", "date", "type", "imageUrl", "status"];
      allowed.forEach(key => { if (req.body[key] !== undefined) item[key] = req.body[key]; });
      await item.save();
      if (req.body.imageUrl !== undefined && oldImageUrl && oldImageUrl !== item.imageUrl) {
        try {
          await removeUploadedImage(oldImageUrl);
        } catch (cleanupError) {
          console.error("Could not remove replaced image:", cleanupError);
        }
      }
      res.json({ message: "Listing updated.", item });
    } catch (err) { next(err); }
  }
);

router.delete("/:id", requireAuth, param("id").isMongoId(), validate, async (req, res, next) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found." });
    if (item.createdBy.toString() !== String(req.session.user.id) && req.session.user.role !== "admin") {
      return res.status(403).json({ message: "You cannot delete this listing." });
    }
    await Claim.deleteMany({ item: item._id });
    await item.deleteOne();
    try {
      await removeUploadedImage(item.imageUrl);
    } catch (err) {
      console.error("Could not remove deleted listing image:", err);
    }
    res.json({ message: "Listing deleted." });
  } catch (err) { next(err); }
});

module.exports = router;
