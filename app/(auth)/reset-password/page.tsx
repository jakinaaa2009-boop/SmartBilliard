"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { toast } from "sonner";
import { Suspense } from "react";

function ResetForm() {
  const search = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const identifier = search.get("phone") || "";
  const token = search.get("token") || "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/auth/reset", {
        method: "POST",
        body: JSON.stringify({ identifier, token, password }),
      });
      toast.success("Нууц үг шинэчлэгдлээ");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Алдаа");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input type="password" placeholder="Шинэ нууц үг" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button className="w-full">Хадгалах</Button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <h1 className="mb-4 text-xl font-semibold">Шинэ нууц үг</h1>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
