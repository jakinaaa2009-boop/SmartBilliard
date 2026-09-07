"use client";

import { useState } from "react";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { toast } from "sonner";
import Link from "next/link";

export default function ForgotPage() {
  const [identifier, setIdentifier] = useState("");
  const [resetUrl, setResetUrl] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api<{ resetUrl?: string }>("/api/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ identifier }),
      });
      toast.success("Хэрэв бүртгэл байвал холбоос илгээгдлээ");
      if (res.resetUrl) setResetUrl(res.resetUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <AppLogo href="/login" />
        <h1 className="mt-5 text-xl font-semibold">Нууц үг сэргээх</h1>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <Input placeholder="Утас эсвэл имэйл" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <Button className="w-full">Илгээх</Button>
        </form>
        {resetUrl ? (
          <p className="mt-3 text-sm">
            Dev холбоос:{" "}
            <Link className="text-primary" href={resetUrl}>
              {resetUrl}
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
