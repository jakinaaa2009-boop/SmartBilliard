"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { SessionTimer } from "@/components/SessionTimer";
import { BallCounter } from "@/components/BallCounter";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { formatMNT, relativeTime } from "@/lib/utils";
import { isDeviceLive } from "@/lib/realtime/live-state";
import { useAdminLive } from "@/lib/use-admin-live";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/EmptyState";

interface Detail {
  table: { id: string; name: string; status: string; number: number };
  device: {
    id: string;
    deviceId: string;
    ipAddress?: string;
    firmwareVersion?: string;
    lastHeartbeat?: string;
    wifiRssi?: number;
    uptime?: number;
    boxStatus: string;
    detectedBallCount: number;
    expectedBallCount: number;
    alarmStatus: boolean;
    status: string;
    relayOpenDuration: number;
  } | null;
  session: {
    id: string;
    status: string;
    startedAt?: string;
    expiresAt?: string;
    totalAmount: number;
    user?: { fullName: string; phone: string };
  } | null;
}

export default function TableDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [mock, setMock] = useState(false);
  const [reasonOpen, setReasonOpen] = useState<null | "end" | "add">(null);
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState(10);
  const [confirm, setConfirm] = useState<null | "open" | "close" | "alarm-on" | "alarm-off" | "restart">(null);
  const [now, setNow] = useState(Date.now());
  const { byDeviceId } = useAdminLive();

  async function load() {
    try {
      setData(await api<Detail>(`/api/admin/tables/${params.id}`));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    }
  }
  useEffect(() => {
    void load();
    void fetch("/api/public/config")
      .then((r) => r.json())
      .then((d) => setMock(Boolean(d.mockIot)));
    const t = setInterval(() => void load(), 2000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
  }, [params.id]);

  async function command(action: string, extra?: Record<string, unknown>) {
    if (!data?.device) return;
    await api(`/api/admin/devices/${data.device.id}/command`, {
      method: "POST",
      body: JSON.stringify({ action, reason, ...extra }),
    });
    toast.success("Команд илгээгдлээ");
    void load();
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingSkeleton rows={6} />;
  const live = data.device ? byDeviceId.get(data.device.deviceId) : undefined;
  const d = data.device
    ? {
        ...data.device,
        ...(live
          ? {
              status: isDeviceLive(live.lastHeartbeat, now) ? "ONLINE" : live.status,
              boxStatus: live.boxStatus,
              lastHeartbeat: live.lastHeartbeat,
              wifiRssi: live.wifiRssi,
              uptime: live.uptime,
              detectedBallCount: live.detectedBallCount,
              expectedBallCount: live.expectedBallCount,
              alarmStatus: live.alarmStatus,
              ipAddress: live.ipAddress ?? data.device.ipAddress,
            }
          : {}),
      }
    : null;
  const s = data.session;

  return (
    <div>
      <PageHeader
        title={data.table.name}
        description="Төхөөрөмж, сесс, бөмбөгний шууд төлөв"
        actions={<StatusBadge value={d?.status || data.table.status} />}
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 text-sm text-muted-foreground">Бөмбөгний хайрцаг</p>
          <div className="relative mx-auto h-64 w-48 rounded-2xl border border-[#2a3a32] bg-gradient-to-b from-[#16301f] to-[#0b1510] p-4">
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: d?.expectedBallCount || 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-7 w-7 rounded-full ${i < (d?.detectedBallCount || 0) ? "eight-ball" : "border border-dashed border-white/20"}`}
                />
              ))}
            </div>
            <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-black/40 px-2 py-1 text-center text-xs">
              {d?.boxStatus === "UNLOCKED" ? "НЭЭЛТТЭЙ" : "ТҮГЖЭЭТЭЙ"}
            </div>
          </div>
          <div className="mt-4">
            <BallCounter detected={d?.detectedBallCount || 0} expected={d?.expectedBallCount || 8} />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-3 font-medium">Төхөөрөмж</h3>
            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p>Device ID: {d?.deviceId}</p>
              <p>IP: {d?.ipAddress || "-"}</p>
              <p>Firmware: {d?.firmwareVersion || "-"}</p>
              <p>Heartbeat: {d?.lastHeartbeat ? relativeTime(d.lastHeartbeat) : "-"}</p>
              <p>Wi-Fi: {d?.wifiRssi ? `${d.wifiRssi} dBm` : "-"}</p>
              <p>Uptime: {d?.uptime ? `${Math.floor(d.uptime / 3600)} ц` : "-"}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-3 font-medium">Сесс</h3>
            {s ? (
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>Хэрэглэгч: {s.user?.fullName}</p>
                <p>Утас: {s.user?.phone}</p>
                <p>Эхэлсэн: {s.startedAt ? new Date(s.startedAt).toLocaleString("mn-MN") : "-"}</p>
                <p>Дуусах: {s.expiresAt ? new Date(s.expiresAt).toLocaleString("mn-MN") : "-"}</p>
                <div>
                  Үлдсэн: <SessionTimer expiresAt={s.expiresAt} size="sm" />
                </div>
                <p>Дүн: {formatMNT(s.totalAmount)}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Идэвхтэй сесс алга</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Button onClick={() => setConfirm("open")}>Нээх</Button>
            <Button variant="secondary" onClick={() => setConfirm("close")}>Хаах</Button>
            <Button variant="secondary" onClick={() => s && setReasonOpen("add")}>Цаг нэмэх</Button>
            <Button variant="destructive" onClick={() => s && setReasonOpen("end")}>Сесси дуусгах</Button>
            <Button variant="warning" onClick={() => setConfirm("alarm-on")}>Дохиолол асаах</Button>
            <Button variant="secondary" onClick={() => setConfirm("alarm-off")}>Дохиолол унтраах</Button>
            <Button variant="outline" onClick={() => setConfirm("restart")}>Restart</Button>
          </div>
          {mock ? (
            <div className="rounded-2xl border border-warning/30 p-4">
              <p className="mb-2 text-sm text-warning">Mock IoT</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => command("simulate", { simulate: "online" })}>Online</Button>
                <Button size="sm" variant="secondary" onClick={() => command("simulate", { simulate: "offline" })}>Offline</Button>
                <Button size="sm" variant="secondary" onClick={() => command("simulate", { simulate: "balls", balls: 8 })}>Balls 8/8</Button>
                <Button size="sm" variant="secondary" onClick={() => command("simulate", { simulate: "balls", balls: 7 })}>Balls 7/8</Button>
                <Button size="sm" variant="secondary" onClick={() => command("simulate", { simulate: "alarm-on" })}>Alarm ON</Button>
                <Button size="sm" variant="secondary" onClick={() => command("simulate", { simulate: "alarm-off" })}>Alarm OFF</Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmationModal
        open={Boolean(confirm)}
        onOpenChange={() => setConfirm(null)}
        title="Энэ командыг илгээх үү?"
        danger={confirm === "restart" || confirm === "alarm-on"}
        onConfirm={() => confirm && void command(confirm)}
      />

      <Dialog open={Boolean(reasonOpen)} onOpenChange={() => setReasonOpen(null)}>
        <DialogContent>
          <DialogTitle>{reasonOpen === "add" ? "Цаг нэмэх" : "Сесси дуусгах"}</DialogTitle>
          {reasonOpen === "add" ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">Одоогийн үлдсэн</p>
              <SessionTimer expiresAt={s?.expiresAt} size="sm" />
              <div className="flex gap-2">
                {[10, 30, 60].map((m) => (
                  <Button key={m} size="sm" variant={minutes === m ? "default" : "secondary"} onClick={() => setMinutes(m)}>
                    +{m} мин
                  </Button>
                ))}
              </div>
              <Input type="number" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
            </div>
          ) : null}
          <Textarea className="mt-3" placeholder="Шалтгаан" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button
            className="mt-3 w-full"
            onClick={async () => {
              if (!s) return;
              if (reasonOpen === "add") {
                await api(`/api/admin/sessions/${s.id}/add-time`, {
                  method: "POST",
                  body: JSON.stringify({ minutes, reason }),
                });
                toast.success("Цаг нэмэгдлээ");
              } else {
                await api(`/api/admin/sessions/${s.id}/end`, {
                  method: "POST",
                  body: JSON.stringify({ reason }),
                });
                toast.success("Сесс дууслаа");
              }
              setReasonOpen(null);
              setReason("");
              void load();
            }}
          >
            Хадгалах
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
