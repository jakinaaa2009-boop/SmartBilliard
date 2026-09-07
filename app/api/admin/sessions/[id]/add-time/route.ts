import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { requireUser, httpError } from "@/lib/auth/guards";
import { addSessionTime } from "@/lib/session/engine";
import { writeAudit } from "@/lib/audit";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireUser(["ADMIN"]);
    const { id } = await params;
    const body = await readJson<{ minutes?: number; reason?: string }>(request);
    if (!body.reason || body.reason.trim().length < 3) return jsonError("Шалтгаан заавал оруулна уу");
    if (!body.minutes || body.minutes <= 0) return jsonError("Хугацаа буруу");
    await connectDB();
    const session = await addSessionTime({
      sessionId: id,
      minutes: body.minutes,
      source: "ADMIN",
      adminId: admin.id,
      reason: body.reason,
    });
    await writeAudit({
      adminId: admin.id,
      action: "ADD_SESSION_TIME",
      targetType: "Session",
      targetId: id,
      newValue: { minutes: body.minutes, expiresAt: session.expiresAt },
      reason: body.reason,
    });
    return jsonOk({ session: toObject(session) });
  } catch (error) {
    return httpError(error);
  }
}
