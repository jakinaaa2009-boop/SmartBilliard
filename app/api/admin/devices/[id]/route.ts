import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Device } from "@/models/Device";
import { Table } from "@/models/Table";
import { DeviceLog } from "@/models/DeviceLog";
import { DeviceCommand } from "@/models/DeviceCommand";
import { Session } from "@/models/Session";
import { User } from "@/models/User";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { asDoc } from "@/lib/db/as-doc";
import { readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser(["ADMIN"]);
    const { id } = await params;
    await connectDB();
    const device = asDoc(
      (await Device.findById(id).lean()) || (await Device.findOne({ deviceId: id.toUpperCase() }).lean())
    );
    if (!device) return jsonError("Төхөөрөмж олдсонгүй", 404);
    const table = asDoc(
      device.tableId
        ? await Table.findById(device.tableId).lean()
        : await Table.findOne({ deviceId: device.deviceId }).lean()
    );
    const session = asDoc(
      await Session.findOne({
        deviceId: device.deviceId,
        status: { $in: ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"] },
      }).lean()
    );
    const user = session ? asDoc(await User.findById(session.userId).select("fullName phone").lean()) : null;
    const logs = await DeviceLog.find({ deviceId: device.deviceId }).sort({ createdAt: -1 }).limit(30).lean();
    const commands = await DeviceCommand.find({ deviceId: device.deviceId }).sort({ createdAt: -1 }).limit(20).lean();
    return jsonOk({
      device: { ...device, id: String(device._id), secretHash: undefined },
      table,
      session: session ? { ...session, id: String(session._id), user } : null,
      logs,
      commands,
    });
  } catch (error) {
    return httpError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const { id } = await params;
    const body = await readJson<Record<string, unknown>>(request);
    await connectDB();
    const device = (await Device.findById(id)) || (await Device.findOne({ deviceId: String(id).toUpperCase() }));
    if (!device) return jsonError("Төхөөрөмж олдсонгүй", 404);
    const old = device.toObject();
    const fields = ["name", "expectedBallCount", "relayOpenDuration", "alarmDelaySeconds", "tableId"] as const;
    for (const field of fields) {
      if (body[field] !== undefined) {
        (device as unknown as Record<string, unknown>)[field] = body[field];
      }
    }
    await device.save();
    await writeAudit({
      adminId: admin.id,
      action: "CHANGE_DEVICE",
      targetType: "Device",
      targetId: device.deviceId,
      oldValue: old,
      newValue: device.toObject(),
    });
    return jsonOk({ device: toObject(device) });
  } catch (error) {
    return httpError(error);
  }
}
