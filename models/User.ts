import mongoose, { Schema, models, model } from "mongoose";
import type { Role, UserStatus } from "@/types";

export interface UserDocument {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  phone: string;
  email?: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  resetToken?: string;
  resetTokenExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["CLIENT", "ADMIN"], default: "CLIENT" },
    status: { type: String, enum: ["ACTIVE", "BLOCKED"], default: "ACTIVE" },
    resetToken: String,
    resetTokenExpiresAt: Date,
  },
  { timestamps: true }
);

export const User = models.User || model<UserDocument>("User", UserSchema);
