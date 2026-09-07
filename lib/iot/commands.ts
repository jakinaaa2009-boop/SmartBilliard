import { Device } from "@/models/Device";
import { DeviceCommand } from "@/models/DeviceCommand";
import { DeviceLog } from "@/models/DeviceLog";
import { generateId, isMockIotEnabled } from "@/lib/utils";
import { publish } from "@/lib/realtime/sse";
import type { IotCommand } from "@/types";

export async function queueCommand(input: {
  deviceId: string;
  command: IotCommand;
  duration?: number;
  executeAfter?: Date;
  payload?: Record<string, unknown>;
}) {
  const commandId = generateId("CMD");
  const cmd = await DeviceCommand.create({
    commandId,
    deviceId: input.deviceId,
    command: input.command,
    duration: input.duration,
    executeAfter: input.executeAfter,
    payload: input.payload,
    status: "PENDING",
  });

  await DeviceLog.create({
    deviceId: input.deviceId,
    type: "COMMAND_QUEUED",
    message: `${input.command} queued`,
    payload: { commandId, duration: input.duration },
  });

  if (isMockIotEnabled()) {
    await applyMockCommand(input.deviceId, input.command, input.duration);
    cmd.status = "SUCCESS";
    cmd.executedAt = new Date();
    cmd.result = { success: true, mock: true };
    await cmd.save();
  }

  publish(`device:${input.deviceId}`, {
    type: "command",
    commandId,
    command: input.command,
  });
  publish("admin", { type: "device.command", deviceId: input.deviceId, command: input.command });
  return cmd;
}

async function applyMockCommand(deviceId: string, command: IotCommand, duration?: number) {
  const device = await Device.findOne({ deviceId });
  if (!device) return;
  if (command === "OPEN_BOX") {
    device.boxStatus = "UNLOCKED";
    device.operationalState = "OPENING";
    await device.save();
    const closeIn = duration || device.relayOpenDuration || 7000;
    setTimeout(() => {
      void (async () => {
        const d = await Device.findOne({ deviceId });
        if (!d) return;
        d.boxStatus = "LOCKED";
        if (d.operationalState === "OPENING") d.operationalState = "IN_USE";
        await d.save();
        publish(`device:${deviceId}`, { type: "status", boxStatus: "LOCKED" });
      })();
    }, Math.min(closeIn, 15000));
  }
  if (command === "CLOSE_BOX") {
    device.boxStatus = "LOCKED";
    await device.save();
  }
  if (command === "START_ALARM") {
    device.alarmStatus = true;
    device.operationalState = "ALARM";
    await device.save();
  }
  if (command === "STOP_ALARM") {
    device.alarmStatus = false;
    await device.save();
  }
  if (command === "RESET") {
    device.alarmStatus = false;
    device.boxStatus = "LOCKED";
    await device.save();
  }
}

export async function nextPendingCommand(deviceId: string) {
  const now = new Date();
  const cmd = await DeviceCommand.findOneAndUpdate(
    {
      deviceId,
      status: "PENDING",
      $or: [{ executeAfter: { $exists: false } }, { executeAfter: { $lte: now } }, { executeAfter: null }],
    },
    { status: "SENT", sentAt: now },
    { sort: { createdAt: 1 }, new: true }
  );
  if (!cmd) return null;
  return {
    commandId: cmd.commandId,
    command: cmd.command,
    duration: cmd.duration,
    payload: cmd.payload,
  };
}

export async function completeCommand(
  deviceId: string,
  commandId: string,
  success: boolean,
  result?: Record<string, unknown>
) {
  const cmd = await DeviceCommand.findOne({ commandId, deviceId });
  if (!cmd) return null;
  cmd.status = success ? "SUCCESS" : "FAILED";
  cmd.executedAt = new Date();
  cmd.result = result;
  await cmd.save();
  await DeviceLog.create({
    deviceId,
    type: success ? "COMMAND_SUCCESS" : "COMMAND_FAILED",
    message: `${cmd.command} ${success ? "ok" : "failed"}`,
    payload: { commandId, result },
  });
  return cmd;
}

export async function openBoxThenClose(deviceId: string, durationMs?: number) {
  const device = await Device.findOne({ deviceId });
  if (!device) throw new Error("Device not found");
  const duration = durationMs || device.relayOpenDuration || 7000;
  await queueCommand({ deviceId, command: "OPEN_BOX", duration });
  await queueCommand({
    deviceId,
    command: "CLOSE_BOX",
    executeAfter: new Date(Date.now() + duration),
  });
  return duration;
}
