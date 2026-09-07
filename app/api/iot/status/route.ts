import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { authenticateDevice } from "@/lib/iot/auth";
import { applyHeartbeat } from "@/lib/iot/heartbeat";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";
import { heartbeatSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await readJson(request);
    const parsed = heartbeatSchema.safeParse(body);
    if (!parsed.success) return jsonError("Буруу өгөгдөл");
    await authenticateDevice(request, parsed.data.deviceId);
    const device = await applyHeartbeat(parsed.data);
    return jsonOk({
      deviceId: device.deviceId,
      online: device.status === "ONLINE",
      boxStatus: device.boxStatus,
      ballStatus: device.detectedBallCount >= device.expectedBallCount ? "COMPLETE" : "INCOMPLETE",
      ballCount: device.detectedBallCount,
      expectedBallCount: device.expectedBallCount,
      alarm: device.alarmStatus,
      lastHeartbeat: device.lastHeartbeat,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return jsonError(message, message === "UNAUTHORIZED" ? 401 : 400);
  }
}
