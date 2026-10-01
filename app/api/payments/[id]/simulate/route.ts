import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { PricingPlan } from "@/models/PricingPlan";
import { requireUser, httpError } from "@/lib/auth/guards";
import { fulfillPaidInvoice } from "@/lib/session/engine";
import { isMockPaymentEnabled, jsonError, jsonOk, toObject } from "@/lib/utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await connectDB();
    const payment = await Payment.findById(id);
    if (!payment) return jsonError("Төлбөр олдсонгүй", 404);
    const plan = payment.pricingPlanId ? await PricingPlan.findById(payment.pricingPlanId) : null;
    const testPlan = (plan?.durationMinutes || 0) <= 1;
    if (!isMockPaymentEnabled() && !testPlan) {
      return jsonError("Mock төлбөр идэвхгүй байна", 403);
    }
    if (String(payment.userId) !== user.id && user.role !== "ADMIN") {
      return jsonError("Эрх хүрэхгүй", 403);
    }
    const result = await fulfillPaidInvoice(String(payment._id), "MOCK-PAY");
    return jsonOk({
      payment: toObject(result.payment),
      session: result.session ? toObject(result.session) : null,
    });
  } catch (error) {
    if (error instanceof Error && !["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)) {
      return jsonError(error.message, 400);
    }
    return httpError(error);
  }
}
