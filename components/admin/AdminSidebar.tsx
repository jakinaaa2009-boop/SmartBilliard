"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Cpu,
  Table2,
  Users,
  Timer,
  CreditCard,
  Wallet,
  Bell,
  FileBarChart,
  Tag,
  Settings,
  LogOut,
} from "lucide-react";
import { AppLogo } from "@/components/AppLogo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const items = [
  { href: "/admin", label: "Хяналтын самбар", icon: LayoutDashboard },
  { href: "/admin/devices", label: "Төхөөрөмжүүд", icon: Cpu },
  { href: "/admin/tables", label: "Ширээнүүд", icon: Table2 },
  { href: "/admin/users", label: "Хэрэглэгчид", icon: Users },
  { href: "/admin/sessions", label: "Сессиуд", icon: Timer },
  { href: "/admin/payments", label: "Төлбөрүүд", icon: CreditCard },
  { href: "/admin/finance", label: "Орлого / Зарлага", icon: Wallet },
  { href: "/admin/alerts", label: "Анхааруулга", icon: Bell },
  { href: "/admin/reports", label: "Тайлан", icon: FileBarChart },
  { href: "/admin/settings/pricing", label: "Үнийн тохиргоо", icon: Tag },
  { href: "/admin/settings", label: "Системийн тохиргоо", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Гарлаа");
    router.push("/login");
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-[#0b1012] lg:flex">
      <div className="border-b border-border px-5 py-5">
        <AppLogo href="/" />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || (item.href !== "/admin/settings" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Гарах
        </button>
      </div>
    </aside>
  );
}
