"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMNT } from "@/lib/utils";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  const [user, setUser] = useState({ fullName: "", phone: "", email: "" });
  const [stats, setStats] = useState({ sessions: 0, hours: 0, spent: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: typeof user; stats: typeof stats }>("/api/users/me")
      .then((r) => {
        setUser({
          fullName: r.user.fullName,
          phone: r.user.phone,
          email: r.user.email || "",
        });
        setStats(r.stats);
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/users/me", { method: "PUT", body: JSON.stringify(user) });
      toast.success("Профайл шинэчлэгдлээ");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа");
    }
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Профайл</h1>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Нийт тоглосон</p>
          <p className="mt-1 font-semibold">{stats.sessions} удаа</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Нийт цаг</p>
          <p className="mt-1 font-semibold">{stats.hours} цаг</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Нийт төлбөр</p>
          <p className="mt-1 font-semibold">{formatMNT(stats.spent)}</p>
        </div>
      </div>
      <form onSubmit={save} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Нэр</Label>
          <Input value={user.fullName} onChange={(e) => setUser({ ...user, fullName: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Утас</Label>
          <Input value={user.phone} onChange={(e) => setUser({ ...user, phone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Имэйл</Label>
          <Input value={user.email} onChange={(e) => setUser({ ...user, email: e.target.value })} />
        </div>
        <Button className="w-full">Хадгалах</Button>
      </form>
    </div>
  );
}
