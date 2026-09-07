"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMNT } from "@/lib/utils";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/input";
import { LoadingSkeleton } from "@/components/ui/skeleton";

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<{
    user: { id: string; fullName: string; phone: string; email?: string; status: string };
    sessions: Array<{ id: string; status: string; totalAmount: number; createdAt: string }>;
    payments: Array<{ id: string; amount: number; status: string; createdAt: string }>;
  } | null>(null);
  const [reason, setReason] = useState("");

  async function load() {
    setData(await api(`/api/admin/users/${params.id}`));
  }
  useEffect(() => {
    void load();
  }, [params.id]);

  async function save() {
    if (!data) return;
    await api(`/api/admin/users/${params.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...data.user, reason }),
    });
    toast.success("Хадгаллаа");
  }

  async function toggleBlock() {
    if (!data) return;
    await api(`/api/admin/users/${params.id}`, {
      method: "PUT",
      body: JSON.stringify({
        status: data.user.status === "BLOCKED" ? "ACTIVE" : "BLOCKED",
        reason: reason || "admin action",
      }),
    });
    toast.success(data.user.status === "BLOCKED" ? "Нээлээ" : "Хаалаа");
    void load();
  }

  if (!data) return <LoadingSkeleton />;

  return (
    <div className="space-y-5">
      <PageHeader title={data.user.fullName} actions={<StatusBadge value={data.user.status} />} />
      <div className="grid gap-3 md:grid-cols-3">
        <Input value={data.user.fullName} onChange={(e) => setData({ ...data, user: { ...data.user, fullName: e.target.value } })} />
        <Input value={data.user.phone} onChange={(e) => setData({ ...data, user: { ...data.user, phone: e.target.value } })} />
        <Input value={data.user.email || ""} onChange={(e) => setData({ ...data, user: { ...data.user, email: e.target.value } })} />
      </div>
      <Textarea placeholder="Шалтгаан / тэмдэглэл" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <Button onClick={save}>Хадгалах</Button>
        <Button variant="destructive" onClick={toggleBlock}>
          {data.user.status === "BLOCKED" ? "Unblock" : "Block"}
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 font-medium">Сесс</h3>
          {data.sessions.map((s) => (
            <div key={s.id} className="mb-2 flex justify-between rounded-xl border border-border p-3 text-sm">
              <span>{new Date(s.createdAt).toLocaleString("mn-MN")}</span>
              <StatusBadge value={s.status} />
            </div>
          ))}
        </div>
        <div>
          <h3 className="mb-2 font-medium">Төлбөр</h3>
          {data.payments.map((p) => (
            <div key={p.id} className="mb-2 flex justify-between rounded-xl border border-border p-3 text-sm">
              <span>{formatMNT(p.amount)}</span>
              <StatusBadge value={p.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
