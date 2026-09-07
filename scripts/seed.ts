import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

async function seed() {
  loadEnv();
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed production.");
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  await mongoose.connect(uri);

  const email = process.env.SEED_ADMIN_EMAIL || "admin@smartbilliard.mn";
  const phone = "88001100";
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin123!";
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await User.findOneAndUpdate(
    { $or: [{ email }, { phone }, { role: "ADMIN" }] },
    {
      fullName: "Club Admin",
      phone,
      email,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("Seed complete. Admin only.");
  console.log("Email:", admin.email);
  console.log("Phone:", admin.phone);
  console.log("Password:", password);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
