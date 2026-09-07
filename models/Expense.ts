import mongoose, { Schema, models, model } from "mongoose";
import type { ExpenseCategory } from "@/types";

export interface ExpenseDocument {
  _id: mongoose.Types.ObjectId;
  title: string;
  category: ExpenseCategory;
  amount: number;
  description?: string;
  date: Date;
  createdBy: mongoose.Types.ObjectId;
  receiptImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<ExpenseDocument>(
  {
    title: { type: String, required: true },
    category: {
      type: String,
      enum: [
        "EQUIPMENT_MAINTENANCE",
        "BALL_REPLACEMENT",
        "INTERNET",
        "ELECTRICITY",
        "ESP32_REPLACEMENT",
        "CLEANING",
        "RENT",
        "OTHER",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    description: String,
    date: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiptImage: String,
  },
  { timestamps: true }
);

export const Expense = models.Expense || model<ExpenseDocument>("Expense", ExpenseSchema);
