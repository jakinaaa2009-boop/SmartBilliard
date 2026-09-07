import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Alert } from "@/models/Alert";
import { User } from "@/models/User";
import { Table } from "@/models/Table";
import { Session } from "@/models/Session";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { query } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    await requireUser(["ADMIN"]);
    await connectDB();
    const q = query(request);
    const filter: Record<string, unknown> = {};
    if (q.status && q.status !== "all") filter.status = q.status;
    if (q.type && q.type !== "all") filter.type = q.type;
    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    const users = await User.find({ _id: { $in: alerts.map((a) => a.userId).filter(Boolean) } }).lean();
    const tables = await Table.find({ _id: { $in: alerts.map((a) => a.tableId).filter(Boolean) } }).lean();
    const sessions = await Session.find({ _id: { $in: alerts.map((a) => a.sessionId).filter(Boolean) } }).lean();
    const um = new Map(users.map((u) => [String(u._id), u]));
    const tm = new Map(tables.map((t) => [String(t._id), t]));
    const sm = new Map(sessions.map((s) => [String(s._id), s]));
    return jsonOk({
      alerts: alerts.map((a) => ({
        ...a,
        id: String(a._id),
        user: a.userId ? um.get(String(a.userId)) : null,
        table: a.tableId ? tm.get(String(a.tableId)) : null,
        session: a.sessionId ? sm.get(String(a.sessionId)) : null,
      })),
    });
  } catch (error) {
    return httpError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status") as "ACKNOWLEDGED" | "RESOLVED" | null;
    if (!id || !status) return jsonError("id, status шаардлагатай");
    await connectDB();
    const alert = await Alert.findById(id);
    if (!alert) return jsonError("Анхааруулга олдсонгүй", 404);
    alert.status = status;
    if (status === "ACKNOWLEDGED") {
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = admin.id as unknown as typeof alert.acknowledgedBy;
    }
    if (status === "RESOLVED") alert.resolvedAt = new Date();
    await alert.save();
    return jsonOk({ alert: toObject(alert) });
  } catch (error) {
    return httpError(error);
  }
}
