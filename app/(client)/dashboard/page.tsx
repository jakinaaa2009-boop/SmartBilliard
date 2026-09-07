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
import { QrScanButton } from "@/components/client/QrScanButton";
import { Camera } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const leftRef = useRef(false);

  async function load() {
    if (leftRef.current) return;
    try {
      const res = await api<{ sessions: SessionRow[] }>("/api/users/me/sessions");
      if (!leftRef.current) setSessions(res.sessions);
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
    const t = setInterval(() => void load(), 5000);
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
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Camera className="h-8 w-8" />
          </div>
          <p className="font-medium">Идэвхтэй тоглолт алга</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Ширээний QR кодыг камераар уншуулаад тоглож эхэлнэ үү.
          </p>
          <div className="mt-5 w-full max-w-xs">
            <QrScanButton />
          </div>
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
