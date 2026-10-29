import { Device } from "@/models/Device";
import { DeviceLog } from "@/models/DeviceLog";
import { applyHeartbeat } from "@/lib/iot/heartbeat";
import { nextPendingCommand } from "@/lib/iot/commands";
import { hashSecret, verifySecret } from "@/lib/auth/password";
import { generateSecret } from "@/lib/utils";
import { getSettings } from "@/models/SystemSettings";
import type { BoxStatus } from "@/types";

export function normalizeDeviceId(raw: string) {
  return raw.trim().toUpperCase();
}

export function isDeviceId(value: string) {
  return /^[A-Z0-9_-]{3,40}$/.test(value);
}

export async function announceDevice(input: {
  deviceId: string;
  name?: string;
  token?: string;
  uptime?: number;
  wifiRssi?: number;
  ipAddress?: string;
  firmwareVersion?: string;
  boxStatus?: BoxStatus;
  ballCount?: number;
  ballCounterActive?: boolean;
  irHit?: boolean;
  vibrationHit?: boolean;
  irDetected?: boolean;
  vibrationCount?: number;
  mpuReady?: boolean;
  action?: string;
  eventType?: number;
  value?: number;
}) {
  const deviceId = normalizeDeviceId(input.deviceId);
  if (!isDeviceId(deviceId)) {
    throw new Error("INVALID_DEVICE");
  }

  let device = await Device.findOne({ deviceId });
  let secret: string | undefined;
  let created = false;

  if (!device) {
    secret = generateSecret(32);
    device = await Device.create({
      deviceId,
      name: input.name?.trim() || deviceId,
      secretHash: await hashSecret(secret),
      status: "OFFLINE",
      operationalState: "OFFLINE",
      boxStatus: "LOCKED",
      expectedBallCount: 8,
      detectedBallCount: 0,
      relayOpenDuration: 7000,
      alarmDelaySeconds: 120,
      firmwareVersion: input.firmwareVersion,
    });
    created = true;
    await DeviceLog.create({
      deviceId,
      type: "ENROLLED",
      message: "Device enrolled from ESP32",
    });
  } else if (!input.token) {
    const settings = await getSettings();
    const cutoff = Date.now() - settings.heartbeatTimeoutSeconds * 1000;
    const seen = device.lastHeartbeat?.getTime() ?? 0;
    if (device.status === "ONLINE" && seen >= cutoff) {
      throw new Error("UNAUTHORIZED");
    }
    secret = generateSecret(32);
    device.secretHash = await hashSecret(secret);
    await device.save();
    await DeviceLog.create({
      deviceId,
      type: "REENROLLED",
      message: "Secret reissued because the device enrolled with no token",
    });
  } else if (!(await verifySecret(input.token, device.secretHash))) {
    throw new Error("UNAUTHORIZED");
  }

  let boxStatus = input.boxStatus;
  if (input.action === "button_pressed" && !boxStatus) {
    boxStatus = device.boxStatus === "UNLOCKED" ? "LOCKED" : "UNLOCKED";
    await DeviceLog.create({
      deviceId,
      type: "BUTTON",
      message: "Button pressed",
      payload: { eventType: input.eventType, value: input.value, boxStatus },
    });
  }

  const detected =
    typeof input.ballCount === "number"
      ? input.ballCount
      : input.action === "ball_detected" && typeof input.value === "number"
        ? input.value
        : undefined;

  const updated = await applyHeartbeat({
    deviceId,
    boxStatus,
    detectedBallCount: detected,
    ballCounterActive: input.ballCounterActive,
    countEvent: input.action === "ball_detected",
    irHit: input.irHit,
    vibrationHit: input.vibrationHit,
    irDetected: input.irDetected,
    vibrationCount: input.vibrationCount,
    mpuReady: input.mpuReady,
    firmwareVersion: input.firmwareVersion,
    wifiRssi: input.wifiRssi,
    uptime: input.uptime,
    ipAddress: input.ipAddress,
  });

  const command = input.token || secret ? await nextPendingCommand(deviceId) : null;
  return { device: updated, secret, created, command };
}
