"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client-api";
import { toast } from "sonner";
import { SessionTimer } from "@/components/SessionTimer";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMNT } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { PricingCard } from "@/components/PricingCard";

interface SessionRow {
  id: string;
  status: string;
  expiresAt?: string;
  totalAmount: number;
  purchasedMinutes: number;
  createdAt: string;
  table?: { name: string; deviceId?: string };
  deviceId: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string; durationMinutes: number; price: number; popular?: boolean }[]>([]);
  const [selected, setSelected] = useState("");
  const [deviceId, setDeviceId] = useState("BILLIARD_01");
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const leftRef = useRef(false);

  async function load() {
    if (leftRef.current) return;
    try {
      const [res, pricing, tables] = await Promise.all([
        api<{ sessions: SessionRow[] }>("/api/users/me/sessions"),
        api<{ plans: { id: string; name: string; durationMinutes: number; price: number; popular?: boolean }[] }>("/api/pricing"),
        api<{ tables: { deviceId?: string; status: string }[] }>("/api/tables").catch(() => ({ tables: [] })),
      ]);
      if (leftRef.current) return;
      setSessions(res.sessions);
      setPlans(pricing.plans);
      const preferred = pricing.plans.find((plan) => plan.popular) || pricing.plans[0];
      if (preferred) setSelected((current) => current || preferred.id);
      const ready = tables.tables.find((table) => table.deviceId && table.status !== "MAINTENANCE");
      if (ready?.deviceId) setDeviceId(ready.deviceId);
    } catch (err) {
      if (leftRef.current) return;
      if (err instanceof ApiError && err.status === 401) {
        leftRef.current = true;
        router.replace("/login");
        return;
      }
    } finally {
      if (!leftRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 2000);
    return () => {
      leftRef.current = true;
      clearInterval(t);
    };
  }, []);

  const active = sessions.find((s) => ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"].includes(s.status));

  async function logout() {
    leftRef.current = true;
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    toast.success("Гарлаа");
    router.replace("/login");
  }

  async function pay() {
    if (!selected) return;
    setPaying(true);
    try {
      const res = await api<{ payment: { id: string } }>("/api/payments/qpay/create", {
        method: "POST",
        body: JSON.stringify({ deviceId, pricingPlanId: selected, type: "SESSION" }),
      });
      router.push(`/payment/${res.payment.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setPaying(false);
    }
  }

  const selectedPlan = plans.find((plan) => plan.id === selected);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {active ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5">
          <p className="text-sm text-muted-foreground">{active.table?.name || active.deviceId}</p>
          <p className="mt-1 text-sm">Үлдсэн хугацаа</p>
          <SessionTimer expiresAt={active.expiresAt} size="md" />
          <div className="mt-4 flex gap-2">
            <Button asChild className="flex-1">
              <Link href={`/session/${active.id}`}>Нээх</Link>
            </Button>
            <Button variant="secondary" className="flex-1" asChild>
              <Link href={`/session/${active.id}`}>Цаг сунгах</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Цагаа сонгоно уу</h2>
            <p className="text-sm text-muted-foreground">1 минутын багц туршилтын төлбөр. Бусад нь бодит үнэ.</p>
          </div>
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              {...plan}
              selected={selected === plan.id}
              onSelect={() => setSelected(plan.id)}
            />
          ))}
          <Button className="w-full" size="lg" onClick={pay} disabled={paying || !selected}>
            {paying ? "Үүсгэж байна..." : (selectedPlan?.durationMinutes || 0) <= 1 ? "Туршилтаар төлөх" : "Төлөх"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Төхөөрөмжийн төлөв</p>
          <p className="mt-2 font-medium">{active ? "Ашиглаж байна" : "Чөлөөтэй"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Бөмбөгний төлөв</p>
          <p className="mt-2 font-medium">8 / 8</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-medium">Сүүлийн тоглолтууд</h2>
        <div className="space-y-2">
          {sessions.slice(0, 8).map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium">{s.table?.name || s.deviceId}</p>
                <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString("mn-MN")}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">{formatMNT(s.totalAmount)}</p>
                <StatusBadge value={s.status} />
              </div>
            </Link>
          ))}
        </div>
      </div>
      <Button variant="ghost" className="w-full text-muted-foreground" onClick={logout}>
        Гарах
      </Button>
    </div>
  );
}
