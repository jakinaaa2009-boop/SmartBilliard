import { connectDB } from "@/lib/db/mongoose";
import { Session } from "@/models/Session";
import { Table } from "@/models/Table";
import { Device } from "@/models/Device";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonOk } from "@/lib/utils";
import { runSchedulerTick } from "@/lib/jobs/scheduler";

export async function GET() {
  try {
    const user = await requireUser();
    await connectDB();
    await runSchedulerTick();
    const sessions = await Session.find({ userId: user.id }).sort({ createdAt: -1 }).limit(50).lean();
    const tableIds = sessions.map((s) => s.tableId);
    const [tables, devices] = await Promise.all([
      Table.find({ _id: { $in: tableIds } }).lean(),
      Device.find({ deviceId: { $in: sessions.map((s) => s.deviceId) } }).lean(),
    ]);
    const tableMap = new Map(tables.map((t) => [String(t._id), t]));
    const deviceMap = new Map(devices.map((d) => [d.deviceId, d]));
    return jsonOk({
      sessions: sessions.map((s) => {
        const device = deviceMap.get(s.deviceId);
        const counting = s.status === "RETURN_REQUIRED" || s.status === "BALLS_MISSING";
        return {
          ...s,
          id: String(s._id),
          table: tableMap.get(String(s.tableId)) || null,
          ballCount: counting ? device?.detectedBallCount || 0 : 0,
          expectedBallCount: device?.expectedBallCount || s.expectedBallCount || 8,
        };
      }),
    });
  } catch (error) {
    return httpError(error);
  }
}
