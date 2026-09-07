import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { authenticateDevice } from "@/lib/iot/auth";
import { nextPendingCommand, queueCommand } from "@/lib/iot/commands";
import { jsonError, jsonOk } from "@/lib/utils";
import { readJson } from "@/lib/api";
import { commandSchema } from "@/lib/validation/schemas";
import { requireUser, httpError } from "@/lib/auth/guards";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    await connectDB();
    await authenticateDevice(request, deviceId);
    const command = await nextPendingCommand(deviceId.toUpperCase());
    return jsonOk({ command });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    return jsonError(message === "UNAUTHORIZED" ? "Төхөөрөмжийн эрх хүрэхгүй" : message, 401);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    await requireUser(["ADMIN"]);
    const { deviceId } = await params;
    const body = await readJson(request);
    const parsed = commandSchema.safeParse(body);
    if (!parsed.success) return jsonError("Буруу команд");
    await connectDB();
    const cmd = await queueCommand({
      deviceId: deviceId.toUpperCase(),
      command: parsed.data.command,
      duration: parsed.data.duration,
    });
    return jsonOk({ command: cmd });
  } catch (error) {
    return httpError(error);
  }
}
