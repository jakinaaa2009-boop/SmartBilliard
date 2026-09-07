"use client";

import { AppLogo } from "@/components/AppLogo";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10 ball-grid">
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card/90 p-6 shadow-card">
        <div className="mb-5 text-center">
          <AppLogo href="/" />
          <h1 className="mt-4 text-xl font-semibold">Бүртгүүлэх</h1>
        </div>
        <Suspense>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
