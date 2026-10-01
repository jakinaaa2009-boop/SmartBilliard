"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDuration, relativeTime } from "@/lib/utils";
import { isDeviceLive } from "@/lib/realtime/device-live";
import { useAdminLive } from "@/lib/use-admin-live";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import Link from "next/link";

interface DeviceRow {
  id: string;
  deviceId: string;
  name: string;
  status: string;
  ipAddress?: string;
  detectedBallCount: number;
  expectedBallCount: number;
  boxStatus: string;
  firmwareVersion?: string;
  lastHeartbeat?: string;
  uptime?: number;
  table?: { name: string; id?: string };
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [form, setForm] = useState({
    name: "",
    deviceId: "",
    expectedBallCount: 8,
    relayOpenDuration: 7000,
    alarmDelaySeconds: 120,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const { byDeviceId, connected } = useAdminLive();

  async function load() {
    try {
      const q = filter === "all" ? "" : `?filter=${filter}`;
      const res = await api<{ devices: DeviceRow[] }>(`/api/admin/devices${q}`);
      setDevices(res.devices);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 8000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(tick);
    };
  }, [filter]);

  async function create() {
    try {
      const res = await api<{ secret: string }>("/api/admin/devices", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSecret(res.secret);
      toast.success("Төхөөрөмж бүртгэгдлээ");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа");
    }
  }

  return (
    <div>
      <PageHeader
        title="Төхөөрөмж"
        description={connected ? "Нэг төхөөрөмж · шууд холбогдсон" : "Нэг төхөөрөмж"}
      />
      <div className="mb-4 flex gap-2">
        {[
          ["all", "Бүгд"],
          ["online", "Онлайн"],
          ["offline", "Оффлайн"],
          ["warning", "Анхааруулга"],
        ].map(([f, label]) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "secondary"} onClick={() => setFilter(f)}>
            {label}
          </Button>
        ))}
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? <LoadingSkeleton /> : null}
      {!loading && !devices.length ? (
        <EmptyState
          title="Төхөөрөмж алга"
          description="ESP32 асахад энд автоматаар гарна. Sender кодыг бичээд цахилгаанд залгана уу."
        />
      ) : null}
      {devices.length ? (
        <DataTable
          columns={[
            { key: "deviceId", label: "Device ID" },
            { key: "table", label: "Ширээ" },
            { key: "status", label: "Төлөв" },
            { key: "ip", label: "IP" },
            { key: "balls", label: "Бөмбөг" },
            { key: "box", label: "Хайрцаг" },
            { key: "fw", label: "Firmware" },
            { key: "uptime", label: "Ассан хугацаа" },
            { key: "hb", label: "Heartbeat" },
            { key: "actions", label: "" },
          ]}
          rows={devices.map((d) => {
            const live = byDeviceId.get(d.deviceId);
            const row = live ? { ...d, ...live, table: d.table } : d;
            const active = isDeviceLive(row.lastHeartbeat, now);
            return {
            deviceId: (
              <Link className="text-primary" href={`/admin/devices/${row.id}`}>
                {row.deviceId}
              </Link>
            ),
            table: row.table?.name || "-",
            status: active ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulseDot" />
                Идэвхтэй
              </span>
            ) : (
              <StatusBadge value={row.status} />
            ),
            ip: row.ipAddress || "-",
            balls: `${row.detectedBallCount}/${row.expectedBallCount}`,
            box: <StatusBadge value={row.boxStatus} />,
            fw: row.firmwareVersion || "-",
            uptime: active && row.uptime != null ? formatDuration(row.uptime + Math.max(0, (now - new Date(row.lastHeartbeat || now).getTime()) / 1000)) : "-",
            hb: row.lastHeartbeat ? relativeTime(row.lastHeartbeat) : "-",
            actions: (
              <Link className="text-sm text-primary" href={`/admin/devices/${row.id}`}>
                Дэлгэрэнгүй
              </Link>
            ),
          };
          })}
        />
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Төхөөрөмж бүртгэх</DialogTitle>
          <div className="mt-4 space-y-2">
            <Input placeholder="Нэр" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="DEVICE-006" value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })} />
            <Input
              type="number"
              placeholder="Expected balls"
              value={form.expectedBallCount}
              onChange={(e) => setForm({ ...form, expectedBallCount: Number(e.target.value) })}
            />
            <Input
              type="number"
              placeholder="Open duration ms"
              value={form.relayOpenDuration}
              onChange={(e) => setForm({ ...form, relayOpenDuration: Number(e.target.value) })}
            />
            <Button className="w-full" onClick={create}>
              Үүсгэх
            </Button>
            {secret ? <p className="break-all text-xs text-warning">Secret (хадгална уу): {secret}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
