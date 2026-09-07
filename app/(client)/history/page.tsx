"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMNT, minutesLabel } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import Link from "next/link";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Array<{
    id: string;
    status: string;
    totalAmount: number;
    purchasedMinutes: number;
    createdAt: string;
    table?: { name: string };
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ sessions: typeof sessions }>("/api/users/me/sessions")
      .then((r) => setSessions(r.sessions))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (!sessions.length) return <EmptyState title="Тоглолтын түүх хоосон" />;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Миний тоглолтууд</h1>
      {sessions.map((s) => (
        <Link key={s.id} href={`/session/${s.id}`} className="block rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">{s.table?.name}</p>
            <StatusBadge value={s.status} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {minutesLabel(s.purchasedMinutes)} · {formatMNT(s.totalAmount)}
          </p>
          <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString("mn-MN")}</p>
        </Link>
      ))}
    </div>
  );
}
