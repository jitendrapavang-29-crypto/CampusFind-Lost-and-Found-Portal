const router = require("express").Router();
const { param, validationResult } = require("express-validator");
const User = require("../models/User");
const Item = require("../models/Item");
const Claim = require("../models/Claim");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.use(requireAuth, requireAdmin);

router.get("/stats", async (_req, res, next) => {
  try {
    const [users, items, openItems, claims, pendingClaims, recovered] = await Promise.all([
      User.countDocuments(), Item.countDocuments(), Item.countDocuments({ status: "open" }),
      Claim.countDocuments(), Claim.countDocuments({ status: "pending" }), Item.countDocuments({ status: "claimed" })
    ]);
    res.json({ users, items, openItems, claims, pendingClaims, recovered });
  } catch (err) { next(err); }
});

router.get("/items", async (_req, res, next) => {
  try { res.json({ items: await Item.find().populate("createdBy", "name email").sort({ createdAt: -1 }) }); }
  catch (err) { next(err); }
});

router.patch("/items/:id/status", param("id").isMongoId(), async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  try {
    if (!["open", "claimed", "closed"].includes(req.body.status)) return res.status(400).json({ message: "Invalid item status." });
    const item = await Item.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!item) return res.status(404).json({ message: "Item not found." });
    res.json({ item });
  } catch (err) { next(err); }
});

module.exports = router;
