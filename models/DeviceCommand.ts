import mongoose, { Schema, models, model } from "mongoose";
import type { CommandStatus, IotCommand } from "@/types";

export interface DeviceCommandDocument {
  _id: mongoose.Types.ObjectId;
  commandId: string;
  deviceId: string;
  command: IotCommand;
  duration?: number;
  status: CommandStatus;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  executeAfter?: Date;
  sentAt?: Date;
  executedAt?: Date;
  createdAt: Date;
}

const DeviceCommandSchema = new Schema<DeviceCommandDocument>(
  {
    commandId: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true, index: true },
    command: {
      type: String,
      enum: ["OPEN_BOX", "CLOSE_BOX", "START_ALARM", "STOP_ALARM", "PING", "RESET", "STATUS"],
      required: true,
    },
    duration: Number,
    status: {
      type: String,
      enum: ["PENDING", "SENT", "SUCCESS", "FAILED", "EXPIRED"],
      default: "PENDING",
    },
    payload: Schema.Types.Mixed,
    result: Schema.Types.Mixed,
    executeAfter: Date,
    sentAt: Date,
    executedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

DeviceCommandSchema.index({ deviceId: 1, status: 1, executeAfter: 1 });

export const DeviceCommand =
  models.DeviceCommand || model<DeviceCommandDocument>("DeviceCommand", DeviceCommandSchema);
