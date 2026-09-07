import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "muted";
}) {
  const styles = {
    default: "bg-accent text-accent-foreground",
    success: "bg-primary/15 text-primary",
    warning: "bg-warning/15 text-warning",
    danger: "bg-destructive/15 text-destructive",
    muted: "bg-white/5 text-muted-foreground",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}
