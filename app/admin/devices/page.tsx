"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { relativeTime } from "@/lib/utils";
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
        title="Төхөөрөмжүүд"
        actions={<Button onClick={() => setOpen(true)}>Шинэ төхөөрөмж</Button>}
      />
      <div className="mb-4 flex gap-2">
        {["all", "online", "offline", "warning"].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "secondary"} onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? <LoadingSkeleton /> : null}
      {!loading && !devices.length ? <EmptyState title="Төхөөрөмж алга" /> : null}
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
            { key: "hb", label: "Heartbeat" },
            { key: "actions", label: "" },
          ]}
          rows={devices.map((d) => ({
            deviceId: d.deviceId,
            table: d.table?.name || "-",
            status: <StatusBadge value={d.status} />,
            ip: d.ipAddress || "-",
            balls: `${d.detectedBallCount}/${d.expectedBallCount}`,
            box: <StatusBadge value={d.boxStatus} />,
            fw: d.firmwareVersion || "-",
            hb: d.lastHeartbeat ? relativeTime(d.lastHeartbeat) : "-",
            actions: (
              <Link className="text-primary text-sm" href={`/admin/tables/${d.table?.id || ""}`}>
                Нээх
              </Link>
            ),
          }))}
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
