import mongoose, { Schema, models, model } from "mongoose";
import type { TableStatus } from "@/types";

export interface TableDocument {
  _id: mongoose.Types.ObjectId;
  number: number;
  name: string;
  zone?: string;
  deviceId?: string;
  status: TableStatus;
  expectedBallCount: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<TableDocument>(
  {
    number: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    zone: { type: String, default: "Main" },
    deviceId: { type: String },
    status: {
      type: String,
      enum: ["AVAILABLE", "RESERVED", "ACTIVE", "RETURN_REQUIRED", "MAINTENANCE", "OFFLINE"],
      default: "AVAILABLE",
    },
    expectedBallCount: { type: Number, default: 8 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Table = models.Table || model<TableDocument>("Table", TableSchema);
