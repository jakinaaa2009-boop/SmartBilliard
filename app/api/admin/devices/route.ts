import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Device } from "@/models/Device";
import { Table } from "@/models/Table";
import { requireUser, httpError } from "@/lib/auth/guards";
import { hashSecret } from "@/lib/auth/password";
import { writeAudit } from "@/lib/audit";
import { generateSecret, jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson, query } from "@/lib/api";
import { getSettings } from "@/models/SystemSettings";

export async function GET(request: NextRequest) {
  try {
    await requireUser(["ADMIN"]);
    await connectDB();
    const q = query(request);
    const filter: Record<string, unknown> = {};
    if (q.filter === "online") filter.status = "ONLINE";
    if (q.filter === "offline") filter.status = "OFFLINE";
    if (q.filter === "warning") {
      filter.$or = [{ alarmStatus: true }, { operationalState: { $in: ["BALLS_MISSING", "ALARM", "OFFLINE"] } }];
    }
    const devices = await Device.find(filter).sort({ deviceId: 1 }).lean();
    const tables = await Table.find().lean();
    const tm = new Map(tables.map((t) => [String(t._id), t]));
    return jsonOk({
      devices: devices.map((d) => ({
        ...d,
        id: String(d._id),
        secretHash: undefined,
        table: (() => {
          const table = d.tableId ? tm.get(String(d.tableId)) : tables.find((t) => t.deviceId === d.deviceId);
          return table ? { ...table, id: String(table._id) } : null;
        })(),
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
      name: string;
      deviceId: string;
      tableId?: string;
      expectedBallCount?: number;
      relayOpenDuration?: number;
      alarmDelaySeconds?: number;
    }>(request);
    if (!body.name || !body.deviceId) return jsonError("Нэр болон Device ID шаардлагатай");
    await connectDB();
    const exists = await Device.findOne({ deviceId: body.deviceId.toUpperCase() });
    if (exists) return jsonError("Device ID бүртгэлтэй байна", 409);
    const settings = await getSettings();
    const secret = generateSecret(32);
    const device = await Device.create({
      name: body.name,
      deviceId: body.deviceId.toUpperCase(),
      tableId: body.tableId || undefined,
      expectedBallCount: body.expectedBallCount || 8,
      detectedBallCount: body.expectedBallCount || 8,
      secretHash: await hashSecret(secret),
      relayOpenDuration: body.relayOpenDuration || settings.defaultOpeningDurationMs,
      alarmDelaySeconds: body.alarmDelaySeconds || settings.ballReturnAlarmDelaySeconds,
      status: "OFFLINE",
      operationalState: "OFFLINE",
      boxStatus: "LOCKED",
    });
    if (body.tableId) {
      await Table.findByIdAndUpdate(body.tableId, { deviceId: device.deviceId });
    }
    await writeAudit({
      adminId: admin.id,
      action: "CHANGE_DEVICE",
      targetType: "Device",
      targetId: device.deviceId,
      newValue: { name: device.name },
    });
    return jsonOk({ device: toObject(device), secret }, 201);
  } catch (error) {
    return httpError(error);
  }
}
