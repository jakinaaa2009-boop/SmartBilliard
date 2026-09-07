import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { authenticateDevice } from "@/lib/iot/auth";
import { completeCommand } from "@/lib/iot/commands";
import { jsonError, jsonOk } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    await connectDB();
    await authenticateDevice(request, deviceId);
    const body = await readJson<{ commandId: string; success: boolean; result?: Record<string, unknown> }>(request);
    if (!body.commandId) return jsonError("commandId шаардлагатай");
    const cmd = await completeCommand(deviceId.toUpperCase(), body.commandId, Boolean(body.success), body.result);
    if (!cmd) return jsonError("Команд олдсонгүй", 404);
    return jsonOk({ command: { commandId: cmd.commandId, status: cmd.status } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return jsonError(message, 401);
  }
}
