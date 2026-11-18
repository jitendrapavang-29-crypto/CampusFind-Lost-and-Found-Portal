require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./src/models/User");
const Item = require("./src/models/Item");
const Claim = require("./src/models/Claim");

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI. Copy .env.example to .env and configure MongoDB.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  await Claim.deleteMany({});
  await Item.deleteMany({});
  await User.deleteMany({});
  const admin = await User.create({
    name: "Campus Administrator",
    email: "admin@campusfind.demo",
    password: await bcrypt.hash("Admin12345!", 12),
    role: "admin"
  });
  const student = await User.create({
    name: "Demo Student",
    email: "student@campusfind.demo",
    password: await bcrypt.hash("Student12345!", 12)
  });
  const samples = [
    ["Black wireless earbuds","Electronics","Black charging case with a small scratch on the lid.","Library", "found"],
    ["Blue university notebook","Books","A5 notebook with handwritten lecture notes.","Block A - Classroom 204","lost"],
    ["Grey laptop backpack","Bags","Grey backpack with two front pockets.","Cafeteria","lost"],
    ["Student ID card","ID & Cards","Card found near the main entrance.","Main Gate","found"],
    ["Silver water bottle","Accessories","Metal bottle with a blue sticker.","Sports Complex","lost"],
    ["USB-C charger","Electronics","White 65W charger left near a power socket.","Computer Lab 2","found"],
    ["Black umbrella","Accessories","Foldable umbrella with a curved handle.","Auditorium","lost"],
    ["Red hoodie","Clothing","Medium size red hoodie.","Library Lobby","found"],
    ["Calculus textbook","Books","Mathematics textbook with a name label inside.","Block B","lost"],
    ["Keychain with two keys","Other","Two keys attached to a round green keychain.","Parking Area","found"]
  ];
  await Item.insertMany(samples.map((s, i) => ({
    title:s[0], category:s[1], description:s[2], location:s[3],
    type:s[4], date:new Date(Date.now() - i * 86400000),
    createdBy:i % 2 ? student._id : admin._id
  })));
  console.log("Seed complete. Admin: admin@campusfind.demo / Admin12345! | Student: student@campusfind.demo / Student12345!");
  await mongoose.disconnect();
}
seed().catch(err => { console.error(err); process.exit(1); });
