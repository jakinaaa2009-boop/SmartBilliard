"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    businessName: "",
    currency: "MNT",
    gracePeriodSeconds: 120,
    heartbeatTimeoutSeconds: 60,
    ballReturnAlarmDelaySeconds: 120,
    defaultOpeningDurationMs: 7000,
    minimumSessionMinutes: 30,
    maximumSessionMinutes: 180,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ settings: typeof settings }>("/api/admin/settings").then((r) => {
      setSettings({ ...settings, ...r.settings });
      setLoading(false);
    });
  }, []);

  async function save() {
    await api("/api/admin/settings", { method: "PUT", body: JSON.stringify(settings) });
    toast.success("Тохиргоо хадгалагдлаа");
  }

  if (loading) return <LoadingSkeleton />;

  const fields: Array<[string, keyof typeof settings]> = [
    ["Бизнесийн нэр", "businessName"],
    ["Валют", "currency"],
    ["Grace period (сек)", "gracePeriodSeconds"],
    ["Heartbeat timeout (сек)", "heartbeatTimeoutSeconds"],
    ["Бөмбөг буцаах дохиоллын хүлээлт (сек)", "ballReturnAlarmDelaySeconds"],
    ["Хайрцаг нээх хугацаа (мс)", "defaultOpeningDurationMs"],
    ["Хамгийн бага сесс (мин)", "minimumSessionMinutes"],
    ["Хамгийн их сесс (мин)", "maximumSessionMinutes"],
  ];

  return (
    <div className="max-w-xl">
      <PageHeader title="Системийн тохиргоо" />
      <div className="space-y-3">
        {fields.map(([label, key]) => (
          <div key={key} className="space-y-1.5">
            <Label>{label}</Label>
            <Input
              value={String(settings[key] ?? "")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  [key]: typeof settings[key] === "number" ? Number(e.target.value) : e.target.value,
                })
              }
            />
          </div>
        ))}
        <Button onClick={save}>Хадгалах</Button>
      </div>
    </div>
  );
}
