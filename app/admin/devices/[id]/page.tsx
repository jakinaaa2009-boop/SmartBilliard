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
import { isDeviceLive } from "@/lib/realtime/device-live";
import { useAdminLive } from "@/lib/use-admin-live";
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
    detectedBallCount?: number;
    expectedBallCount?: number;
    irEnabled?: boolean;
    vibrationEnabled?: boolean;
    sensorTestActive?: boolean;
    mpuReady?: boolean;
    lastIrAt?: string;
    lastVibrationAt?: string;
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
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { byDeviceId, connected } = useAdminLive();

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
    const poll = setInterval(() => void load(), 2000);
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

  async function sensorCommand(
    action: "ir-on" | "ir-off" | "vibration-on" | "vibration-off" | "count-start" | "count-stop"
  ) {
    const messages = {
      "ir-on": "IR мэдрэгчийг асаалаа",
      "ir-off": "IR мэдрэгчийг унтраалаа",
      "vibration-on": "Доргилт мэдрэгчийг асаалаа",
      "vibration-off": "Доргилт мэдрэгчийг унтраалаа",
      "count-start": "Бөмбөг тооллогыг 0-ээс эхлүүллээ",
      "count-stop": "Бөмбөг тооллогыг зогсоолоо",
    };
    setBusy(true);
    try {
      await api(`/api/admin/devices/${params.id}/command`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      toast.success(messages[action]);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Команд явсангүй");
    } finally {
      setBusy(false);
    }
  }

  async function rotateSecret() {
    const res = await api<{ secret: string }>(`/api/admin/devices/${params.id}/secret`, { method: "POST" });
    setSecret(res.secret);
    toast.success("Шинэ нууц үг үүслээ. ESP32 дээр нэг удаа хадгална уу.");
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingSkeleton rows={6} />;

  const live = byDeviceId.get(data.device.deviceId);
  const d = live
    ? {
        ...data.device,
        status: live.status,
        boxStatus: live.boxStatus,
        operationalState: live.operationalState,
        lastHeartbeat: live.lastHeartbeat,
        uptime: live.uptime,
        ipAddress: live.ipAddress,
        wifiRssi: live.wifiRssi,
      }
    : data.device;
  const online = isDeviceLive(d.lastHeartbeat, now);
  const uptime = liveUptime(d.uptime, d.lastHeartbeat, online, now);

  return (
    <div>
      <PageHeader
        title={d.name || d.deviceId}
        description={connected ? `${d.deviceId} · шууд` : d.deviceId}
        actions={
          online ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulseDot" />
              Идэвхтэй
            </span>
          ) : (
            <StatusBadge value={d.status} />
          )
        }
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-medium">Мэдрэгч туршилт</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Нэгийг нь унтраагаад нөгөөгөөр нь туршина. Хоёуланг асаавал бөмбөг зөвхөн IR ба доргилт зэрэг ирэхэд тоологдоно.
            Ногоон «сая ажиллалаа» гарвал тэр мэдрэгч дохио өгсөн.
          </p>
          <SensorRow
            title="IR туяа"
            enabled={d.irEnabled !== false}
            detail={hitText(data.device.lastIrAt, now)}
            live={isRecent(data.device.lastIrAt, now)}
            busy={busy}
            onEnable={() => void sensorCommand("ir-on")}
            onDisable={() => void sensorCommand("ir-off")}
          />
          <SensorRow
            title="Доргилт (MPU)"
            enabled={d.vibrationEnabled !== false}
            detail={
              data.device.mpuReady === false
                ? "MPU холбогдоогүй"
                : hitText(data.device.lastVibrationAt, now)
            }
            live={data.device.mpuReady !== false && isRecent(data.device.lastVibrationAt, now)}
            busy={busy}
            onEnable={() => void sensorCommand("vibration-on")}
            onDisable={() => void sensorCommand("vibration-off")}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-medium">Бөмбөг тоолох тест</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            0-ээс эхлүүлнэ. Бөмбөг оруулахад тоо өсвөл сонгосон мэдрэгч тоолж байна. Өсөхгүй бол тэр мэдрэгч ажиллахгүй байна.
          </p>
          <p className="mt-4 font-mono text-5xl font-semibold tracking-tight">
            {data.device.detectedBallCount ?? 0}
          </p>
          <p className="text-sm text-muted-foreground">Тоологдсон бөмбөг</p>
          <p className="mt-2 text-sm">
            {data.device.sensorTestActive ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulseDot" />
                Тест тоолж байна
              </span>
            ) : (
              <span className="text-muted-foreground">Тест зогссон. Тоо өөрчлөгдөхгүй.</span>
            )}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button disabled={busy} onClick={() => void sensorCommand("count-start")}>
              0-ээс тоолох
            </Button>
            <Button disabled={busy} variant="secondary" onClick={() => void sensorCommand("count-stop")}>
              Зогсоох
            </Button>
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

function isRecent(at: string | undefined, now: number) {
  if (!at) return false;
  return now - new Date(at).getTime() < 8000;
}

function hitText(at: string | undefined, now: number) {
  if (!at) return "Одоогоор дохио алга";
  if (isRecent(at, now)) return "Сая ажиллалаа";
  return `Сүүлд ${relativeTime(at)}`;
}

function SensorRow({
  title,
  enabled,
  detail,
  live,
  busy,
  onEnable,
  onDisable,
}: {
  title: string;
  enabled: boolean;
  detail: string;
  live: boolean;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">{title}</p>
        <span className={enabled ? "text-sm text-primary" : "text-sm text-muted-foreground"}>
          {enabled ? "Асаалттай" : "Унтраалттай"}
        </span>
      </div>
      <p className={`mt-1 text-sm ${live ? "font-medium text-primary" : "text-muted-foreground"}`}>{detail}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button size="sm" disabled={busy || enabled} onClick={onEnable}>
          Асаах
        </Button>
        <Button size="sm" variant="secondary" disabled={busy || !enabled} onClick={onDisable}>
          Унтраах
        </Button>
      </div>
    </div>
  );
}
