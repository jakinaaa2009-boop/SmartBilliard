import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Session } from "@/models/Session";
import { requireUser, httpError } from "@/lib/auth/guards";
import { createInvoiceForPlan } from "@/lib/session/engine";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await readJson<{ pricingPlanId: string }>(request);
    await connectDB();
    const session = await Session.findById(id);
    if (!session) return jsonError("Сесс олдсонгүй", 404);
    if (String(session.userId) !== user.id) return jsonError("Эрх хүрэхгүй", 403);
    const payment = await createInvoiceForPlan({
      userId: user.id,
      deviceId: session.deviceId,
      pricingPlanId: body.pricingPlanId,
      type: "EXTENSION",
      sessionId: String(session._id),
    });
    return jsonOk({ payment: toObject(payment) }, 201);
  } catch (error) {
    if (error instanceof Error && !["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)) {
      return jsonError(error.message, 400);
    }
    return httpError(error);
  }
}
