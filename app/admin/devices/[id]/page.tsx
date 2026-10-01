"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { formatDuration, relativeTime } from "@/lib/utils";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/EmptyState";

interface DeviceDetail {
  device: {
    id: string;
    deviceId: string;
    name: string;
    status: string;
    boxStatus: string;
    ipAddress?: string;
    firmwareVersion?: string;
    lastHeartbeat?: string;
    wifiRssi?: number;
    uptime?: number;
    operationalState?: string;
  };
  commands: { command: string; status: string; createdAt: string; commandId?: string }[];
}

function liveUptime(uptime: number | undefined, lastHeartbeat: string | undefined, online: boolean, now: number) {
  if (uptime == null) return null;
  if (!online || !lastHeartbeat) return uptime;
  const drift = Math.max(0, (now - new Date(lastHeartbeat).getTime()) / 1000);
  if (drift > 70) return uptime;
  return uptime + drift;
}

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<DeviceDetail | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<null | "door-open" | "door-close" | "secret">(null);
  const [secret, setSecret] = useState("");
  const [now, setNow] = useState(Date.now());

  async function load() {
    try {
      setData(await api<DeviceDetail>(`/api/admin/devices/${params.id}`));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    }
  }

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 4000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [params.id]);

  async function command(action: "door-open" | "door-close") {
    await api(`/api/admin/devices/${params.id}/command`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    toast.success(action === "door-open" ? "Хаалга нээх команд илгээгдлээ" : "Хаалга хаах команд илгээгдлээ");
    void load();
  }

  async function rotateSecret() {
    const res = await api<{ secret: string }>(`/api/admin/devices/${params.id}/secret`, { method: "POST" });
    setSecret(res.secret);
    toast.success("Шинэ нууц үг үүслээ. ESP32 дээр нэг удаа хадгална уу.");
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingSkeleton rows={6} />;

  const d = data.device;
  const online = d.status === "ONLINE";
  const uptime = liveUptime(d.uptime, d.lastHeartbeat, online, now);

  return (
    <div>
      <PageHeader
        title={d.name || d.deviceId}
        description={d.deviceId}
        actions={<StatusBadge value={d.status} />}
      />
      <Link href="/admin/devices" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">
        Төхөөрөмжүүд рүү буцах
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Ассан хугацаа</p>
          <p className="mt-2 font-mono text-5xl font-semibold tracking-tight">
            {uptime == null ? "--:--:--" : formatDuration(uptime)}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {online ? "Одоо ажиллаж байна" : "Сүүлийн холболтоос хойш зогссон"}
          </p>
          <div className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
            <p>Хаалга: <StatusBadge value={d.boxStatus} /></p>
            <p>Төлөв: {d.operationalState || "-"}</p>
            <p>IP: {d.ipAddress || "-"}</p>
            <p>Wi-Fi: {d.wifiRssi != null ? `${d.wifiRssi} dBm` : "-"}</p>
            <p>Firmware: {d.firmwareVersion || "-"}</p>
            <p>Сүүлийн холболт: {d.lastHeartbeat ? relativeTime(d.lastHeartbeat) : "-"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-medium">Хаалганы удирдлага</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Команд ESP32 руу очно. Төхөөрөмж дараагийн холболтоороо хаалгыг нээж эсвэл хаана.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button onClick={() => setConfirm("door-open")}>Хаалга нээх</Button>
              <Button variant="secondary" onClick={() => setConfirm("door-close")}>
                Хаалга хаах
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-medium">Төхөөрөмжийн нууц</h2>
              <Button size="sm" variant="outline" onClick={() => setConfirm("secret")}>
                Нууц шинэчлэх
              </Button>
            </div>
            {secret ? (
              <p className="mt-3 break-all rounded-xl bg-warning/10 p-3 text-xs text-warning">
                Шинэ нууц (нэг удаа харагдана): {secret}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                ESP32 анх холбогдоход нууцаа өөрөө авна. Холболт тасарвал эндээс шинэчилж, сериал дээрх зааврыг дагана уу.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-3 font-medium">Сүүлийн командууд</h2>
        {data.commands?.length ? (
          <div className="space-y-2 text-sm">
            {data.commands.slice(0, 8).map((cmd) => (
              <div key={cmd.commandId || `${cmd.command}-${cmd.createdAt}`} className="flex items-center justify-between gap-3">
                <span>{cmd.command}</span>
                <span className="text-muted-foreground">
                  {cmd.status} · {cmd.createdAt ? relativeTime(cmd.createdAt) : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Команд алга</p>
        )}
      </div>

      <ConfirmationModal
        open={confirm === "door-open" || confirm === "door-close"}
        onOpenChange={() => setConfirm(null)}
        title={confirm === "door-open" ? "Хаалгыг нээх үү?" : "Хаалгыг хаах үү?"}
        onConfirm={() => {
          if (confirm === "door-open" || confirm === "door-close") void command(confirm);
        }}
      />
      <ConfirmationModal
        open={confirm === "secret"}
        onOpenChange={() => setConfirm(null)}
        title="Төхөөрөмжийн нууцыг шинэчлэх үү?"
        description="Хуучин нууц хүчингүй болно. ESP32 дахин холбогдох хүртэл хаалганы команд очихгүй."
        danger
        onConfirm={() => void rotateSecret()}
      />
    </div>
  );
}
