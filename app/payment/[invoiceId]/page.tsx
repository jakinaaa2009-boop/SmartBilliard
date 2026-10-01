"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { PaymentQR } from "@/components/PaymentQR";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { formatMNT, minutesLabel } from "@/lib/utils";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/ui/skeleton";

interface PaymentRes {
  payment: {
    id: string;
    amount: number;
    status: string;
    qrImage?: string;
    urls?: { name: string; link: string }[];
    type: string;
  };
  session?: { id: string } | null;
  mock?: boolean;
  test?: boolean;
}

export default function PaymentPage() {
  const params = useParams<{ invoiceId: string }>();
  const router = useRouter();
  const [data, setData] = useState<PaymentRes | null>(null);
  const [mock, setMock] = useState(false);

  async function load() {
    const res = await api<PaymentRes>(`/api/payments/${params.invoiceId}/status`);
    setData(res);
    if (res.payment.status === "PAID" && res.session?.id) {
      toast.success("Төлбөр амжилттай.");
      router.replace(`/session/${res.session.id}?paid=1`);
    }
  }

  useEffect(() => {
    void fetch("/api/public/config")
      .then((r) => r.json())
      .then((d) => setMock(Boolean(d.mockPayment)));
    void load();
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [params.invoiceId]);

  async function simulate() {
    try {
      const res = await api<PaymentRes>(`/api/payments/${params.invoiceId}/simulate`, { method: "POST" });
      if (res.session?.id) router.replace(`/session/${res.session.id}?paid=1`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа");
    }
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-8">
      <h1 className="text-center text-xl font-semibold">QPay төлбөр</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        QR кодыг банкны апп-аар уншуулж төлбөрөө төлнө үү.
      </p>
      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex justify-center">
          <StatusBadge value={data.payment.status} />
        </div>
        <PaymentQR src={data.payment.qrImage} amountLabel={formatMNT(data.payment.amount)} />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {data.payment.status === "PENDING" ? "Төлбөр хүлээгдэж байна..." : data.payment.status}
        </p>
        {data.payment.urls?.length ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {data.payment.urls.map((u) => (
              <a
                key={u.name}
                href={u.link}
                className="rounded-xl border border-border px-3 py-2 text-center text-sm hover:bg-white/5"
              >
                {u.name}
              </a>
            ))}
          </div>
        ) : null}
        {mock || data.test ? (
          <Button className="mt-5 w-full" onClick={simulate}>
            Туршилтаар төлөх
          </Button>
        ) : null}
      </div>
    </div>
  );
}
