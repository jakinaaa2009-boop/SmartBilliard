import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "green" | "red" | "yellow";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight",
          accent === "green" && "text-primary",
          accent === "red" && "text-destructive",
          accent === "yellow" && "text-warning"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
