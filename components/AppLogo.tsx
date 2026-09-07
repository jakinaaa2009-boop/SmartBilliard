import Link from "next/link";
import { cn } from "@/lib/utils";

export function AppLogo({
  className,
  subtitle = true,
  href = "/",
}: {
  className?: string;
  subtitle?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-3", className)}>
      <div className="eight-ball relative flex h-11 w-11 items-center justify-center rounded-full">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-black">
          8
        </div>
      </div>
      <div>
        <div className="text-base font-semibold leading-tight">Smart Billiard</div>
        {subtitle ? <div className="text-xs text-muted-foreground">Ухаалаг систем</div> : null}
      </div>
    </Link>
  );
}
