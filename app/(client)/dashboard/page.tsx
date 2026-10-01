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
import { BallCounter } from "@/components/BallCounter";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface SessionRow {
  id: string;
  status: string;
  expiresAt?: string;
  totalAmount: number;
  purchasedMinutes: number;
  createdAt: string;
  table?: { name: string; deviceId?: string };
  deviceId: string;
  ballCount?: number;
  expectedBallCount?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string; durationMinutes: number; price: number; popular?: boolean }[]>([]);
  const [selected, setSelected] = useState("");
  const [deviceId, setDeviceId] = useState("BILLIARD_01");
  const [paying, setPaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [extendOpen, setExtendOpen] = useState(false);
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
    const t = setInterval(() => void load(), 400);
    return () => {
      leftRef.current = true;
      clearInterval(t);
    };
  }, []);

  const active = sessions.find((s) => ["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"].includes(s.status));
  const returning = active?.status === "RETURN_REQUIRED" || active?.status === "BALLS_MISSING";
  const expectedBalls = active?.expectedBallCount || 8;
  const ballCount = !active ? expectedBalls : returning ? active.ballCount || 0 : 0;

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
      const res = await api<{ payment: { id: string }; started?: boolean }>("/api/payments/qpay/create", {
        method: "POST",
        body: JSON.stringify({ deviceId, pricingPlanId: selected, type: "SESSION" }),
      });
      if (res.started) {
        toast.success("Тоглолт эхэллээ");
        await load();
        return;
      }
      router.push(`/payment/${res.payment.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setPaying(false);
    }
  }

  async function extend(planId: string) {
    if (!active) return;
    setPaying(true);
    try {
      const res = await api<{ payment: { id: string }; started?: boolean }>(`/api/sessions/${active.id}/extend`, {
        method: "POST",
        body: JSON.stringify({ pricingPlanId: planId }),
      });
      setExtendOpen(false);
      if (res.started) {
        toast.success("Цаг сунгагдлаа");
        await load();
        return;
      }
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
        <div className={`rounded-2xl border p-5 ${returning ? "border-warning/40 bg-warning/10" : "border-primary/30 bg-primary/10"}`}>
          <p className="text-sm text-muted-foreground">{active.table?.name || active.deviceId}</p>
          {returning ? (
            <>
              <p className="mt-1 text-sm">Хугацаа дууслаа. Бөмбөгөө тоолж байна.</p>
              <div className="mt-3">
                <BallCounter detected={ballCount} expected={expectedBalls} large />
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm">Үлдсэн хугацаа</p>
              <SessionTimer expiresAt={active.expiresAt} size="md" />
            </>
          )}
          <div className="mt-4 flex gap-2">
            {returning ? null : (
              <Button className="flex-1" onClick={() => setExtendOpen(true)}>
                Цаг сунгах
              </Button>
            )}
            <Button variant="secondary" className="flex-1" asChild>
              <Link href={`/session/${active.id}`}>Дэлгэрэнгүй</Link>
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
          <p className="mt-2 font-medium">{returning ? "Бөмбөг тоолж байна" : active ? "Ашиглаж байна" : "Чөлөөтэй"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Бөмбөгний төлөв</p>
          <p className="mt-2 font-medium">{ballCount} / {expectedBalls}</p>
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

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent>
          <DialogTitle>Цаг сунгах</DialogTitle>
          <div className="mt-4 space-y-3">
            {plans.map((plan) => (
              <PricingCard key={plan.id} {...plan} onSelect={() => void extend(plan.id)} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
