import mongoose, { Schema, models, model } from "mongoose";
import type { BoxStatus, DeviceState, DeviceStatus } from "@/types";

export interface DeviceDocument {
  _id: mongoose.Types.ObjectId;
  deviceId: string;
  name: string;
  tableId?: mongoose.Types.ObjectId;
  secretHash: string;
  status: DeviceStatus;
  operationalState: DeviceState;
  ipAddress?: string;
  firmwareVersion?: string;
  expectedBallCount: number;
  detectedBallCount: number;
  boxStatus: BoxStatus;
  alarmStatus: boolean;
  lastHeartbeat?: Date;
  wifiRssi?: number;
  uptime?: number;
  relayOpenDuration: number;
  alarmDelaySeconds: number;
  irEnabled: boolean;
  vibrationEnabled: boolean;
  sensorTestActive: boolean;
  mpuReady?: boolean;
  lastIrAt?: Date;
  lastVibrationAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<DeviceDocument>(
  {
    deviceId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    tableId: { type: Schema.Types.ObjectId, ref: "Table" },
    secretHash: { type: String, required: true },
    status: { type: String, enum: ["ONLINE", "OFFLINE"], default: "OFFLINE" },
    operationalState: {
      type: String,
      enum: [
        "AVAILABLE",
        "PAYMENT_PENDING",
        "OPENING",
        "IN_USE",
        "RETURN_REQUIRED",
        "BALLS_MISSING",
        "ALARM",
        "MAINTENANCE",
        "OFFLINE",
      ],
      default: "OFFLINE",
    },
    ipAddress: String,
    firmwareVersion: String,
    expectedBallCount: { type: Number, default: 8 },
    detectedBallCount: { type: Number, default: 0 },
    boxStatus: {
      type: String,
      enum: ["LOCKED", "UNLOCKED", "OPENING", "ERROR"],
      default: "LOCKED",
    },
    alarmStatus: { type: Boolean, default: false },
    lastHeartbeat: Date,
    wifiRssi: Number,
    uptime: Number,
    relayOpenDuration: { type: Number, default: 7000 },
    alarmDelaySeconds: { type: Number, default: 120 },
    irEnabled: { type: Boolean, default: true },
    vibrationEnabled: { type: Boolean, default: true },
    sensorTestActive: { type: Boolean, default: false },
    mpuReady: Boolean,
    lastIrAt: Date,
    lastVibrationAt: Date,
  },
  { timestamps: true }
);

export const Device = models.Device || model<DeviceDocument>("Device", DeviceSchema);
