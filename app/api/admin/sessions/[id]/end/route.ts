import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { requireUser, httpError } from "@/lib/auth/guards";
import { endSession } from "@/lib/session/engine";
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
    const body = await readJson<{ reason?: string }>(request);
    if (!body.reason || body.reason.trim().length < 3) return jsonError("Шалтгаан заавал оруулна уу");
    await connectDB();
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
