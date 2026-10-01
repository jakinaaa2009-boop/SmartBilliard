"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, CreditCard, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Нүүр", icon: Home },
  { href: "/history", label: "Тоглолтууд", icon: History },
  { href: "/payments", label: "Төлбөр", icon: CreditCard },
  { href: "/profile", label: "Профайл", icon: User },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#0b1012]/95 px-2 pb-2 pt-1 backdrop-blur md:hidden">
      <div className="grid grid-cols-4 items-end">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl py-2 text-[11px]",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
