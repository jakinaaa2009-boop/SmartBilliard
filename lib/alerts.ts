import { Alert } from "@/models/Alert";
import { publish } from "@/lib/realtime/sse";
import type { AlertSeverity, AlertType } from "@/types";

export async function createAlert(input: {
  type: AlertType;
  severity?: AlertSeverity;
  deviceId?: string;
  tableId?: string;
  sessionId?: string;
  userId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await Alert.findOne({
    type: input.type,
    deviceId: input.deviceId,
    sessionId: input.sessionId,
    status: { $in: ["OPEN", "ACKNOWLEDGED"] },
  });
  if (existing) {
    existing.message = input.message;
    existing.metadata = input.metadata;
    existing.severity = input.severity || existing.severity;
    await existing.save();
    publish("admin", { type: "alert.updated", alertId: String(existing._id) });
    return existing;
  }

  const alert = await Alert.create({
    type: input.type,
    severity: input.severity || (input.type === "BALL_MISSING" ? "CRITICAL" : "WARNING"),
    deviceId: input.deviceId,
    tableId: input.tableId,
    sessionId: input.sessionId,
    userId: input.userId,
    message: input.message,
    metadata: input.metadata,
    status: "OPEN",
  });
  publish("admin", { type: "alert.created", alertId: String(alert._id) });
  return alert;
}

export async function resolveAlerts(filter: {
  type?: AlertType;
  deviceId?: string;
  sessionId?: string;
}) {
  await Alert.updateMany(
    { ...filter, status: { $in: ["OPEN", "ACKNOWLEDGED"] } },
    { status: "RESOLVED", resolvedAt: new Date() }
  );
}
