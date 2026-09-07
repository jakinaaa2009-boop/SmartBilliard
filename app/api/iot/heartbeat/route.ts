import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { heartbeatSchema } from "@/lib/validation/schemas";
import { authenticateDevice } from "@/lib/iot/auth";
import { applyHeartbeat } from "@/lib/iot/heartbeat";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await readJson(request);
    const parsed = heartbeatSchema.safeParse(body);
    if (!parsed.success) return jsonError("Буруу өгөгдөл");
    await authenticateDevice(request, parsed.data.deviceId);
    const device = await applyHeartbeat(parsed.data);
    return jsonOk({ device: toObject(device) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "DEVICE_NOT_FOUND" ? 404 : 400;
    return jsonError(message === "UNAUTHORIZED" ? "Төхөөрөмжийн эрх хүрэхгүй" : message, status);
  }
}
