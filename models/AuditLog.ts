import mongoose, { Schema, models, model } from "mongoose";

export interface AuditLogDocument {
  _id: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  action: string;
  targetType: string;
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    reason: String,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

AuditLogSchema.index({ timestamp: -1 });

export const AuditLog =
  models.AuditLog || model<AuditLogDocument>("AuditLog", AuditLogSchema);
