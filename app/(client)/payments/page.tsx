"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMNT } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";

export default function PaymentsHistoryPage() {
  const [payments, setPayments] = useState<Array<{
    id: string;
    amount: number;
    status: string;
    type: string;
    createdAt: string;
    table?: { name: string };
  }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<{ payments: typeof payments }>("/api/users/me/payments")
      .then((r) => setPayments(r.payments))
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <LoadingSkeleton />;
  if (!payments.length) return <EmptyState title="Төлбөрийн түүх хоосон" />;
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Төлбөрийн түүх</h1>
      {payments.map((p) => (
        <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">{formatMNT(p.amount)}</p>
            <StatusBadge value={p.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {p.table?.name} · {p.type}
          </p>
          <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString("mn-MN")}</p>
        </div>
      ))}
    </div>
  );
}
