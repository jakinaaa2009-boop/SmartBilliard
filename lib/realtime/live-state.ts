import { connectDB } from "@/lib/db/mongoose";
import { Device } from "@/models/Device";
import type { LiveDevice } from "@/lib/realtime/device-live";

export type { LiveDevice };

export async function readLiveState(): Promise<LiveDevice[]> {
  await connectDB();
  const devices = await Device.find()
    .select(
      "deviceId name status boxStatus operationalState alarmStatus lastHeartbeat uptime detectedBallCount expectedBallCount ipAddress wifiRssi tableId"
    )
    .lean();
  return devices.map((device) => ({
    id: String(device._id),
    deviceId: device.deviceId,
    name: device.name,
    status: device.status,
    boxStatus: device.boxStatus,
    operationalState: device.operationalState,
    alarmStatus: Boolean(device.alarmStatus),
    lastHeartbeat: device.lastHeartbeat ? new Date(device.lastHeartbeat).toISOString() : undefined,
    uptime: device.uptime,
    detectedBallCount: device.detectedBallCount,
    expectedBallCount: device.expectedBallCount,
    ipAddress: device.ipAddress,
    wifiRssi: device.wifiRssi,
    tableId: device.tableId ? String(device.tableId) : undefined,
  }));
}
