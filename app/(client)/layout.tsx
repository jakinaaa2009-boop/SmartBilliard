"use client";

import { AppLogo } from "@/components/AppLogo";
import { MobileBottomNav } from "@/components/client/MobileBottomNav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="sticky top-0 z-30 border-b border-border bg-[#080c0e]/80 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <AppLogo href="/dashboard" subtitle={false} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5 md:px-8">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
