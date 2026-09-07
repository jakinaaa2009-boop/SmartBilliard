import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/models/Payment";
import { fulfillPaidInvoice } from "@/lib/session/engine";
import { jsonOk } from "@/lib/utils";
import { readJson } from "@/lib/api";

export async function POST(request: NextRequest) {
  await connectDB();
  const body = await readJson<{
    invoice_id?: string;
    qpay_payment_id?: string;
    sender_invoice_no?: string;
    payment_id?: string;
  }>(request);

  const payment = await Payment.findOne({
    $or: [
      { qpayInvoiceId: body.invoice_id },
      { _id: body.sender_invoice_no },
    ],
  });
  if (!payment) {
    return jsonOk({ message: "ignored" });
  }
  if (payment.status === "PAID") {
    return jsonOk({ message: "already processed" });
  }
  if (payment.amount <= 0) {
    return jsonOk({ message: "invalid amount" });
  }
  await fulfillPaidInvoice(String(payment._id), body.qpay_payment_id || body.payment_id);
  return jsonOk({ message: "ok" });
}
