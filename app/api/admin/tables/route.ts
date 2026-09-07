import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Table } from "@/models/Table";
import { Device } from "@/models/Device";
import { requireUser, httpError } from "@/lib/auth/guards";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  try {
    await requireUser(["ADMIN"]);
    await connectDB();
    const tables = await Table.find().sort({ number: 1 }).lean();
    const devices = await Device.find().lean();
    const dm = new Map(devices.map((d) => [d.deviceId, d]));
    return jsonOk({
      tables: tables.map((t) => ({
        ...t,
        id: String(t._id),
        device: t.deviceId ? dm.get(t.deviceId) : null,
      })),
    });
  } catch (error) {
    return httpError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const body = await readJson<{
      number: number;
      name?: string;
      zone?: string;
      deviceId?: string;
      expectedBallCount?: number;
      status?: string;
    }>(request);
    if (!body.number) return jsonError("Ширээний дугаар шаардлагатай");
    await connectDB();
    const table = await Table.create({
      number: body.number,
      name: body.name || `Ширээ №${body.number}`,
      zone: body.zone || "Main",
      deviceId: body.deviceId,
      expectedBallCount: body.expectedBallCount || 8,
      status: body.status || "AVAILABLE",
      enabled: true,
    });
    if (body.deviceId) {
      await Device.findOneAndUpdate({ deviceId: body.deviceId }, { tableId: table._id });
    }
    await writeAudit({
      adminId: admin.id,
      action: "CHANGE_DEVICE",
      targetType: "Table",
      targetId: String(table._id),
      newValue: table.toObject(),
    });
    return jsonOk({ table: toObject(table) }, 201);
  } catch (error) {
    return httpError(error);
  }
}
