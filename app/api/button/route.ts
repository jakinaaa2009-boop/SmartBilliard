import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { announceDevice } from "@/lib/iot/announce";
import { jsonError, jsonOk } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await readJson<{
      device?: string;
      deviceId?: string;
      action?: string;
      eventType?: number;
      value?: number;
    }>(request);
    const header = request.headers.get("authorization") || "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    const result = await announceDevice({
      deviceId: body.deviceId || body.device || "",
      token: token || undefined,
      action: body.action || "button_pressed",
      eventType: body.eventType,
      value: body.value,
      ballCount: body.action === "ball_detected" ? body.value : undefined,
      firmwareVersion: "button",
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
