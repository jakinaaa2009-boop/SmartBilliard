"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMNT, minutesLabel } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LoadingSkeleton } from "@/components/ui/skeleton";

interface Plan {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  active: boolean;
  popular: boolean;
  sortOrder: number;
}

export default function PricingSettingsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", durationMinutes: 60, price: 5000, popular: false, active: true, sortOrder: 5 });
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api<{ plans: Plan[] }>("/api/admin/pricing");
    setPlans(res.plans);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function savePlan(plan: Partial<Plan> & { id?: string }) {
    if (plan.id) await api("/api/admin/pricing", { method: "PUT", body: JSON.stringify(plan) });
    else await api("/api/admin/pricing", { method: "POST", body: JSON.stringify(plan) });
    toast.success("Үнэ шинэчлэгдлээ");
    void load();
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div>
      <PageHeader title="Үнийн тохиргоо" actions={<Button onClick={() => setOpen(true)}>Багц нэмэх</Button>} />
      <div className="space-y-3">
        {plans.map((p) => (
          <div key={p.id} className="grid items-center gap-2 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1fr_120px_140px_auto]">
            <Input value={p.name} onChange={(e) => setPlans(plans.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)))} />
            <Input
              type="number"
              value={p.durationMinutes}
              onChange={(e) => setPlans(plans.map((x) => (x.id === p.id ? { ...x, durationMinutes: Number(e.target.value) } : x)))}
            />
            <Input
              type="number"
              value={p.price}
              onChange={(e) => setPlans(plans.map((x) => (x.id === p.id ? { ...x, price: Number(e.target.value) } : x)))}
            />
            <div className="flex gap-2">
              <Button size="sm" variant={p.popular ? "default" : "secondary"} onClick={() => savePlan({ ...p, popular: !p.popular })}>
                Popular
              </Button>
              <Button size="sm" variant={p.active ? "default" : "secondary"} onClick={() => savePlan({ ...p, active: !p.active })}>
                {p.active ? "Идэвхтэй" : "Идэвхгүй"}
              </Button>
              <Button size="sm" onClick={() => savePlan(p)}>Хадгалах</Button>
            </div>
            <p className="text-xs text-muted-foreground md:col-span-4">
              {minutesLabel(p.durationMinutes)} · {formatMNT(p.price)}
            </p>
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Шинэ багц</DialogTitle>
          <div className="mt-3 space-y-2">
            <Input placeholder="VIP Night" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            <Button className="w-full" onClick={() => { void savePlan(form); setOpen(false); }}>Үүсгэх</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
