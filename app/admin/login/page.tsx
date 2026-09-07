import { AppLogo } from "@/components/AppLogo";
import { LoginForm } from "@/components/auth/LoginForm";
import { Suspense } from "react";

export default function AdminLoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 ball-grid">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(34,197,94,0.1),transparent_40%)]" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card/90 p-6 shadow-card backdrop-blur">
        <div className="mb-6 flex flex-col items-center text-center">
          <AppLogo href="/" />
          <h1 className="mt-5 text-2xl font-semibold">Оператор</h1>
          <p className="mt-1 text-sm text-muted-foreground">Админ удирдлагын самбар</p>
        </div>
        <Suspense>
          <LoginForm portal="ADMIN" />
        </Suspense>
      </div>
    </div>
  );
}
