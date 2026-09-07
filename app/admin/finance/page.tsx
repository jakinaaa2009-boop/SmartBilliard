"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatMNT } from "@/lib/utils";
import { toast } from "sonner";
import { EXPENSE_CATEGORIES } from "@/types";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function FinancePage() {
  const [data, setData] = useState<{
    summary: { revenue: number; expenses: number; net: number; transactions: number };
    daily: { date: string; total: number }[];
    monthly: { date: string; total: number }[];
    byType: { _id: string; total: number }[];
    expenses: Array<{ id: string; title: string; category: string; amount: number; date: string }>;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "OTHER", amount: 0, description: "", date: "" });

  async function load() {
    setData(await api("/api/admin/finance"));
  }
  useEffect(() => {
    void load();
  }, []);

  async function save() {
    await api("/api/admin/finance", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
    toast.success("Зарлага бүртгэгдлээ");
    setOpen(false);
    void load();
  }

  if (!data) return <LoadingSkeleton rows={6} />;

  return (
    <div>
      <PageHeader title="Орлого / Зарлага" actions={<Button onClick={() => setOpen(true)}>Зарлага нэмэх</Button>} />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Нийт орлого" value={formatMNT(data.summary.revenue)} accent="green" />
        <StatCard label="Нийт зарлага" value={formatMNT(data.summary.expenses)} accent="red" />
        <StatCard label="Цэвэр ашиг" value={formatMNT(data.summary.net)} />
        <StatCard label="Гүйлгээний тоо" value={String(data.summary.transactions)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 font-medium">Өдрийн орлого</h3>
          <RevenueChart data={data.daily} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 font-medium">Төлбөрийн төрөл</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byType.map((d) => ({ name: d._id, total: d.total }))}>
                <CartesianGrid stroke="#1F2A2E" vertical={false} />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} />
                <YAxis stroke="#94A3B8" fontSize={12} />
                <Tooltip contentStyle={{ background: "#101619", border: "1px solid #1F2A2E" }} />
                <Bar dataKey="total" fill="#22C55E" radius={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <h3 className="mb-3 mt-8 font-medium">Зарлагууд</h3>
      <div className="space-y-2">
        {data.expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
            <div>
              <p className="font-medium">{e.title}</p>
              <p className="text-xs text-muted-foreground">{e.category} · {new Date(e.date).toLocaleDateString("mn-MN")}</p>
            </div>
            <p>{formatMNT(e.amount)}</p>
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Зарлага</DialogTitle>
          <div className="mt-3 space-y-2">
            <Input placeholder="Гарчиг" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select
              className="h-12 w-full rounded-2xl border border-border bg-[#0c1214] px-3"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Input type="number" placeholder="Дүн" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Textarea placeholder="Тайлбар" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Button className="w-full" onClick={save}>Хадгалах</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
