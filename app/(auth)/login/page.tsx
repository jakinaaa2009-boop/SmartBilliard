import { AppLogo } from "@/components/AppLogo";
import { LoginForm } from "@/components/auth/LoginForm";
import { Suspense } from "react";
import Link from "next/link";

export default function ClientLoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 ball-grid">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.12),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.04),transparent_30%)]" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card/90 p-6 shadow-card backdrop-blur">
        <div className="mb-6 flex flex-col items-center text-center">
          <AppLogo href="/" />
          <h1 className="mt-5 text-2xl font-semibold">Нэвтрэх</h1>
          <p className="mt-1 text-sm text-muted-foreground">Тоглохын тулд нэвтэрнэ үү</p>
        </div>
        <Suspense>
          <LoginForm portal="CLIENT" />
        </Suspense>
        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          <Link href="/admin/login" className="hover:text-muted-foreground">
            Оператор нэвтрэх
          </Link>
        </p>
      </div>
    </div>
  );
}
