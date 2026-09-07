import { connectDB } from "@/lib/db/mongoose";
import { Table } from "@/models/Table";
import { Device } from "@/models/Device";
import { Session } from "@/models/Session";
import { jsonOk } from "@/lib/utils";

export async function GET() {
  await connectDB();
  const tables = await Table.find().sort({ number: 1 }).lean();
  const devices = await Device.find().lean();
  const deviceMap = new Map(devices.map((d) => [d.deviceId, d]));
  const activeSessions = await Session.find({
    status: { $in: ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"] },
  }).lean();
  const sessionMap = new Map(activeSessions.map((s) => [String(s.tableId), s]));

  const data = tables.map((table) => {
    const device = table.deviceId ? deviceMap.get(table.deviceId) : undefined;
    const session = sessionMap.get(String(table._id));
    return {
      id: String(table._id),
      number: table.number,
      name: table.name,
      zone: table.zone,
      deviceId: table.deviceId,
      status: table.status,
      expectedBallCount: table.expectedBallCount,
      enabled: table.enabled,
      device: device
        ? {
            deviceId: device.deviceId,
            online: device.status === "ONLINE",
            boxStatus: device.boxStatus,
            ballCount: device.detectedBallCount,
            expectedBallCount: device.expectedBallCount,
            alarm: device.alarmStatus,
            lastHeartbeat: device.lastHeartbeat,
            operationalState: device.operationalState,
          }
        : null,
      session: session
        ? {
            id: String(session._id),
            status: session.status,
            expiresAt: session.expiresAt,
            startedAt: session.startedAt,
          }
        : null,
    };
  });
  return jsonOk({ tables: data });
}
