import { Device } from "@/models/Device";
import { DeviceLog } from "@/models/DeviceLog";
import { Table } from "@/models/Table";
import { Session } from "@/models/Session";
import { createAlert, resolveAlerts } from "@/lib/alerts";
import { completeSessionIfReturned, syncBallReturn } from "@/lib/session/engine";
import { publish } from "@/lib/realtime/sse";
import { getSettings } from "@/models/SystemSettings";
import { isMockIotEnabled } from "@/lib/utils";
import type { BoxStatus } from "@/types";

export async function applyHeartbeat(input: {
  deviceId: string;
  boxStatus?: BoxStatus;
  detectedBallCount?: number;
  ballCounterActive?: boolean;
  countEvent?: boolean;
  alarmStatus?: boolean;
  firmwareVersion?: string;
  wifiRssi?: number;
  uptime?: number;
  ipAddress?: string;
}) {
  const device = await Device.findOne({ deviceId: input.deviceId });
  if (!device) throw new Error("DEVICE_NOT_FOUND");

  const wasOffline = device.status === "OFFLINE";
  device.status = "ONLINE";
  if (device.operationalState === "OFFLINE") {
    device.operationalState = device.tableId ? "AVAILABLE" : "AVAILABLE";
  }
  device.lastHeartbeat = new Date();
  if (input.boxStatus) device.boxStatus = input.boxStatus;
  const openSession = await Session.findOne({
    deviceId: device.deviceId,
    status: { $in: ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"] },
  });
  const playing = openSession?.status === "ACTIVE" || openSession?.status === "EXTENDED";
  const returning = openSession?.status === "RETURN_REQUIRED" || openSession?.status === "BALLS_MISSING";
  const liveCount =
    returning &&
    typeof input.detectedBallCount === "number" &&
    (input.ballCounterActive === true || input.countEvent === true);
  if (playing) {
    device.detectedBallCount = 0;
  } else if (liveCount) {
    device.detectedBallCount = input.detectedBallCount as number;
  }
  if (typeof input.alarmStatus === "boolean") device.alarmStatus = input.alarmStatus;
  if (input.firmwareVersion) device.firmwareVersion = input.firmwareVersion;
  if (typeof input.wifiRssi === "number") device.wifiRssi = input.wifiRssi;
  if (typeof input.uptime === "number") device.uptime = input.uptime;
  if (input.ipAddress) device.ipAddress = input.ipAddress;
  await device.save();

  if (device.tableId) {
    const table = await Table.findById(device.tableId);
    if (table && table.status === "OFFLINE") {
      const active = await Session.findOne({
        tableId: table._id,
        status: { $in: ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"] },
      });
      table.status = active
        ? active.status === "ACTIVE" || active.status === "EXTENDED"
          ? "ACTIVE"
          : "RETURN_REQUIRED"
        : "AVAILABLE";
      await table.save();
    }
  }

  if (wasOffline) {
    await resolveAlerts({ type: "DEVICE_OFFLINE", deviceId: device.deviceId });
    await DeviceLog.create({
      deviceId: device.deviceId,
      type: "ONLINE",
      message: "Device came online",
    });
  }

  if (playing) {
    await syncBallReturn(device.deviceId, 0);
  } else if (liveCount) {
    await syncBallReturn(device.deviceId, input.detectedBallCount as number);
    await completeSessionIfReturned(device.deviceId);
  }

  publish(`device:${device.deviceId}`, { type: "heartbeat", deviceId: device.deviceId });
  publish("admin", { type: "device.heartbeat", deviceId: device.deviceId });
  return device;
}

export async function markStaleDevicesOffline() {
  if (isMockIotEnabled()) return;
  const settings = await getSettings();
  const cutoff = new Date(Date.now() - settings.heartbeatTimeoutSeconds * 1000);
  const stale = await Device.find({
    status: "ONLINE",
    $or: [{ lastHeartbeat: { $lt: cutoff } }, { lastHeartbeat: { $exists: false } }],
  });
  for (const device of stale) {
    device.status = "OFFLINE";
    device.operationalState = "OFFLINE";
    await device.save();
    if (device.tableId) {
      await Table.findByIdAndUpdate(device.tableId, { status: "OFFLINE" });
    }
    await createAlert({
      type: "DEVICE_OFFLINE",
      severity: "CRITICAL",
      deviceId: device.deviceId,
      tableId: device.tableId ? String(device.tableId) : undefined,
      message: `${device.name} оффлайн боллоо`,
    });
    await DeviceLog.create({
      deviceId: device.deviceId,
      type: "OFFLINE",
      message: "Heartbeat timeout",
    });
    publish("admin", { type: "device.offline", deviceId: device.deviceId });
  }
}
