import mongoose, { Schema, models, model } from "mongoose";
import type { ExtensionSource } from "@/types";

export interface SessionExtensionDocument {
  _id: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  addedMinutes: number;
  amount: number;
  paymentId?: mongoose.Types.ObjectId;
  source: ExtensionSource;
  adminId?: mongoose.Types.ObjectId;
  reason?: string;
  createdAt: Date;
}

const SessionExtensionSchema = new Schema<SessionExtensionDocument>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    addedMinutes: { type: Number, required: true },
    amount: { type: Number, default: 0 },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    source: { type: String, enum: ["CLIENT", "ADMIN"], required: true },
    adminId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const SessionExtension =
  models.SessionExtension ||
  model<SessionExtensionDocument>("SessionExtension", SessionExtensionSchema);
