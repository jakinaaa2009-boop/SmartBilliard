import { connectDB } from "@/lib/db/mongoose";
import { Session } from "@/models/Session";
import { Table } from "@/models/Table";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonOk } from "@/lib/utils";

export async function GET() {
  try {
    const user = await requireUser();
    await connectDB();
    const sessions = await Session.find({ userId: user.id }).sort({ createdAt: -1 }).limit(50).lean();
    const tableIds = sessions.map((s) => s.tableId);
    const tables = await Table.find({ _id: { $in: tableIds } }).lean();
    const tableMap = new Map(tables.map((t) => [String(t._id), t]));
    return jsonOk({
      sessions: sessions.map((s) => ({
        ...s,
        id: String(s._id),
        table: tableMap.get(String(s.tableId)) || null,
      })),
    });
  } catch (error) {
    return httpError(error);
  }
}
