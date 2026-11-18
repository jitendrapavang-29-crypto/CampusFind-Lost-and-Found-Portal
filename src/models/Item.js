const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, required: true, enum: ["Electronics", "ID & Cards", "Bags", "Books", "Clothing", "Accessories", "Other"] },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  location: { type: String, required: true, trim: true, maxlength: 120 },
  date: { type: Date, required: true },
  type: { type: String, enum: ["lost", "found"], required: true },
  imageUrl: { type: String, default: "" },
  status: { type: String, enum: ["open", "claimed", "closed"], default: "open" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

itemSchema.index({ title: "text", description: "text", location: "text" });
module.exports = mongoose.model("Item", itemSchema);
