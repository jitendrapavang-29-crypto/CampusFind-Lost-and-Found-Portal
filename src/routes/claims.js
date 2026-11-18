const router = require("express").Router();
const { body, param, validationResult } = require("express-validator");
const Claim = require("../models/Claim");
const Item = require("../models/Item");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.post("/", requireAuth, body("itemId").isMongoId(), body("message").trim().isLength({ min: 5, max: 1000 }), async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  try {
    const item = await Item.findById(req.body.itemId);
    if (!item || item.status !== "open") return res.status(404).json({ message: "This item is not available for claims." });
    if (item.createdBy.toString() === String(req.session.user.id)) return res.status(400).json({ message: "You cannot claim your own listing." });
    const claim = await Claim.create({ item: item._id, claimant: req.session.user.id, message: req.body.message });
    res.status(201).json({ message: "Claim submitted for review.", claim });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "You have already submitted a claim for this item." });
    next(err);
  }
});

router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const claims = await Claim.find({ claimant: req.session.user.id }).populate("item").sort({ createdAt: -1 });
    res.json({ claims });
  } catch (err) { next(err); }
});

router.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const claims = await Claim.find().populate("item").populate("claimant", "name email").sort({ createdAt: -1 });
    res.json({ claims });
  } catch (err) { next(err); }
});

router.patch("/:id", requireAuth, requireAdmin, param("id").isMongoId(), body("status").isIn(["approved", "rejected"]), async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: "Claim not found." });
    claim.status = req.body.status;
    await claim.save();
    if (claim.status === "approved") {
      await Item.findByIdAndUpdate(claim.item, { status: "claimed" });
      await Claim.updateMany({ item: claim.item, _id: { $ne: claim._id }, status: "pending" }, { status: "rejected" });
    }
    res.json({ message: `Claim ${claim.status}.`, claim });
  } catch (err) { next(err); }
});

module.exports = router;
