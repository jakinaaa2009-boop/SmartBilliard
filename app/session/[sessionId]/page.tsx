"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client-api";
import { SessionTimer, useRemaining } from "@/components/SessionTimer";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { PricingCard } from "@/components/PricingCard";
import { BallCounter } from "@/components/BallCounter";
import { formatMNT } from "@/lib/utils";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { LoadingSkeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface SessionData {
  session: {
    id: string;
    status: string;
    expiresAt?: string;
    totalAmount: number;
    expectedBallCount: number;
    returnedBallCount: number;
    purchasedMinutes: number;
  };
  table: { name: string; number: number };
  device: {
    online: boolean;
    boxStatus: string;
    ballCount: number;
    expectedBallCount: number;
    alarm: boolean;
  } | null;
}

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<SessionData | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [plans, setPlans] = useState<{ id: string; name: string; durationMinutes: number; price: number; popular?: boolean }[]>([]);
  const [paidBanner, setPaidBanner] = useState(search.get("paid") === "1");
  const remaining = useRemaining(data?.session.expiresAt);

  async function load() {
    const res = await api<SessionData>(`/api/sessions/${params.sessionId}`);
    setData(res);
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 400);
    return () => clearInterval(t);
  }, [params.sessionId]);

  useEffect(() => {
    if (paidBanner) {
      const t = setTimeout(() => setPaidBanner(false), 4000);
      return () => clearTimeout(t);
    }
  }, [paidBanner]);

  useEffect(() => {
    if (!data) return;
    if (remaining === 600) toast.warning("10 минут үлдлээ");
    if (remaining === 300) toast.warning("5 минут үлдлээ");
    if (remaining === 60) toast.warning("Тоглох хугацаа дуусах гэж байна.");
  }, [remaining, data]);

  async function end() {
    await api(`/api/sessions/${params.sessionId}/end`, { method: "POST" });
    toast.success("Тоглолт дууслаа");
    void load();
  }

  async function extend(planId: string) {
    const res = await api<{ payment: { id: string }; started?: boolean }>(`/api/sessions/${params.sessionId}/extend`, {
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
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <LoadingSkeleton />
      </div>
    );
  }

  const s = data.session;
  const missing = s.status === "BALLS_MISSING" || (s.status === "RETURN_REQUIRED" && data.device && data.device.ballCount < data.device.expectedBallCount);

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-6">
      {paidBanner ? (
        <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h2 className="mt-3 text-xl font-semibold">Төлбөр амжилттай</h2>
          <p className="mt-1 text-sm text-muted-foreground">Бөмбөг авах төхөөрөмж нээгдэж байна.</p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{data.table?.name}</h1>
        <span className="flex items-center gap-2 text-sm text-primary">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulseDot" />
          {s.status === "ACTIVE" || s.status === "EXTENDED" ? "Идэвхтэй" : s.status}
        </span>
      </div>

      {s.status === "COMPLETED" ? (
        <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/10 p-8 text-center">
          <h2 className="text-2xl font-semibold">Бүх бөмбөгөө хийсэнд баярлалаа.</h2>
          <p className="mt-2 text-muted-foreground">Дахин үйлчлүүлнэ үү.</p>
          <Button className="mt-6" onClick={() => router.push("/dashboard")}>
            Нүүр
          </Button>
        </div>
      ) : null}

      {s.status === "RETURN_REQUIRED" || s.status === "BALLS_MISSING" ? (
        <div className={`mt-6 rounded-2xl border p-6 ${missing ? "border-destructive/40 bg-destructive/10" : "border-warning/40 bg-warning/10"}`}>
          <h2 className="text-xl font-semibold">Тоглох хугацаа дууслаа.</h2>
          <p className="mt-2 text-sm">Бөмбөгөө төхөөрөмжид буцаан хийнэ үү. Тоо шууд шинэчлэгдэнэ.</p>
          <div className="mt-4">
            <BallCounter detected={data.device?.ballCount ?? 0} expected={data.device?.expectedBallCount ?? s.expectedBallCount} large />
          </div>
          {missing ? (
            <div className="mt-4">
              <p className="font-medium text-destructive">Бөмбөг бүрэн буцаагдаагүй байна.</p>
              <p className="mt-2">Буцаасан: {data.device?.ballCount ?? s.returnedBallCount}</p>
              <p>Нийт: {s.expectedBallCount}</p>
              <p>Дутуу: {s.expectedBallCount - (data.device?.ballCount ?? s.returnedBallCount)}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {["ACTIVE", "EXTENDED"].includes(s.status) ? (
        <>
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">Үлдсэн хугацаа</p>
            <SessionTimer expiresAt={s.expiresAt} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Төхөөрөмж</p>
              <p className="mt-1 font-medium">{data.device?.online ? "Онлайн" : "Оффлайн"}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Бөмбөг</p>
              <BallCounter detected={data.device?.ballCount ?? 0} expected={data.device?.expectedBallCount ?? 8} />
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Төлбөр</p>
              <p className="mt-1 font-medium">{formatMNT(s.totalAmount)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Хайрцаг</p>
              <p className="mt-1 font-medium">{data.device?.boxStatus === "UNLOCKED" ? "Нээгдсэн" : "Хаалттай"}</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <Button className="w-full" size="lg" onClick={async () => {
              const p = await api<{ plans: typeof plans }>("/api/pricing");
              setPlans(p.plans);
              setExtendOpen(true);
            }}>
              Цаг сунгах
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setEndOpen(true)}>
              Тоглолт дуусгах
            </Button>
          </div>
        </>
      ) : null}

      <ConfirmationModal
        open={endOpen}
        onOpenChange={setEndOpen}
        title="Тоглолтыг дуусгахдаа итгэлтэй байна уу?"
        description="Хугацаа дуусахаас өмнө дуусгавал үлдсэн цаг хадгалагдахгүй."
        danger
        confirmLabel="Дуусгах"
        onConfirm={() => void end()}
      />

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
