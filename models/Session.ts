import mongoose, { Schema, models, model } from "mongoose";
import type { SessionStatus } from "@/types";

export interface SessionDocument {
  _id: mongoose.Types.ObjectId;
  sessionCode: string;
  userId: mongoose.Types.ObjectId;
  tableId: mongoose.Types.ObjectId;
  deviceId: string;
  status: SessionStatus;
  startedAt?: Date;
  expiresAt?: Date;
  completedAt?: Date;
  purchasedMinutes: number;
  totalAmount: number;
  expectedBallCount: number;
  returnedBallCount: number;
  returnRequiredAt?: Date;
  alarmTriggeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<SessionDocument>(
  {
    sessionCode: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tableId: { type: Schema.Types.ObjectId, ref: "Table", required: true },
    deviceId: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "ACTIVE",
        "EXTENDED",
        "RETURN_REQUIRED",
        "BALLS_MISSING",
        "COMPLETED",
        "CANCELLED",
        "FAILED",
      ],
      default: "PENDING_PAYMENT",
    },
    startedAt: Date,
    expiresAt: Date,
    completedAt: Date,
    purchasedMinutes: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    expectedBallCount: { type: Number, required: true },
    returnedBallCount: { type: Number, default: 0 },
    returnRequiredAt: Date,
    alarmTriggeredAt: Date,
  },
  { timestamps: true }
);

SessionSchema.index({ userId: 1, createdAt: -1 });
SessionSchema.index({ tableId: 1, status: 1 });
SessionSchema.index({ status: 1, expiresAt: 1 });

export const Session = models.Session || model<SessionDocument>("Session", SessionSchema);
