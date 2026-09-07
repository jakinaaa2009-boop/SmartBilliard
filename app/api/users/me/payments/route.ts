import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { Table } from "@/models/Table";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonOk } from "@/lib/utils";

export async function GET() {
  try {
    const user = await requireUser();
    await connectDB();
    const payments = await Payment.find({ userId: user.id }).sort({ createdAt: -1 }).limit(50).lean();
    const tables = await Table.find({ _id: { $in: payments.map((p) => p.tableId) } }).lean();
    const tableMap = new Map(tables.map((t) => [String(t._id), t]));
    return jsonOk({
      payments: payments.map((p) => ({
        ...p,
        id: String(p._id),
        table: tableMap.get(String(p.tableId)) || null,
      })),
    });
  } catch (error) {
    return httpError(error);
  }
}
