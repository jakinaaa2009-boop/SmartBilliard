import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { requireUser, httpError } from "@/lib/auth/guards";
import { createInvoiceForPlan } from "@/lib/session/engine";
import { jsonError, jsonOk, isMockPaymentEnabled, toObject } from "@/lib/utils";
import { createPaymentSchema } from "@/lib/validation/schemas";
import { readJson } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) return jsonError(parsed.error.errors[0]?.message || "Буруу өгөгдөл");
    await connectDB();
    const payment = await createInvoiceForPlan({
      userId: user.id,
      deviceId: parsed.data.deviceId,
      pricingPlanId: parsed.data.pricingPlanId,
      type: parsed.data.type,
      sessionId: parsed.data.sessionId,
    });
    return jsonOk({
      payment: toObject(payment),
      mock: isMockPaymentEnabled(),
    }, 201);
  } catch (error) {
    if (error instanceof Error && ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)) {
      return httpError(error);
    }
    return jsonError(error instanceof Error ? error.message : "Алдаа гарлаа", 400);
  }
}
