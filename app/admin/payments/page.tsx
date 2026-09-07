"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMNT } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/skeleton";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    qpayInvoiceId?: string;
    createdAt: string;
    paidAt?: string;
    sessionId?: string;
    user?: { fullName: string };
    table?: { name: string };
  }>>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api<{ payments: typeof payments }>(`/api/admin/payments?status=${status}`);
    setPayments(res.payments);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, [status]);

  return (
    <div>
      <PageHeader title="Төлбөрүүд" />
      <div className="mb-4 flex gap-2">
        {["all", "PAID", "PENDING", "FAILED", "EXPIRED", "REFUNDED"].map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "secondary"} onClick={() => setStatus(s)}>
            {s}
          </Button>
        ))}
      </div>
      {loading ? <LoadingSkeleton /> : (
        <DataTable
          columns={[
            { key: "id", label: "ID" },
            { key: "user", label: "Хэрэглэгч" },
            { key: "table", label: "Ширээ" },
            { key: "type", label: "Төрөл" },
            { key: "amount", label: "Дүн" },
            { key: "qpay", label: "QPay" },
            { key: "status", label: "Төлөв" },
            { key: "created", label: "Үүссэн" },
            { key: "paid", label: "Төлсөн" },
          ]}
          rows={payments.map((p) => ({
            id: p.id.slice(-8),
            user: p.user?.fullName,
            table: p.table?.name,
            type: p.type,
            amount: formatMNT(p.amount),
            qpay: p.qpayInvoiceId || "-",
            status: <StatusBadge value={p.status} />,
            created: new Date(p.createdAt).toLocaleString("mn-MN"),
            paid: p.paidAt ? new Date(p.paidAt).toLocaleString("mn-MN") : "-",
          }))}
        />
      )}
    </div>
  );
}
