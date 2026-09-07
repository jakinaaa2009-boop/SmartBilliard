import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { requireUser, httpError } from "@/lib/auth/guards";
import { queueCommand } from "@/lib/iot/commands";
import { Device } from "@/models/Device";
import { writeAudit } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const { id } = await params;
    const body = await readJson<{ on?: boolean; reason?: string }>(request);
    await connectDB();
    const device = (await Device.findById(id)) || (await Device.findOne({ deviceId: id.toUpperCase() }));
    if (!device) return jsonError("Төхөөрөмж олдсонгүй", 404);
    const on = body.on !== false;
    await queueCommand({ deviceId: device.deviceId, command: on ? "START_ALARM" : "STOP_ALARM" });
    await writeAudit({
      adminId: admin.id,
      action: on ? "START_ALARM" : "STOP_ALARM",
      targetType: "Device",
      targetId: device.deviceId,
      reason: body.reason,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return httpError(error);
  }
}
