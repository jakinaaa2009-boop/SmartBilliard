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
