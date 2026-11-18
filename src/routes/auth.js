const router = require("express").Router();
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  next();
}

router.post("/register",
  body("name").trim().isLength({ min: 2, max: 80 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 8 }),
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
      if (await User.findOne({ email })) return res.status(409).json({ message: "An account with this email already exists." });
      const user = await User.create({ name, email, password: await bcrypt.hash(password, 12) });
      req.session.regenerate(err => {
        if (err) return next(err);
        req.session.user = { id: String(user._id), name: user.name, email: user.email, role: user.role };
        res.status(201).json({ message: "Registration successful", user: req.session.user });
      });
    } catch (err) { next(err); }
  }
);

const loginValidation = [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
  validate
];

async function login(req, res, next, adminOnly) {
  try {
    const user = await User.findOne({ email: req.body.email }).select("+password");
    if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    if (adminOnly && user.role !== "admin") {
      return res.status(403).json({ message: "Administrator account required." });
    }
    req.session.regenerate(err => {
      if (err) return next(err);
      req.session.user = { id: String(user._id), name: user.name, email: user.email, role: user.role };
      res.json({ message: "Login successful", user: req.session.user });
    });
  } catch (err) { next(err); }
}

router.post("/login", ...loginValidation, (req, res, next) => login(req, res, next, false));
router.post("/admin/login", ...loginValidation, (req, res, next) => login(req, res, next, true));

router.post("/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: "Could not log out." });
    res.clearCookie("campus.sid");
    res.json({ message: "Logged out successfully." });
  });
});

router.get("/me", (req, res) => res.json({ user: req.session.user || null }));
router.patch("/profile", requireAuth, body("name").isString().trim().isLength({ min: 2, max: 80 }), validate, async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.session.user.id, { name: req.body.name }, { new: true });
    if (!user) return res.status(404).json({ message: "User not found." });
    req.session.user.name = user.name;
    res.json({ message: "Profile updated.", user: req.session.user });
  } catch (err) { next(err); }
});

module.exports = router;
