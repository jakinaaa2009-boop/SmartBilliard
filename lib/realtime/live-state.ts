import { connectDB } from "@/lib/db/mongoose";
import { Device } from "@/models/Device";

export interface LiveDevice {
  id: string;
  deviceId: string;
  name: string;
  status: string;
  boxStatus: string;
  operationalState: string;
  alarmStatus: boolean;
  lastHeartbeat?: string;
  uptime?: number;
  detectedBallCount: number;
  expectedBallCount: number;
  ipAddress?: string;
  wifiRssi?: number;
  tableId?: string;
}

export const LIVE_WINDOW_MS = 8000;

export function isDeviceLive(lastHeartbeat?: string | null, now = Date.now()) {
  if (!lastHeartbeat) return false;
  const at = new Date(lastHeartbeat).getTime();
  if (Number.isNaN(at)) return false;
  return now - at < LIVE_WINDOW_MS;
}

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
