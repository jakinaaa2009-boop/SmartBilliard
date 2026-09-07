import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Session } from "@/models/Session";
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
    if (q.status === "problems") {
      filter.status = { $in: ["BALLS_MISSING", "RETURN_REQUIRED", "FAILED"] };
    } else if (q.status === "active") {
      filter.status = { $in: ["ACTIVE", "EXTENDED"] };
    } else if (q.status === "completed") {
      filter.status = "COMPLETED";
    } else if (q.status && q.status !== "all") {
      filter.status = q.status;
    }
    if (q.today === "1") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      filter.createdAt = { $gte: start };
    }
    if (q.from || q.to) {
      const createdAt: Record<string, Date> = {};
      if (q.from) createdAt.$gte = new Date(q.from);
      if (q.to) createdAt.$lte = new Date(q.to);
      filter.createdAt = createdAt;
    }
    const sessions = await Session.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    const users = await User.find({ _id: { $in: sessions.map((s) => s.userId) } }).lean();
    const tables = await Table.find({ _id: { $in: sessions.map((s) => s.tableId) } }).lean();
    const um = new Map(users.map((u) => [String(u._id), u]));
    const tm = new Map(tables.map((t) => [String(t._id), t]));
    return jsonOk({
      sessions: sessions.map((s) => ({
        ...s,
        id: String(s._id),
        user: um.get(String(s.userId))
          ? { fullName: um.get(String(s.userId))!.fullName, phone: um.get(String(s.userId))!.phone }
          : null,
        table: tm.get(String(s.tableId)) || null,
      })),
    });
  } catch (error) {
    return httpError(error);
  }
}
