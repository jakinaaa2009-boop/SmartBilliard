import mongoose, { Schema, models, model } from "mongoose";

export interface DeviceLogDocument {
  _id: mongoose.Types.ObjectId;
  deviceId: string;
  type: string;
  message: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
}

const DeviceLogSchema = new Schema<DeviceLogDocument>(
  {
    deviceId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

DeviceLogSchema.index({ createdAt: -1 });

export const DeviceLog =
  models.DeviceLog || model<DeviceLogDocument>("DeviceLog", DeviceLogSchema);
