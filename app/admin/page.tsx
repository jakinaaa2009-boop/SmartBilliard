"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { formatMNT, formatDuration } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { isDeviceLive } from "@/lib/realtime/device-live";
import { useAdminLive } from "@/lib/use-admin-live";

interface Dash {
  kpis: {
    todayRevenue: number;
    todaySessions: number;
    activeTables: number;
    totalTables: number;
    totalUsers: number;
    onlineDevices: number;
    offlineDevices: number;
    missingBallAlerts: number;
    failedPayments: number;
  };
  liveTables: Array<{
    id: string;
    number: number;
    name: string;
    status: string;
    deviceId?: string;
    online: boolean;
    balls: string;
    remainingMs: number;
    sessionStatus?: string;
    alarm?: boolean;
    ballCount: number;
    expectedBallCount: number;
  }>;
  revenueSeries: { date: string; total: number }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "year">("30d");
  const [now, setNow] = useState(Date.now());
  const { devices: liveDevices, connected } = useAdminLive();

  async function load() {
    try {
      setData(await api<Dash>("/api/admin/dashboard"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    }
  }
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
  }, []);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingSkeleton rows={6} />;
  const liveOnline = liveDevices.filter((device) => isDeviceLive(device.lastHeartbeat, now)).length;
  const k = {
    ...data.kpis,
    ...(liveDevices.length
      ? {
          onlineDevices: liveOnline,
          offlineDevices: Math.max(0, liveDevices.length - liveOnline),
        }
      : {}),
  };
  const chart = data.revenueSeries;

  return (
    <div>
      <PageHeader
        title="Хяналтын самбар"
        description={connected ? "Нэг төхөөрөмжийн төлөв шууд шинэчлэгдэнэ" : "Нэг төхөөрөмж, орлого, сесс"}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Өнөөдрийн орлого" value={formatMNT(k.todayRevenue)} accent="green" />
        <StatCard label="Өнөөдрийн сесси" value={String(k.todaySessions)} />
        <StatCard label="Идэвхтэй тоглолт" value={String(k.activeTables)} />
        <StatCard label="Нийт хэрэглэгч" value={k.totalUsers.toLocaleString()} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <StatCard
          label="Төхөөрөмж"
          value={liveOnline > 0 || k.onlineDevices > 0 ? "Идэвхтэй" : "Оффлайн"}
          accent={liveOnline > 0 || k.onlineDevices > 0 ? "green" : "red"}
        />
        <StatCard label="Дутуу бөмбөг" value={String(k.missingBallAlerts)} accent="yellow" />
        <StatCard label="Амжилтгүй төлбөр" value={String(k.failedPayments)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Орлого</h2>
            <div className="flex gap-1">
              {(["24h", "7d", "30d", "year"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-lg px-2 py-1 text-xs",
                    range === r ? "bg-primary/15 text-primary" : "text-muted-foreground"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <RevenueChart data={chart} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-medium">Төхөөрөмж</h2>
          <div className="space-y-2">
            {(liveDevices.length ? liveDevices.slice(0, 1) : data.liveTables.slice(0, 1)).map((item) => {
              const live = "lastHeartbeat" in item ? item : liveDevices.find((device) => device.deviceId === item.deviceId);
              const table = data.liveTables.find((row) => row.deviceId === (live?.deviceId || ("deviceId" in item ? item.deviceId : "")));
              const online = live && "lastHeartbeat" in live ? isDeviceLive(live.lastHeartbeat, now) : Boolean(table?.online);
              const ballCount = live && "detectedBallCount" in live ? live.detectedBallCount : table?.ballCount || 0;
              const expected = live && "expectedBallCount" in live ? live.expectedBallCount : table?.expectedBallCount || 8;
              const href = live && "id" in live && live.id ? `/admin/devices/${live.id}` : "/admin/devices";
              const name = ("name" in item && item.name) || table?.name || "Billiard";
              return (
                <Link key={href} href={href} className={cn("block rounded-xl border bg-[#0c1214] p-4", online ? "border-primary/30" : "border-destructive/40")}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{name}</p>
                    <span className={cn("flex items-center gap-1 text-xs", online ? "text-primary" : "text-destructive")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-primary animate-pulseDot" : "bg-destructive")} />
                      {online ? "Идэвхтэй" : "Оффлайн"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Бөмбөг {ballCount}/{expected}
                    {table?.sessionStatus === "ACTIVE" || table?.sessionStatus === "EXTENDED"
                      ? ` · ${formatDuration(Math.max(0, Math.floor(table.remainingMs / 1000)))}`
                      : table?.status === "AVAILABLE"
                        ? " · Чөлөөтэй"
                        : table
                          ? ` · ${table.status}`
                          : ""}
                  </p>
                </Link>
              );
            })}
            {!liveDevices.length && !data.liveTables.length ? (
              <p className="text-sm text-muted-foreground">Төхөөрөмж хараахан холбогдоогүй байна.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
