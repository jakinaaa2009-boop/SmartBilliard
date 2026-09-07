import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
      <Inbox className="mb-3 h-10 w-10 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? (
        <Button className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Дахин оролдох
        </Button>
      ) : null}
    </div>
  );
}
