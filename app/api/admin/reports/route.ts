import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { Session } from "@/models/Session";
import { Table } from "@/models/Table";
import { User } from "@/models/User";
import { Device } from "@/models/Device";
import { Alert } from "@/models/Alert";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonOk } from "@/lib/utils";
import { query } from "@/lib/api";

function rangeFromQuery(q: Record<string, string>) {
  const now = new Date();
  let from = new Date(now);
  from.setHours(0, 0, 0, 0);
  let to = new Date(now);
  if (q.preset === "yesterday") {
    from.setDate(from.getDate() - 1);
    to = new Date(from);
    to.setHours(23, 59, 59, 999);
  } else if (q.preset === "week") {
    from.setDate(from.getDate() - 7);
  } else if (q.preset === "month") {
    from.setDate(1);
  } else if (q.from && q.to) {
    from = new Date(q.from);
    to = new Date(q.to);
  }
  return { from, to };
}

export async function GET(request: NextRequest) {
  try {
    await requireUser(["ADMIN"]);
    await connectDB();
    const q = query(request);
    const { from, to } = rangeFromQuery(q);
    const paid = { status: "PAID" as const, paidAt: { $gte: from, $lte: to } };
    const [revenue, sessions, tables, users, failedPayments, missingBalls, devices] = await Promise.all([
      Payment.aggregate([
        { $match: paid },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Session.find({ createdAt: { $gte: from, $lte: to } }).lean(),
      Table.find().lean(),
      User.find({ role: "CLIENT" }).lean(),
      Payment.countDocuments({ status: "FAILED", createdAt: { $gte: from, $lte: to } }),
      Alert.countDocuments({ type: "BALL_MISSING", createdAt: { $gte: from, $lte: to } }),
      Device.find().lean(),
    ]);
    const hours = sessions.reduce((s, x) => s + x.purchasedMinutes, 0) / 60;
    const tableUsage = new Map<string, number>();
    for (const s of sessions) {
      tableUsage.set(String(s.tableId), (tableUsage.get(String(s.tableId)) || 0) + 1);
    }
    const mostUsed = Array.from(tableUsage.entries()).sort((a, b) => b[1] - a[1])[0];
    const spend = await Payment.aggregate([
      { $match: paid },
      { $group: { _id: "$userId", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]);
    const topUsers = await User.find({ _id: { $in: spend.map((s) => s._id) } }).lean();
    const um = new Map(topUsers.map((u) => [String(u._id), u]));
    const tm = new Map(tables.map((t) => [String(t._id), t]));
    return jsonOk({
      from,
      to,
      revenue: revenue[0]?.total || 0,
      paymentCount: revenue[0]?.count || 0,
      sessions: sessions.length,
      playingHours: Math.round(hours * 10) / 10,
      mostUsedTable: mostUsed ? { table: tm.get(mostUsed[0]), count: mostUsed[1] } : null,
      topCustomers: spend.map((s) => ({
        user: um.get(String(s._id)),
        total: s.total,
        count: s.count,
      })),
      failedPayments,
      missingBallIncidents: missingBalls,
      deviceUptime: devices.map((d) => ({
        deviceId: d.deviceId,
        online: d.status === "ONLINE",
        uptime: d.uptime || 0,
        lastHeartbeat: d.lastHeartbeat,
      })),
      rows: sessions.map((s) => ({
        id: String(s._id),
        code: s.sessionCode,
        table: tm.get(String(s.tableId))?.name,
        minutes: s.purchasedMinutes,
        amount: s.totalAmount,
        status: s.status,
        startedAt: s.startedAt,
      })),
    });
  } catch (error) {
    return httpError(error);
  }
}
