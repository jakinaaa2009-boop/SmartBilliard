"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/ui/skeleton";

export default function TablesPage() {
  const [tables, setTables] = useState<Array<{
    id: string;
    number: number;
    name: string;
    zone?: string;
    deviceId?: string;
    status: string;
    expectedBallCount: number;
    enabled: boolean;
  }>>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ number: 6, name: "", zone: "Main", expectedBallCount: 8 });
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api<{ tables: typeof tables }>("/api/admin/tables");
    setTables(res.tables);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function create() {
    await api("/api/admin/tables", { method: "POST", body: JSON.stringify(form) });
    toast.success("Ширээ нэмэгдлээ");
    setOpen(false);
    void load();
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div>
      <PageHeader title="Ширээнүүд" actions={<Button onClick={() => setOpen(true)}>Ширээ нэмэх</Button>} />
      <DataTable
        columns={[
          { key: "name", label: "Нэр" },
          { key: "zone", label: "Бүс" },
          { key: "device", label: "Төхөөрөмж" },
          { key: "status", label: "Төлөв" },
          { key: "balls", label: "Бөмбөг" },
          { key: "actions", label: "" },
        ]}
        rows={tables.map((t) => ({
          name: t.name,
          zone: t.zone,
          device: t.deviceId || "-",
          status: <StatusBadge value={t.status} />,
          balls: t.expectedBallCount,
          actions: (
            <Link href={`/admin/tables/${t.id}`} className="text-primary text-sm">
              Дэлгэрэнгүй
            </Link>
          ),
        }))}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Ширээ нэмэх</DialogTitle>
          <div className="mt-4 space-y-2">
            <Input type="number" value={form.number} onChange={(e) => setForm({ ...form, number: Number(e.target.value) })} />
            <Input placeholder="Нэр" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Бүс" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} />
            <Button className="w-full" onClick={create}>
              Хадгалах
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
