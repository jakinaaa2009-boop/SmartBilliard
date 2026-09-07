"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMNT, minutesLabel } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/skeleton";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Array<{
    id: string;
    sessionCode: string;
    status: string;
    startedAt?: string;
    expiresAt?: string;
    purchasedMinutes: number;
    totalAmount: number;
    returnedBallCount: number;
    expectedBallCount: number;
    user?: { fullName: string; phone: string };
    table?: { name: string };
  }>>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const q = new URLSearchParams();
    if (filter === "today") q.set("today", "1");
    else if (filter) q.set("status", filter);
    const res = await api<{ sessions: typeof sessions }>(`/api/admin/sessions?${q.toString()}`);
    setSessions(res.sessions);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, [filter]);

  return (
    <div>
      <PageHeader title="Сессиуд" />
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          ["", "Бүгд"],
          ["today", "Өнөөдөр"],
          ["active", "Идэвхтэй"],
          ["completed", "Дууссан"],
          ["problems", "Асуудал"],
        ].map(([v, l]) => (
          <Button key={v} size="sm" variant={filter === v ? "default" : "secondary"} onClick={() => setFilter(v)}>
            {l}
          </Button>
        ))}
      </div>
      {loading ? <LoadingSkeleton /> : (
        <DataTable
          columns={[
            { key: "id", label: "Session" },
            { key: "user", label: "Хэрэглэгч" },
            { key: "table", label: "Ширээ" },
            { key: "started", label: "Эхэлсэн" },
            { key: "ends", label: "Дуусах" },
            { key: "dur", label: "Хугацаа" },
            { key: "amount", label: "Дүн" },
            { key: "balls", label: "Бөмбөг" },
            { key: "status", label: "Төлөв" },
          ]}
          rows={sessions.map((s) => ({
            id: s.sessionCode,
            user: s.user ? `${s.user.fullName} · ${s.user.phone}` : "-",
            table: s.table?.name,
            started: s.startedAt ? new Date(s.startedAt).toLocaleString("mn-MN") : "-",
            ends: s.expiresAt ? new Date(s.expiresAt).toLocaleString("mn-MN") : "-",
            dur: minutesLabel(s.purchasedMinutes),
            amount: formatMNT(s.totalAmount),
            balls: `${s.returnedBallCount}/${s.expectedBallCount}`,
            status: <StatusBadge value={s.status} />,
          }))}
        />
      )}
    </div>
  );
}
