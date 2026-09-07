import mongoose, { Schema, models, model } from "mongoose";
import type { PaymentStatus, PaymentType } from "@/types";

export interface PaymentDocument {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  tableId: mongoose.Types.ObjectId;
  deviceId?: string;
  pricingPlanId?: mongoose.Types.ObjectId;
  type: PaymentType;
  amount: number;
  provider: "QPAY" | "MANUAL";
  qpayInvoiceId?: string;
  qpayPaymentId?: string;
  qrImage?: string;
  urls?: { name: string; description?: string; logo?: string; link: string }[];
  status: PaymentStatus;
  paidAt?: Date;
  expiresAt?: Date;
  callbackProcessed: boolean;
  flaggedForReview: boolean;
  reviewReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<PaymentDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "Session" },
    tableId: { type: Schema.Types.ObjectId, ref: "Table", required: true },
    deviceId: String,
    pricingPlanId: { type: Schema.Types.ObjectId, ref: "PricingPlan" },
    type: {
      type: String,
      enum: ["SESSION", "EXTENSION", "MANUAL", "REFUND"],
      required: true,
    },
    amount: { type: Number, required: true },
    provider: { type: String, enum: ["QPAY", "MANUAL"], default: "QPAY" },
    qpayInvoiceId: { type: String, unique: true, sparse: true },
    qpayPaymentId: String,
    qrImage: String,
    urls: [
      {
        name: String,
        description: String,
        logo: String,
        link: String,
      },
    ],
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "PAID", "FAILED", "EXPIRED", "CANCELLED", "REFUNDED"],
      default: "PENDING",
    },
    paidAt: Date,
    expiresAt: Date,
    callbackProcessed: { type: Boolean, default: false },
    flaggedForReview: { type: Boolean, default: false },
    reviewReason: String,
  },
  { timestamps: true }
);

PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = models.Payment || model<PaymentDocument>("Payment", PaymentSchema);
