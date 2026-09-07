import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { Expense } from "@/models/Expense";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";
import type { ExpenseCategory } from "@/types";

export async function GET() {
  try {
    await requireUser(["ADMIN"]);
    await connectDB();
    const [revenueAgg, expenses, payments] = await Promise.all([
      Payment.aggregate([
        { $match: { status: "PAID" } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Expense.find().sort({ date: -1 }).limit(200).lean(),
      Payment.find({ status: "PAID" }).lean(),
    ]);
    const revenue = revenueAgg[0]?.total || 0;
    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const daily = await Payment.aggregate([
      { $match: { status: "PAID", paidAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const monthly = await Payment.aggregate([
      { $match: { status: "PAID" } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const byTable = await Payment.aggregate([
      { $match: { status: "PAID" } },
      { $group: { _id: "$tableId", total: { $sum: "$amount" } } },
    ]);
    const byType = await Payment.aggregate([
      { $match: { status: "PAID" } },
      { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    return jsonOk({
      summary: {
        revenue,
        expenses: expenseTotal,
        net: revenue - expenseTotal,
        transactions: (revenueAgg[0]?.count || 0) + expenses.length,
      },
      daily: daily.map((d) => ({ date: d._id, total: d.total })),
      monthly: monthly.map((d) => ({ date: d._id, total: d.total })),
      byTable,
      byType,
      expenses: expenses.map((e) => ({ ...e, id: String(e._id) })),
      paymentCount: payments.length,
    });
  } catch (error) {
    return httpError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const body = await readJson<{
      title: string;
      category: ExpenseCategory;
      amount: number;
      description?: string;
      date?: string;
      receiptImage?: string;
    }>(request);
    if (!body.title || !body.category || !body.amount) return jsonError("Мэдээлэл дутуу");
    await connectDB();
    const expense = await Expense.create({
      title: body.title,
      category: body.category,
      amount: body.amount,
      description: body.description,
      date: body.date ? new Date(body.date) : new Date(),
      createdBy: admin.id,
      receiptImage: body.receiptImage,
    });
    return jsonOk({ expense: toObject(expense) }, 201);
  } catch (error) {
    return httpError(error);
  }
}
