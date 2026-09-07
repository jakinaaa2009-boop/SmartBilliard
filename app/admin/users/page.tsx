"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMNT } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/skeleton";

export default function UsersPage() {
  const [users, setUsers] = useState<Array<{
    id: string;
    fullName: string;
    phone: string;
    email?: string;
    createdAt: string;
    sessions: number;
    totalSpent: number;
    status: string;
  }>>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    const res = await api<{ users: typeof users }>(`/api/admin/users?${q.toString()}`);
    setUsers(res.users);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, [status]);

  return (
    <div>
      <PageHeader title="Хэрэглэгчид" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Нэр, утас, имэйл" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Button variant="secondary" onClick={load}>Хайх</Button>
        <Button size="sm" variant={status === "" ? "default" : "secondary"} onClick={() => setStatus("")}>Бүгд</Button>
        <Button size="sm" variant={status === "ACTIVE" ? "default" : "secondary"} onClick={() => setStatus("ACTIVE")}>Active</Button>
        <Button size="sm" variant={status === "BLOCKED" ? "default" : "secondary"} onClick={() => setStatus("BLOCKED")}>Blocked</Button>
      </div>
      {loading ? <LoadingSkeleton /> : (
        <DataTable
          columns={[
            { key: "name", label: "Нэр" },
            { key: "phone", label: "Утас" },
            { key: "email", label: "Имэйл" },
            { key: "date", label: "Бүртгүүлсэн" },
            { key: "sessions", label: "Сесс" },
            { key: "spent", label: "Төлбөр" },
            { key: "status", label: "Төлөв" },
            { key: "actions", label: "" },
          ]}
          rows={users.map((u) => ({
            name: u.fullName,
            phone: u.phone,
            email: u.email || "-",
            date: new Date(u.createdAt).toLocaleDateString("mn-MN"),
            sessions: u.sessions,
            spent: formatMNT(u.totalSpent),
            status: <StatusBadge value={u.status} />,
            actions: (
              <Link href={`/admin/users/${u.id}`} className="text-primary text-sm">
                Харах
              </Link>
            ),
          }))}
        />
      )}
    </div>
  );
}
