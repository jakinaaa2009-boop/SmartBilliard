import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { PricingPlan } from "@/models/PricingPlan";
import { Session } from "@/models/Session";
import { requireUser, httpError } from "@/lib/auth/guards";
import { checkQPayPayment } from "@/lib/qpay/client";
import { fulfillPaidInvoice } from "@/lib/session/engine";
import { jsonError, jsonOk, toObject } from "@/lib/utils";
import { asDoc } from "@/lib/db/as-doc";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await connectDB();
    const payment = await Payment.findById(id);
    if (!payment) return jsonError("Төлбөр олдсонгүй", 404);
    if (String(payment.userId) !== user.id && user.role !== "ADMIN") {
      return jsonError("Эрх хүрэхгүй", 403);
    }
    const mockInvoice = String(payment.qpayInvoiceId || "").startsWith("INV-");
    if (payment.status === "PENDING" && payment.qpayInvoiceId && !mockInvoice) {
      try {
        const check = await checkQPayPayment(payment.qpayInvoiceId);
        if (check.paid) {
          await fulfillPaidInvoice(String(payment._id), check.payment_id || undefined);
          await payment.save();
        }
      } catch {
        // QPay шалгалт унасан ч нэхэмжлэхийн төлөвийг буцаана.
      }
    }
    const fresh = await Payment.findById(id);
    const plan = fresh?.pricingPlanId ? await PricingPlan.findById(fresh.pricingPlanId) : null;
    const session = fresh?.sessionId ? asDoc(await Session.findById(fresh.sessionId).lean()) : null;
    return jsonOk({
      payment: toObject(fresh),
      session: session ? { ...session, id: String(session._id) } : null,
      test: (plan?.durationMinutes || 0) <= 1,
    });
  } catch (error) {
    return httpError(error);
  }
}
