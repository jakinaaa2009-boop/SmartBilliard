"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client-api";
import { toast } from "sonner";
import Link from "next/link";

export function LoginForm({
  portal,
  redirectTo,
  onSuccess,
  embedded,
}: {
  portal: "CLIENT" | "ADMIN";
  redirectTo?: string;
  onSuccess?: () => void;
  embedded?: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = redirectTo || search.get("redirect") || "";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password, portal }),
      });
      toast.success("Амжилттай нэвтэрлээ");
      if (onSuccess) {
        onSuccess();
        return;
      }
      if (portal === "ADMIN") {
        router.replace(redirect.startsWith("/admin") ? redirect : "/admin");
      } else {
        router.replace(redirect && !redirect.startsWith("/admin") ? redirect : "/dashboard");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{portal === "ADMIN" ? "Имэйл" : "Утас / имэйл"}</Label>
        <Input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={portal === "ADMIN" ? "admin@smartbilliard.mn" : "99110000"}
          autoComplete="username"
        />
      </div>
      <div className="space-y-2">
        <Label>Нууц үг</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <Button className="w-full" disabled={loading}>
        {loading ? "Уншиж байна..." : "Нэвтрэх"}
      </Button>
      {portal === "CLIENT" && !embedded ? (
        <div className="flex items-center justify-between pt-2 text-sm">
          <Link
            href={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : "/register"}
            className="text-primary"
          >
            Бүртгүүлэх
          </Link>
          <Link href="/forgot-password" className="text-muted-foreground">
            Нууц үгээ мартсан уу?
          </Link>
        </div>
      ) : null}
      {portal === "ADMIN" ? (
        <p className="pt-2 text-center text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Нүүр хуудас
          </Link>
        </p>
      ) : null}
    </form>
  );
}
