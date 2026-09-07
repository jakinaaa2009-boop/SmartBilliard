"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { relativeTime } from "@/lib/utils";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    type: string;
    severity: string;
    message: string;
    status: string;
    createdAt: string;
    deviceId?: string;
    table?: { name: string };
    user?: { fullName: string; phone: string };
    session?: { sessionCode: string };
  }>>([]);
  const [status, setStatus] = useState("OPEN");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api<{ alerts: typeof alerts }>(`/api/admin/alerts?status=${status}`);
    setAlerts(res.alerts);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, [status]);

  async function ack(id: string) {
    await api(`/api/admin/alerts?id=${id}&status=ACKNOWLEDGED`, { method: "PATCH" });
    toast.success("Шалгасан");
    void load();
  }

  return (
    <div>
      <PageHeader title="Анхааруулга" />
      <div className="mb-4 flex gap-2">
        {["OPEN", "ACKNOWLEDGED", "RESOLVED", "all"].map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "secondary"} onClick={() => setStatus(s)}>
            {s}
          </Button>
        ))}
      </div>
      {loading ? <LoadingSkeleton /> : null}
      {!loading && !alerts.length ? <EmptyState title="Анхааруулга алга" /> : null}
      <div className="space-y-3">
        {alerts.map((a) => (
          <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusBadge value={a.severity} />
                <StatusBadge value={a.status} />
              </div>
              <p className="text-xs text-muted-foreground">{relativeTime(a.createdAt)}</p>
            </div>
            <p className="mt-2 font-medium">{a.table?.name || a.deviceId} · {a.message}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {a.user ? `${a.user.fullName} · ${a.user.phone}` : ""} {a.session ? `· ${a.session.sessionCode}` : ""}
            </p>
            {a.status === "OPEN" ? (
              <Button size="sm" className="mt-3" onClick={() => ack(a.id)}>
                Шалгасан
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
