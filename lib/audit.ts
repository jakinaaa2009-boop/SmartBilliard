import { AuditLog } from "@/models/AuditLog";

export async function writeAudit(input: {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}) {
  await AuditLog.create({
    adminId: input.adminId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    oldValue: input.oldValue,
    newValue: input.newValue,
    reason: input.reason,
    timestamp: new Date(),
  });
}
