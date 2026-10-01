import { Device } from "@/models/Device";
import { Table } from "@/models/Table";
import { Session } from "@/models/Session";
import { Payment } from "@/models/Payment";
import { SessionExtension } from "@/models/SessionExtension";
import { PricingPlan } from "@/models/PricingPlan";
import { getSettings } from "@/models/SystemSettings";
import { createAlert, resolveAlerts } from "@/lib/alerts";
import { openBoxThenClose, queueCommand } from "@/lib/iot/commands";
import { generateId } from "@/lib/utils";
import { publish } from "@/lib/realtime/sse";
import { createQPayInvoice } from "@/lib/qpay/client";
import { appUrl } from "@/lib/utils";
import { ensureDeviceReady } from "@/lib/session/setup";

export async function tableIsBookable(tableId: string) {
  const table = await Table.findById(tableId);
  if (!table || !table.enabled) return { ok: false, reason: "Ширээ идэвхгүй байна" };
  if (table.status === "MAINTENANCE") return { ok: false, reason: "Ширээ засвар хийгдэж байна" };
  if (table.status === "OFFLINE") return { ok: false, reason: "Төхөөрөмж оффлайн байна" };
  const active = await Session.findOne({
    tableId,
    status: { $in: ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"] },
  });
  if (active) return { ok: false, reason: "Ширээ ашиглагдаж байна" };
  return { ok: true, table };
}

export async function createInvoiceForPlan(input: {
  userId: string;
  deviceId: string;
  pricingPlanId: string;
  type: "SESSION" | "EXTENSION";
  sessionId?: string;
}) {
  const plan = await PricingPlan.findById(input.pricingPlanId);
  if (!plan || !plan.active) throw new Error("Үнийн багц олдсонгүй");
  const device = await ensureDeviceReady(input.deviceId);
  if (!device || !device.tableId) throw new Error("Төхөөрөмж олдсонгүй");
  const table = await Table.findById(device.tableId);
  if (!table) throw new Error("Ширээ олдсонгүй");

  if (input.type === "SESSION") {
    const bookable = await tableIsBookable(String(table._id));
    if (!bookable.ok) throw new Error(bookable.reason);
    table.status = "RESERVED";
    device.operationalState = "PAYMENT_PENDING";
    await table.save();
    await device.save();
  } else {
    if (!input.sessionId) throw new Error("Session шаардлагатай");
    const session = await Session.findById(input.sessionId);
    if (!session || String(session.userId) !== input.userId) {
      throw new Error("Сесс олдсонгүй");
    }
    if (!["ACTIVE", "EXTENDED"].includes(session.status)) {
      throw new Error("Энэ сессийг сунгах боломжгүй");
    }
  }

  const settings = await getSettings();
  const payment = await Payment.create({
    userId: input.userId,
    sessionId: input.sessionId,
    tableId: table._id,
    deviceId: device.deviceId,
    pricingPlanId: plan._id,
    type: input.type,
    amount: plan.price,
    provider: "QPAY",
    status: "PENDING",
    expiresAt: new Date(Date.now() + settings.paymentExpiryMinutes * 60 * 1000),
  });

  const invoice = await createQPayInvoice({
    senderInvoiceNo: String(payment._id),
    amount: plan.price,
    description: `${table.name} — ${plan.name}`,
    callbackUrl: `${appUrl()}/api/payments/qpay/callback`,
    forceMock: plan.durationMinutes <= 1,
  });

  payment.qpayInvoiceId = invoice.invoice_id;
  payment.qrImage = invoice.qr_image;
  payment.urls = invoice.urls;
  await payment.save();
  return payment;
}

export async function fulfillPaidInvoice(paymentId: string, qpayPaymentId?: string) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error("Payment not found");
  if (payment.callbackProcessed && payment.status === "PAID") {
    return { payment, session: payment.sessionId ? await Session.findById(payment.sessionId) : null };
  }
  if (payment.status === "EXPIRED" || payment.status === "CANCELLED") {
    throw new Error("Төлбөрийн хугацаа дууссан");
  }

  payment.status = "PAID";
  payment.paidAt = new Date();
  payment.qpayPaymentId = qpayPaymentId;
  payment.callbackProcessed = true;

  if (payment.type === "SESSION") {
    const bookable = await tableIsBookable(String(payment.tableId));
    if (!bookable.ok) {
      payment.flaggedForReview = true;
      payment.reviewReason = bookable.reason || "Table no longer available";
      await payment.save();
      await createAlert({
        type: "PAYMENT_FAILED",
        severity: "WARNING",
        tableId: String(payment.tableId),
        userId: String(payment.userId),
        message: `Төлбөр орсон боловч ширээ боломжгүй: ${bookable.reason}`,
      });
      return { payment, session: null, flagged: true };
    }

    const plan = payment.pricingPlanId
      ? await PricingPlan.findById(payment.pricingPlanId)
      : null;
    const minutes = plan?.durationMinutes || 60;
    const device = await Device.findOne({ deviceId: payment.deviceId });
    const table = await Table.findById(payment.tableId);
    if (!device || !table) throw new Error("Device/table missing");

    const now = new Date();
    const session = await Session.create({
      sessionCode: generateId("SES"),
      userId: payment.userId,
      tableId: payment.tableId,
      deviceId: device.deviceId,
      status: "ACTIVE",
      startedAt: now,
      expiresAt: new Date(now.getTime() + minutes * 60 * 1000),
      purchasedMinutes: minutes,
      totalAmount: payment.amount,
      expectedBallCount: table.expectedBallCount,
      returnedBallCount: 0,
    });
    payment.sessionId = session._id;
    await payment.save();

    table.status = "ACTIVE";
    device.operationalState = "OPENING";
    device.detectedBallCount = 0;
    await table.save();
    await device.save();
    await openBoxThenClose(device.deviceId, 15000);
    device.operationalState = "IN_USE";
    await device.save();

    publish(`session:${String(session._id)}`, { type: "started" });
    publish("admin", { type: "session.started", sessionId: String(session._id) });
    return { payment, session };
  }

  if (payment.type === "EXTENSION") {
    const session = await Session.findById(payment.sessionId);
    if (!session) throw new Error("Session not found");
    const plan = payment.pricingPlanId
      ? await PricingPlan.findById(payment.pricingPlanId)
      : null;
    const minutes = plan?.durationMinutes || 30;
    const base = session.expiresAt && session.expiresAt > new Date() ? session.expiresAt : new Date();
    session.expiresAt = new Date(base.getTime() + minutes * 60 * 1000);
    session.purchasedMinutes += minutes;
    session.totalAmount += payment.amount;
    session.status = "EXTENDED";
    await session.save();
    await SessionExtension.create({
      sessionId: session._id,
      addedMinutes: minutes,
      amount: payment.amount,
      paymentId: payment._id,
      source: "CLIENT",
    });
    await payment.save();
    publish(`session:${String(session._id)}`, {
      type: "extended",
      addedMinutes: minutes,
    });
    return { payment, session };
  }

  await payment.save();
  return { payment, session: null };
}

