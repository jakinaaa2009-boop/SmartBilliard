import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { requireUser, httpError } from "@/lib/auth/guards";
import { addSessionTime, endSession } from "@/lib/session/engine";
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
    const body = await readJson<{
      action: "add-time" | "end";
      minutes?: number;
      reason?: string;
    }>(request);
    if (!body.reason || body.reason.trim().length < 3) {
      return jsonError("Шалтгаан заавал оруулна уу");
    }
    await connectDB();
    if (body.action === "add-time") {
      if (!body.minutes || body.minutes <= 0) return jsonError("Хугацаа буруу");
      const session = await addSessionTime({
        sessionId: id,
        minutes: body.minutes,
        source: "ADMIN",
        adminId: admin.id,
        reason: body.reason,
        amount: 0,
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
    }
    const session = await endSession(id);
    await writeAudit({
      adminId: admin.id,
      action: "END_SESSION",
      targetType: "Session",
      targetId: id,
      newValue: { status: session.status },
      reason: body.reason,
    });
    return jsonOk({ session: toObject(session) });
  } catch (error) {
    return httpError(error);
  }
}
