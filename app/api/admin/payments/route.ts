import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { User } from "@/models/User";
import { Table } from "@/models/Table";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonOk } from "@/lib/utils";
import { query } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    await requireUser(["ADMIN"]);
    await connectDB();
    const q = query(request);
    const filter: Record<string, unknown> = {};
    if (q.status && q.status !== "all") filter.status = q.status;
    if (q.type && q.type !== "all") filter.type = q.type;
    const payments = await Payment.find(filter).sort({ createdAt: -1 }).limit(300).lean();
    const users = await User.find({ _id: { $in: payments.map((p) => p.userId) } }).lean();
    const tables = await Table.find({ _id: { $in: payments.map((p) => p.tableId) } }).lean();
    const um = new Map(users.map((u) => [String(u._id), u]));
    const tm = new Map(tables.map((t) => [String(t._id), t]));
    return jsonOk({
      payments: payments.map((p) => ({
        ...p,
        id: String(p._id),
        user: um.get(String(p.userId))
          ? { fullName: um.get(String(p.userId))!.fullName, phone: um.get(String(p.userId))!.phone }
          : null,
        table: tm.get(String(p.tableId)) || null,
      })),
    });
  } catch (error) {
    return httpError(error);
  }
}
