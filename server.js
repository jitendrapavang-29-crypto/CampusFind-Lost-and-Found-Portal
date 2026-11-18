require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const authRoutes = require("./src/routes/auth");
const itemRoutes = require("./src/routes/items");
const claimRoutes = require("./src/routes/claims");
const adminRoutes = require("./src/routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);

app.use(session({
  name: "campus.sid",
  secret: process.env.SESSION_SECRET || "development_only_change_me",
  resave: false,
  saveUninitialized: false,
  store: process.env.MONGODB_URI ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI }) : undefined,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "Campus Lost and Found API" }));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, req, res, _next) => {
  console.error(err);
  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({ message: err.message || "Invalid request data." });
  }
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

async function start() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI. Copy .env.example to .env and configure MongoDB.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: "campus_lost_found"
});
console.log("Connected Database:", mongoose.connection.name);
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

if (require.main === module) {
  start().catch(err => { console.error("Startup failed:", err.message); process.exit(1); });
}

module.exports = app;
