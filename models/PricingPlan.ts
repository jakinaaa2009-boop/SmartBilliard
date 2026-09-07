import mongoose, { Schema, models, model } from "mongoose";

export interface PricingPlanDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  durationMinutes: number;
  price: number;
  active: boolean;
  popular: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const PricingPlanSchema = new Schema<PricingPlanDocument>(
  {
    name: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    price: { type: Number, required: true },
    active: { type: Boolean, default: true },
    popular: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const PricingPlan =
  models.PricingPlan || model<PricingPlanDocument>("PricingPlan", PricingPlanSchema);
