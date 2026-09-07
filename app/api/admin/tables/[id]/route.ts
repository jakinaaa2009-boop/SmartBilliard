import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Table } from "@/models/Table";
import { Device } from "@/models/Device";
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
    const table = asDoc(await Table.findById(id).lean());
    if (!table) return jsonError("Ширээ олдсонгүй", 404);
    const device = table.deviceId ? asDoc(await Device.findOne({ deviceId: table.deviceId }).lean()) : null;
    const session = asDoc(
      await Session.findOne({
        tableId: table._id,
        status: { $in: ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"] },
      }).lean()
    );
    const user = session ? asDoc(await User.findById(session.userId).select("fullName phone").lean()) : null;
    return jsonOk({
      table: { ...table, id: String(table._id) },
      device: device ? { ...device, id: String(device._id), secretHash: undefined } : null,
      session: session ? { ...session, id: String(session._id), user } : null,
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
    const body = await readJson<{
      name?: string;
      zone?: string;
      deviceId?: string;
      status?: string;
      expectedBallCount?: number;
      enabled?: boolean;
    }>(request);
    await connectDB();
    const table = await Table.findById(id);
    if (!table) return jsonError("Ширээ олдсонгүй", 404);
    const old = table.toObject();
    if (body.name) table.name = body.name;
    if (body.zone) table.zone = body.zone;
    if (body.deviceId !== undefined) table.deviceId = body.deviceId;
    if (body.status) table.status = body.status as typeof table.status;
    if (body.expectedBallCount) table.expectedBallCount = body.expectedBallCount;
    if (typeof body.enabled === "boolean") table.enabled = body.enabled;
    await table.save();
    if (body.deviceId) {
      await Device.findOneAndUpdate({ deviceId: body.deviceId }, { tableId: table._id });
    }
    await writeAudit({
      adminId: admin.id,
      action: "CHANGE_DEVICE",
      targetType: "Table",
      targetId: id,
      oldValue: old,
      newValue: table.toObject(),
    });
    return jsonOk({ table: toObject(table) });
  } catch (error) {
    return httpError(error);
  }
}
