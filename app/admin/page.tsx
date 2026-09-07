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
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, []);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingSkeleton rows={6} />;
  const k = data.kpis;
  const chart = data.revenueSeries;

  return (
    <div>
      <PageHeader title="Хяналтын самбар" description="Шууд төлөв, орлого, төхөөрөмжүүд" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Өнөөдрийн орлого" value={formatMNT(k.todayRevenue)} accent="green" />
        <StatCard label="Өнөөдрийн сесси" value={String(k.todaySessions)} />
        <StatCard label="Идэвхтэй ширээ" value={`${k.activeTables} / ${k.totalTables}`} />
        <StatCard label="Нийт хэрэглэгч" value={k.totalUsers.toLocaleString()} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Online devices" value={String(k.onlineDevices)} accent="green" />
        <StatCard label="Offline devices" value={String(k.offlineDevices)} accent="red" />
        <StatCard label="Missing ball alerts" value={String(k.missingBallAlerts)} accent="yellow" />
        <StatCard label="Failed payments" value={String(k.failedPayments)} />
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
          <h2 className="mb-4 font-medium">Төхөөрөмжийн төлөв</h2>
          <div className="space-y-2">
            {data.liveTables.map((t) => {
              const tone = !t.online
                ? "border-destructive/40"
                : t.alarm || t.ballCount < t.expectedBallCount
                  ? "border-warning/40"
                  : "border-primary/20";
              return (
                <Link
                  key={t.id}
                  href={`/admin/tables/${t.id}`}
                  className={cn("block rounded-xl border bg-[#0c1214] p-3", tone)}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{t.name}</p>
                    <span className={cn("flex items-center gap-1 text-xs", t.online ? "text-primary" : "text-destructive")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", t.online ? "bg-primary" : "bg-destructive")} />
                      {t.online ? "Online" : "Offline"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Balls {t.balls}
                    {t.sessionStatus === "ACTIVE" || t.sessionStatus === "EXTENDED"
                      ? ` · ${formatDuration(Math.max(0, Math.floor(t.remainingMs / 1000)))} remaining`
                      : t.status === "AVAILABLE"
                        ? " · Available"
                        : ` · ${t.status}`}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
