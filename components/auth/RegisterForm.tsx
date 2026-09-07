"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/client-api";
import { toast } from "sonner";
import Link from "next/link";

export function RegisterForm({
  redirectTo,
  onSuccess,
  embedded,
}: {
  redirectTo?: string;
  onSuccess?: () => void;
  embedded?: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = redirectTo || search.get("redirect") || "";
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false,
  });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/register", { method: "POST", body: JSON.stringify(form) });
      toast.success("Бүртгэл амжилттай");
      if (onSuccess) {
        onSuccess();
        return;
      }
      router.push(redirect || "/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label>Бүтэн нэр</Label>
        <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Утас</Label>
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Имэйл (заавал биш)</Label>
        <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Нууц үг</Label>
        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Нууц үг давтах</Label>
        <Input
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={form.acceptedTerms}
          onCheckedChange={(v) => setForm({ ...form, acceptedTerms: Boolean(v) })}
        />
        Үйлчилгээний нөхцөлийг зөвшөөрч байна
      </label>
      <Button className="w-full" disabled={loading}>
        {loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
      </Button>
      {!embedded ? (
        <p className="pt-1 text-center text-sm text-muted-foreground">
          Бүртгэлтэй юу?{" "}
          <Link href={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login"} className="text-primary">
            Нэвтрэх
          </Link>
        </p>
      ) : null}
    </form>
  );
}
