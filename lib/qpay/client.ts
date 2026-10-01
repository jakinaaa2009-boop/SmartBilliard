import QRCode from "qrcode";
import { appUrl, generateId, isMockPaymentEnabled } from "@/lib/utils";

interface CreateInvoiceInput {
  senderInvoiceNo: string;
  amount: number;
  description: string;
  callbackUrl?: string;
  forceMock?: boolean;
}

interface QPayInvoice {
  invoice_id: string;
  qr_text: string;
  qr_image: string;
  urls?: { name: string; description?: string; logo?: string; link: string }[];
}

async function qpayToken() {
  const username = process.env.QPAY_USERNAME;
  const password = process.env.QPAY_PASSWORD;
  const base = process.env.QPAY_BASE_URL || "https://merchant.qpay.mn/v2";
  if (!username || !password) {
    throw new Error("QPay credentials are not configured");
  }
  const res = await fetch(`${base}/auth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  if (!res.ok) {
    throw new Error("QPay authentication failed");
  }
  const data = await res.json();
  return data.access_token as string;
}

export async function createQPayInvoice(input: CreateInvoiceInput): Promise<QPayInvoice> {
  if (input.forceMock || isMockPaymentEnabled()) {
    const invoiceId = generateId("INV");
    const payUrl = `${appUrl()}/payment/${input.senderInvoiceNo}`;
    const qr_image = await QRCode.toDataURL(payUrl, {
      margin: 1,
      width: 320,
      color: { dark: "#080C0E", light: "#ffffff" },
    });
    return {
      invoice_id: invoiceId,
      qr_text: payUrl,
      qr_image,
      urls: [
        { name: "Khan bank", link: payUrl },
        { name: "Golomt", link: payUrl },
        { name: "TDB", link: payUrl },
        { name: "State bank", link: payUrl },
      ],
    };
  }

  const token = await qpayToken();
  const base = process.env.QPAY_BASE_URL || "https://merchant.qpay.mn/v2";
  const invoiceCode = process.env.QPAY_INVOICE_CODE;
  if (!invoiceCode) throw new Error("QPAY_INVOICE_CODE is not set");

  const res = await fetch(`${base}/invoice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoice_code: invoiceCode,
      sender_invoice_no: input.senderInvoiceNo,
      invoice_receiver_code: "terminal",
      invoice_description: input.description,
      amount: input.amount,
      callback_url: input.callbackUrl || process.env.QPAY_CALLBACK_URL,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QPay invoice failed: ${text}`);
  }
  return res.json();
}

export async function checkQPayPayment(invoiceId: string) {
  if (isMockPaymentEnabled()) {
    return { paid: false, payment_id: null, amount: null };
  }
  const token = await qpayToken();
  const base = process.env.QPAY_BASE_URL || "https://merchant.qpay.mn/v2";
  const res = await fetch(`${base}/payment/check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ object_type: "INVOICE", object_id: invoiceId }),
  });
  if (!res.ok) return { paid: false, payment_id: null, amount: null };
  const data = await res.json();
  const rows = data.rows || data.list || [];
  const paidRow = rows.find((r: { payment_status?: string }) => r.payment_status === "PAID");
  return {
    paid: Boolean(paidRow) || data.count > 0,
    payment_id: paidRow?.payment_id || data.payment_id,
    amount: paidRow?.payment_amount || data.paid_amount,
    raw: data,
  };
}
