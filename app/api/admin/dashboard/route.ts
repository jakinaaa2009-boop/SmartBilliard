import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { Session } from "@/models/Session";
import { User } from "@/models/User";
import { Device } from "@/models/Device";
import { Table } from "@/models/Table";
import { Alert } from "@/models/Alert";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonOk } from "@/lib/utils";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET() {
  try {
    await requireUser(["ADMIN"]);
    await connectDB();
    const today = startOfDay();
    const [
      todayRevenue,
      todaySessions,
      activeSessions,
      userCount,
      devices,
      tables,
      openAlerts,
      failedPayments,
    ] = await Promise.all([
      Payment.aggregate([
        { $match: { status: "PAID", paidAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Session.countDocuments({ createdAt: { $gte: today } }),
      Session.countDocuments({ status: { $in: ["ACTIVE", "EXTENDED"] } }),
      User.countDocuments({ role: "CLIENT" }),
      Device.find().lean(),
      Table.find().sort({ number: 1 }).lean(),
      Alert.countDocuments({ status: { $in: ["OPEN", "ACKNOWLEDGED"] }, type: "BALL_MISSING" }),
      Payment.countDocuments({ status: "FAILED", createdAt: { $gte: today } }),
    ]);

    const online = devices.filter((d) => d.status === "ONLINE").length;
    const sessionList = await Session.find({
      status: { $in: ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"] },
    }).lean();
    const sessionByTable = new Map(sessionList.map((s) => [String(s.tableId), s]));
    const deviceById = new Map(devices.map((d) => [d.deviceId, d]));

    const liveTables = tables.map((table) => {
      const device = table.deviceId ? deviceById.get(table.deviceId) : undefined;
      const session = sessionByTable.get(String(table._id));
      return {
        id: String(table._id),
        number: table.number,
        name: table.name,
        status: table.status,
        deviceId: table.deviceId,
        online: device?.status === "ONLINE",
        balls: `${device?.detectedBallCount ?? 0}/${device?.expectedBallCount ?? table.expectedBallCount}`,
        ballCount: device?.detectedBallCount ?? 0,
        expectedBallCount: device?.expectedBallCount ?? table.expectedBallCount,
        remainingMs: session?.expiresAt ? new Date(session.expiresAt).getTime() - Date.now() : 0,
        sessionStatus: session?.status,
        alarm: device?.alarmStatus,
      };
    });

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const revenueSeries = await Payment.aggregate([
      { $match: { status: "PAID", paidAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return jsonOk({
      kpis: {
        todayRevenue: todayRevenue[0]?.total || 0,
        todaySessions,
        activeTables: activeSessions,
        totalTables: tables.length,
        totalUsers: userCount,
        onlineDevices: online,
        offlineDevices: devices.length - online,
        missingBallAlerts: openAlerts,
        failedPayments,
      },
      liveTables,
      revenueSeries: revenueSeries.map((r) => ({ date: r._id, total: r.total, count: r.count })),
    });
  } catch (error) {
    return httpError(error);
  }
}
