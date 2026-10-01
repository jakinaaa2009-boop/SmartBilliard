import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { announceDevice } from "@/lib/iot/announce";
import { runSchedulerTick } from "@/lib/jobs/scheduler";
import { jsonError, jsonOk } from "@/lib/utils";
import { readJson } from "@/lib/api";
import type { BoxStatus } from "@/types";

function bearer(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    await runSchedulerTick();
    const body = await readJson<{
      deviceId?: string;
      device?: string;
      name?: string;
      uptime?: number;
      wifiRssi?: number;
      ipAddress?: string;
      firmwareVersion?: string;
      boxStatus?: BoxStatus;
      ballCount?: number;
      ballCounterActive?: boolean;
      action?: string;
      eventType?: number;
      value?: number;
    }>(request);
    const result = await announceDevice({
      deviceId: body.deviceId || body.device || "",
      name: body.name,
      token: bearer(request) || undefined,
      uptime: body.uptime,
      wifiRssi: body.wifiRssi,
      ipAddress: body.ipAddress,
      firmwareVersion: body.firmwareVersion,
      boxStatus: body.boxStatus,
      ballCount: body.ballCount,
      ballCounterActive: body.ballCounterActive,
      action: body.action,
      eventType: body.eventType,
      value: body.value,
    });
    return jsonOk(
      {
        deviceId: result.device.deviceId,
        enrolled: result.created,
        secret: result.secret,
        command: result.command,
      },
      result.created ? 201 : 200
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    if (message === "UNAUTHORIZED") return jsonError("Төхөөрөмжийн эрх хүрэхгүй", 401);
    if (message === "INVALID_DEVICE") return jsonError("Device ID буруу байна", 400);
    return jsonError(message, 400);
  }
}
