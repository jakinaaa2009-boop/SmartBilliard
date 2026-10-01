"use client";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AppLogo } from "@/components/AppLogo";
import { useState } from "react";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const mobileItems = [
  ["/admin", "Хяналтын самбар"],
  ["/admin/devices", "Төхөөрөмж"],
  ["/admin/users", "Хэрэглэгчид"],
  ["/admin/sessions", "Сессиуд"],
  ["/admin/payments", "Төлбөрүүд"],
  ["/admin/finance", "Орлого / Зарлага"],
  ["/admin/alerts", "Анхааруулга"],
  ["/admin/reports", "Тайлан"],
  ["/admin/settings/pricing", "Үнийн тохиргоо"],
  ["/admin/settings", "Системийн тохиргоо"],
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-60">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <AppLogo href="/admin" subtitle={false} />
          <button onClick={() => setOpen(!open)} className="rounded-xl border border-border p-2">
            <Menu className="h-5 w-5" />
          </button>
        </div>
        {open ? (
          <div className="grid gap-1 border-b border-border p-3 lg:hidden">
            {mobileItems.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-white/5"
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </div>
        ) : null}
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
