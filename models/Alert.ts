import mongoose, { Schema, models, model } from "mongoose";
import type { AlertSeverity, AlertStatus, AlertType } from "@/types";

export interface AlertDocument {
  _id: mongoose.Types.ObjectId;
  type: AlertType;
  severity: AlertSeverity;
  deviceId?: string;
  tableId?: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  message: string;
  status: AlertStatus;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: mongoose.Types.ObjectId;
}

const AlertSchema = new Schema<AlertDocument>(
  {
    type: {
      type: String,
      enum: [
        "DEVICE_OFFLINE",
        "BALL_MISSING",
        "PAYMENT_FAILED",
        "BOX_ERROR",
        "SENSOR_ERROR",
        "SESSION_OVERDUE",
        "ALARM_ACTIVE",
      ],
      required: true,
    },
    severity: { type: String, enum: ["INFO", "WARNING", "CRITICAL"], default: "WARNING" },
    deviceId: String,
    tableId: { type: Schema.Types.ObjectId, ref: "Table" },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    message: { type: String, required: true },
    status: { type: String, enum: ["OPEN", "ACKNOWLEDGED", "RESOLVED"], default: "OPEN" },
    metadata: { type: Schema.Types.Mixed },
    resolvedAt: Date,
    acknowledgedAt: Date,
    acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

AlertSchema.index({ status: 1, createdAt: -1 });
AlertSchema.index({ type: 1, status: 1, deviceId: 1 });

export const Alert = models.Alert || model<AlertDocument>("Alert", AlertSchema);