export async function expirePendingPayments() {
  const expired = await Payment.find({
    status: { $in: ["PENDING", "PROCESSING"] },
    expiresAt: { $lte: new Date() },
  });
  for (const payment of expired) {
    payment.status = "EXPIRED";
    await payment.save();
    if (payment.type === "SESSION") {
      const table = await Table.findById(payment.tableId);
      const active = await Session.findOne({
        tableId: payment.tableId,
        status: { $in: ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"] },
      });
      if (table && table.status === "RESERVED" && !active) {
        table.status = "AVAILABLE";
        await table.save();
      }
      if (payment.deviceId) {
        await Device.findOneAndUpdate(
          { deviceId: payment.deviceId, operationalState: "PAYMENT_PENDING" },
          { operationalState: "AVAILABLE" }
        );
      }
    }
  }
}

export async function expireActiveSessions() {
  const now = new Date();
  const due = await Session.find({
    status: { $in: ["ACTIVE", "EXTENDED"] },
    expiresAt: { $lte: now },
  });
  for (const session of due) {
    session.status = "RETURN_REQUIRED";
    session.returnRequiredAt = now;
    session.returnedBallCount = 0;
    await session.save();
    await Table.findByIdAndUpdate(session.tableId, { status: "RETURN_REQUIRED" });
    await Device.findOneAndUpdate(
      { deviceId: session.deviceId },
      { operationalState: "RETURN_REQUIRED", detectedBallCount: 0 }
    );
    await queueCommand({ deviceId: session.deviceId, command: "START_BALL_COUNT" });
    publish(`session:${String(session._id)}`, { type: "return_required" });
    publish("admin", { type: "session.return_required", sessionId: String(session._id) });
  }
}

export async function processBallReturnAlarms() {
  const settings = await getSettings();
  const sessions = await Session.find({ status: "RETURN_REQUIRED" });
  for (const session of sessions) {
    const delaySeconds = session.purchasedMinutes <= 1 ? 20 : settings.ballReturnAlarmDelaySeconds;
    if (!session.returnRequiredAt || session.returnRequiredAt.getTime() > Date.now() - delaySeconds * 1000) {
      continue;
    }
    const device = await Device.findOne({ deviceId: session.deviceId });
    const missing = (device?.expectedBallCount || session.expectedBallCount) - (device?.detectedBallCount || 0);
    if (missing <= 0) {
      await completeSessionIfReturned(session.deviceId);
      continue;
    }
    session.status = "BALLS_MISSING";
    session.returnedBallCount = device?.detectedBallCount || 0;
    session.alarmTriggeredAt = new Date();
    await session.save();
    await queueCommand({ deviceId: session.deviceId, command: "START_ALARM" });
    await Device.findOneAndUpdate(
      { deviceId: session.deviceId },
      { operationalState: "ALARM", alarmStatus: true }
    );
    await createAlert({
      type: "BALL_MISSING",
      severity: "CRITICAL",
      deviceId: session.deviceId,
      tableId: String(session.tableId),
      sessionId: String(session._id),
      userId: String(session.userId),
      message: `${missing} бөмбөг дутуу байна`,
      metadata: {
        returned: device?.detectedBallCount || 0,
        expected: session.expectedBallCount,
      },
    });
    publish(`session:${String(session._id)}`, { type: "balls_missing" });
  }
}

export async function syncBallReturn(deviceId: string, detected: number) {
  const session = await Session.findOne({
    deviceId,
    status: { $in: ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"] },
  });
  if (!session) return;
  session.returnedBallCount = detected;
  await session.save();
  publish(`session:${String(session._id)}`, {
    type: "balls",
    returned: detected,
    expected: session.expectedBallCount,
  });
}

export async function completeSessionIfReturned(deviceId: string) {
  const session = await Session.findOne({
    deviceId,
    status: { $in: ["RETURN_REQUIRED", "BALLS_MISSING"] },
  });
  if (!session) return null;
  const device = await Device.findOne({ deviceId });
  if (!device) return null;
  if (device.detectedBallCount < session.expectedBallCount) return null;

  session.status = "COMPLETED";
  session.completedAt = new Date();
  session.returnedBallCount = device.detectedBallCount;
  await session.save();
  await Table.findByIdAndUpdate(session.tableId, { status: "AVAILABLE" });
  device.operationalState = "AVAILABLE";
  device.alarmStatus = false;
  await device.save();
  await queueCommand({ deviceId, command: "STOP_ALARM" });
  await resolveAlerts({ type: "BALL_MISSING", sessionId: String(session._id) });
  await resolveAlerts({ type: "ALARM_ACTIVE", deviceId });
  publish(`session:${String(session._id)}`, { type: "completed" });
  publish("admin", { type: "session.completed", sessionId: String(session._id) });
  return session;
}

export async function endSession(sessionId: string, options?: { forceComplete?: boolean }) {
  const session = await Session.findById(sessionId);
  if (!session) throw new Error("Сесс олдсонгүй");
  if (["COMPLETED", "CANCELLED"].includes(session.status)) return session;
  const device = await Device.findOne({ deviceId: session.deviceId });
  const ballsOk = (device?.detectedBallCount || 0) >= session.expectedBallCount;
  if (ballsOk || options?.forceComplete) {
    session.status = "COMPLETED";
    session.completedAt = new Date();
    session.returnedBallCount = device?.detectedBallCount || session.returnedBallCount;
    await session.save();
    await Table.findByIdAndUpdate(session.tableId, { status: "AVAILABLE" });
    if (device) {
      device.operationalState = "AVAILABLE";
      device.alarmStatus = false;
      await device.save();
      await queueCommand({ deviceId: device.deviceId, command: "STOP_ALARM" });
    }
    await resolveAlerts({ sessionId: String(session._id) });
    publish(`session:${String(session._id)}`, { type: "completed" });
    return session;
  }
  session.status = "RETURN_REQUIRED";
  session.returnRequiredAt = new Date();
  session.expiresAt = new Date();
  await session.save();
  await Table.findByIdAndUpdate(session.tableId, { status: "RETURN_REQUIRED" });
  if (device) {
    device.operationalState = "RETURN_REQUIRED";
    await device.save();
  }
  publish(`session:${String(session._id)}`, { type: "return_required" });
  return session;
}

export async function addSessionTime(input: {
  sessionId: string;
  minutes: number;
  source: "CLIENT" | "ADMIN";
  adminId?: string;
  reason?: string;
  amount?: number;
  paymentId?: string;
}) {
  const session = await Session.findById(input.sessionId);
  if (!session) throw new Error("Сесс олдсонгүй");
  const base = session.expiresAt && session.expiresAt > new Date() ? session.expiresAt : new Date();
  session.expiresAt = new Date(base.getTime() + input.minutes * 60 * 1000);
  session.purchasedMinutes += input.minutes;
  if (input.amount) session.totalAmount += input.amount;
  if (session.status === "ACTIVE") session.status = "EXTENDED";
  if (session.status === "RETURN_REQUIRED" || session.status === "BALLS_MISSING") {
    session.status = "EXTENDED";
    session.returnRequiredAt = undefined;
    await Table.findByIdAndUpdate(session.tableId, { status: "ACTIVE" });
    await Device.findOneAndUpdate(
      { deviceId: session.deviceId },
      { operationalState: "IN_USE", alarmStatus: false }
    );
    await queueCommand({ deviceId: session.deviceId, command: "STOP_ALARM" });
    await resolveAlerts({ type: "BALL_MISSING", sessionId: String(session._id) });
  }
  await session.save();
  await SessionExtension.create({
    sessionId: session._id,
    addedMinutes: input.minutes,
    amount: input.amount || 0,
    paymentId: input.paymentId,
    source: input.source,
    adminId: input.adminId,
    reason: input.reason,
  });
  publish(`session:${String(session._id)}`, {
    type: "extended",
    addedMinutes: input.minutes,
  });
  return session;
}
