"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { PricingCard } from "@/components/PricingCard";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { SessionTimer } from "@/components/SessionTimer";
import { BallCounter } from "@/components/BallCounter";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/EmptyState";
import { AppLogo } from "@/components/AppLogo";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

interface PlayData {
  table: { id: string; number: number; name: string; status: string };
  device: {
    deviceId: string;
    online: boolean;
    boxStatus: string;
    detectedBallCount: number;
    expectedBallCount: number;
    operationalState: string;
  };
  session?: { id: string; status: string; expiresAt?: string } | null;
}

export default function PlayPage() {
  const params = useParams<{ deviceId: string }>();
  const router = useRouter();
  const deviceId = params.deviceId.toUpperCase();
  const [data, setData] = useState<PlayData | null>(null);
  const [plans, setPlans] = useState<
    { id: string; name: string; durationMinutes: number; price: number; popular?: boolean }[]
  >([]);
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ id: string; role: string } | null | undefined>(undefined);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  async function checkAuth() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const json = await res.json();
      setUser(json.user || null);
    } catch {
      setUser(null);
    }
  }

  async function load() {
    try {
      const [play, pricing] = await Promise.all([
        api<PlayData>(`/api/play/${deviceId}`),
        api<{ plans: typeof plans }>("/api/pricing"),
      ]);
      setData(play);
      setPlans(pricing.plans);
      const popular = pricing.plans.find((p) => p.popular) || pricing.plans[1] || pricing.plans[0];
      if (popular) setSelected(popular.id);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    }
  }

  useEffect(() => {
    void checkAuth();
    void load();
  }, [deviceId]);

  const available = useMemo(() => {
    if (!data) return false;
    return (
      data.device.online &&
      ["AVAILABLE", "RESERVED"].includes(data.table.status) &&
      !["ACTIVE", "EXTENDED", "RETURN_REQUIRED", "BALLS_MISSING"].includes(data.session?.status || "") &&
      data.table.status !== "MAINTENANCE"
    );
  }, [data]);

  async function pay() {
    if (!user) {
      toast.error("Эхлээд нэвтэрнэ үү");
      return;
    }
    if (!selected) return;
    setLoading(true);
    try {
      const res = await api<{ payment: { id: string }; started?: boolean }>("/api/payments/qpay/create", {
        method: "POST",
        body: JSON.stringify({ deviceId, pricingPlanId: selected, type: "SESSION" }),
      });
      if (res.started) {
        toast.success("Тоглолт эхэллээ");
        router.replace("/dashboard");
        return;
      }
      router.push(`/payment/${res.payment.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoading(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }
  if (!data || user === undefined) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <LoadingSkeleton />
      </div>
    );
  }

  const playPath = `/play/${deviceId}`;

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-6">
      <AppLogo href="/" />
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{data.table.name}</h1>
          <span className={cn("flex items-center gap-2 text-sm", data.device.online ? "text-primary" : "text-destructive")}>
            <span className={cn("h-2 w-2 rounded-full", data.device.online ? "bg-primary animate-pulseDot" : "bg-destructive")} />
            {data.device.online ? "Онлайн" : "Оффлайн"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-muted-foreground">Бөмбөг</p>
            <BallCounter detected={data.device.detectedBallCount} expected={data.device.expectedBallCount} />
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-muted-foreground">Төлөв</p>
            <div className="mt-1">
              <StatusBadge value={data.session?.status || data.table.status} />
            </div>
          </div>
        </div>
        {data.session?.expiresAt && ["ACTIVE", "EXTENDED"].includes(data.session.status) ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">Үлдсэн хугацаа</p>
            <SessionTimer expiresAt={data.session.expiresAt} size="md" />
          </div>
        ) : null}
      </div>

      {!user ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Тоглохын тулд нэвтэрнэ үү</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.table.name} · {deviceId}
          </p>
          <div className="mt-4 mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
            <button
              type="button"
              className={cn("rounded-xl py-2 text-sm", authMode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              onClick={() => setAuthMode("login")}
            >
              Нэвтрэх
            </button>
            <button
              type="button"
              className={cn("rounded-xl py-2 text-sm", authMode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              onClick={() => setAuthMode("register")}
            >
              Бүртгүүлэх
            </button>
          </div>
          <Suspense>
            {authMode === "login" ? (
              <LoginForm portal="CLIENT" redirectTo={playPath} embedded onSuccess={() => void checkAuth()} />
            ) : (
              <RegisterForm redirectTo={playPath} embedded onSuccess={() => void checkAuth()} />
            )}
          </Suspense>
        </div>
      ) : !data.device.online ? (
        <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          Төхөөрөмжтэй холбогдох боломжгүй байна.
        </p>
      ) : available ? (
        <div className="mt-6 space-y-3">
          <h2 className="text-lg font-medium">Тоглох цагаа сонгоно уу</h2>
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              {...plan}
              selected={selected === plan.id}
              onSelect={() => setSelected(plan.id)}
            />
          ))}
          <Button className="w-full" size="lg" onClick={pay} disabled={loading}>
            {loading ? "Үүсгэж байна..." : "QPay-аар төлөх"}
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4 text-center">
          <p className="text-muted-foreground">
            {data.table.status === "MAINTENANCE" ? "Засвар хийгдэж байна" : "Ашиглагдаж байна"}
          </p>
          {data.session?.id ? (
            <Button className="w-full" onClick={() => router.push(`/session/${data.session!.id}`)}>
              Сесс рүү орох
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
