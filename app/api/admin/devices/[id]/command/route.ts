import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Device } from "@/models/Device";
import { requireUser, httpError } from "@/lib/auth/guards";
import { openBoxThenClose, queueCommand } from "@/lib/iot/commands";
import { applyHeartbeat } from "@/lib/iot/heartbeat";
import { writeAudit } from "@/lib/audit";
import { isMockIotEnabled, jsonError, jsonOk } from "@/lib/utils";
import { readJson } from "@/lib/api";

async function getDevice(id: string) {
  return (await Device.findById(id)) || (await Device.findOne({ deviceId: id.toUpperCase() }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const { id } = await params;
    const body = await readJson<{
      action: "open" | "close" | "alarm-on" | "alarm-off" | "restart" | "simulate";
      reason?: string;
      simulate?: string;
      balls?: number;
    }>(request);
    await connectDB();
    const device = await getDevice(id);
    if (!device) return jsonError("Төхөөрөмж олдсонгүй", 404);

    if (body.action === "open") {
      await openBoxThenClose(device.deviceId, device.relayOpenDuration);
      await writeAudit({
        adminId: admin.id,
        action: "MANUAL_OPEN",
        targetType: "Device",
        targetId: device.deviceId,
        reason: body.reason,
      });
    } else if (body.action === "close") {
      await queueCommand({ deviceId: device.deviceId, command: "CLOSE_BOX" });
      await writeAudit({
        adminId: admin.id,
        action: "MANUAL_CLOSE",
        targetType: "Device",
        targetId: device.deviceId,
        reason: body.reason,
      });
    } else if (body.action === "alarm-on") {
      await queueCommand({ deviceId: device.deviceId, command: "START_ALARM" });
    } else if (body.action === "alarm-off") {
      await queueCommand({ deviceId: device.deviceId, command: "STOP_ALARM" });
      device.alarmStatus = false;
      await device.save();
      await writeAudit({
        adminId: admin.id,
        action: "STOP_ALARM",
        targetType: "Device",
        targetId: device.deviceId,
        reason: body.reason,
      });
    } else if (body.action === "restart") {
      await queueCommand({ deviceId: device.deviceId, command: "RESET" });
    } else if (body.action === "simulate") {
      if (!isMockIotEnabled()) return jsonError("Mock IoT идэвхгүй", 403);
      if (body.simulate === "offline") {
        device.status = "OFFLINE";
        device.operationalState = "OFFLINE";
        await device.save();
      } else if (body.simulate === "online") {
        await applyHeartbeat({
          deviceId: device.deviceId,
          boxStatus: "LOCKED",
          detectedBallCount: device.detectedBallCount,
          alarmStatus: false,
          firmwareVersion: device.firmwareVersion || "1.0.2",
        });
      } else if (body.simulate === "balls") {
        await applyHeartbeat({
          deviceId: device.deviceId,
          detectedBallCount: body.balls ?? device.expectedBallCount,
        });
      } else if (body.simulate === "open") {
        await openBoxThenClose(device.deviceId);
      } else if (body.simulate === "close") {
        await queueCommand({ deviceId: device.deviceId, command: "CLOSE_BOX" });
      } else if (body.simulate === "alarm-on") {
        await queueCommand({ deviceId: device.deviceId, command: "START_ALARM" });
      } else if (body.simulate === "alarm-off") {
        await queueCommand({ deviceId: device.deviceId, command: "STOP_ALARM" });
      }
    }

    return jsonOk({ ok: true });
  } catch (error) {
    return httpError(error);
  }
}
