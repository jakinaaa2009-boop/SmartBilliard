import mongoose, { Schema, models, model } from "mongoose";
import { DEFAULT_SETTINGS, type SystemSettingsValues } from "@/types";

export interface SystemSettingsDocument extends SystemSettingsValues {
  _id: mongoose.Types.ObjectId;
  key: string;
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<SystemSettingsDocument>(
  {
    key: { type: String, default: "global", unique: true },
    businessName: { type: String, default: DEFAULT_SETTINGS.businessName },
    currency: { type: String, default: DEFAULT_SETTINGS.currency },
    gracePeriodSeconds: { type: Number, default: DEFAULT_SETTINGS.gracePeriodSeconds },
    heartbeatTimeoutSeconds: {
      type: Number,
      default: DEFAULT_SETTINGS.heartbeatTimeoutSeconds,
    },
    ballReturnAlarmDelaySeconds: {
      type: Number,
      default: DEFAULT_SETTINGS.ballReturnAlarmDelaySeconds,
    },
    defaultOpeningDurationMs: {
      type: Number,
      default: DEFAULT_SETTINGS.defaultOpeningDurationMs,
    },
    minimumSessionMinutes: {
      type: Number,
      default: DEFAULT_SETTINGS.minimumSessionMinutes,
    },
    maximumSessionMinutes: {
      type: Number,
      default: DEFAULT_SETTINGS.maximumSessionMinutes,
    },
    paymentExpiryMinutes: {
      type: Number,
      default: DEFAULT_SETTINGS.paymentExpiryMinutes,
    },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export const SystemSettings =
  models.SystemSettings ||
  model<SystemSettingsDocument>("SystemSettings", SystemSettingsSchema);

export async function getSettings() {
  const existing = await SystemSettings.findOne({ key: "global" });
  if (existing) return existing;
  return SystemSettings.create({ key: "global", ...DEFAULT_SETTINGS });
}
