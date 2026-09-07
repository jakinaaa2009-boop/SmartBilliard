"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { formatMNT } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/skeleton";

export default function ReportsPage() {
  const [preset, setPreset] = useState("month");
  const [data, setData] = useState<{
    revenue: number;
    sessions: number;
    playingHours: number;
    mostUsedTable?: { table?: { name: string }; count: number } | null;
    topCustomers: Array<{ user?: { fullName: string }; total: number; count: number }>;
    failedPayments: number;
    missingBallIncidents: number;
    deviceUptime: Array<{ deviceId: string; online: boolean; uptime: number }>;
  } | null>(null);

  async function load() {
    setData(await api(`/api/admin/reports?preset=${preset}`));
  }
  useEffect(() => {
    void load();
  }, [preset]);

  if (!data) return <LoadingSkeleton rows={6} />;

  return (
    <div>
      <PageHeader
        title="Тайлан"
        actions={
          <div className="flex gap-2">
            <a href="/api/admin/reports/export?type=sessions&format=csv">
              <Button variant="secondary">CSV</Button>
            </a>
            <a href="/api/admin/reports/export?type=sessions&format=xlsx">
              <Button variant="secondary">Excel</Button>
            </a>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ["today", "Өнөөдөр"],
          ["yesterday", "Өчигдөр"],
          ["week", "Энэ 7 хоног"],
          ["month", "Энэ сар"],
        ].map(([v, l]) => (
          <Button key={v} size="sm" variant={preset === v ? "default" : "secondary"} onClick={() => setPreset(v)}>
            {l}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Орлого" value={formatMNT(data.revenue)} accent="green" />
        <StatCard label="Сесс" value={String(data.sessions)} />
        <StatCard label="Тоглосон цаг" value={`${data.playingHours}`} />
        <StatCard label="Хамгийн их ашигласан" value={data.mostUsedTable?.table?.name || "-"} />
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 font-medium">Шилдэг хэрэглэгчид</h3>
          {data.topCustomers.map((c, i) => (
            <div key={i} className="flex justify-between py-2 text-sm">
              <span>{c.user?.fullName}</span>
              <span>{formatMNT(c.total)}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 font-medium">Төхөөрөмжийн uptime</h3>
          {data.deviceUptime.map((d) => (
            <div key={d.deviceId} className="flex justify-between py-2 text-sm">
              <span>{d.deviceId}</span>
              <span className={d.online ? "text-primary" : "text-destructive"}>
                {d.online ? "Online" : "Offline"} · {Math.floor(d.uptime / 3600)}ц
              </span>
            </div>
          ))}
          <p className="mt-3 text-sm text-muted-foreground">Төлбөрийн алдаа: {data.failedPayments}</p>
          <p className="text-sm text-muted-foreground">Бөмбөг дутуу: {data.missingBallIncidents}</p>
        </div>
      </div>
    </div>
  );
}
