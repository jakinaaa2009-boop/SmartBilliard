import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { label: string; variant: "success" | "warning" | "danger" | "muted" | "default" }> = {
  AVAILABLE: { label: "Боломжтой", variant: "success" },
  ACTIVE: { label: "Идэвхтэй", variant: "success" },
  EXTENDED: { label: "Сунгасан", variant: "default" },
  ONLINE: { label: "Онлайн", variant: "success" },
  OFFLINE: { label: "Оффлайн", variant: "danger" },
  LOCKED: { label: "Хаалттай", variant: "muted" },
  UNLOCKED: { label: "Нээгдсэн", variant: "warning" },
  RETURN_REQUIRED: { label: "Буцаах", variant: "warning" },
  BALLS_MISSING: { label: "Бөмбөг дутуу", variant: "danger" },
  COMPLETED: { label: "Дууссан", variant: "muted" },
  PAID: { label: "Төлсөн", variant: "success" },
  PENDING: { label: "Хүлээгдэж буй", variant: "warning" },
  FAILED: { label: "Амжилтгүй", variant: "danger" },
  EXPIRED: { label: "Хугацаа дууссан", variant: "muted" },
  MAINTENANCE: { label: "Засвар", variant: "warning" },
  RESERVED: { label: "Захиалсан", variant: "warning" },
  OPEN: { label: "Нээлттэй", variant: "danger" },
  ACKNOWLEDGED: { label: "Шалгасан", variant: "warning" },
  RESOLVED: { label: "Шийдсэн", variant: "success" },
  BLOCKED: { label: "Хаагдсан", variant: "danger" },
  PROCESSING: { label: "Боловсруулж байна", variant: "warning" },
  CANCELLED: { label: "Цуцлагдсан", variant: "muted" },
  CRITICAL: { label: "CRITICAL", variant: "danger" },
  WARNING: { label: "WARNING", variant: "warning" },
};

export function StatusBadge({ value }: { value: string }) {
  const item = MAP[value] || { label: value, variant: "muted" as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
