import { NextRequest } from "next/server";
import { requireUser, httpError } from "@/lib/auth/guards";
import { createInvoiceForPlan } from "@/lib/session/engine";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { readJson } from "@/lib/api";
import { connectDB } from "@/lib/db/mongoose";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readJson<{ deviceId: string; pricingPlanId: string }>(request);
    await connectDB();
    const payment = await createInvoiceForPlan({
      userId: user.id,
      deviceId: body.deviceId,
      pricingPlanId: body.pricingPlanId,
      type: "SESSION",
    });
    return jsonOk({ payment: toObject(payment) }, 201);
  } catch (error) {
    if (error instanceof Error && !["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)) {
      return jsonError(error.message, 400);
    }
    return httpError(error);
  }
}
