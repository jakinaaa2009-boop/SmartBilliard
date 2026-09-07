import { minutesLabel, formatMNT, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function PricingCard({
  name,
  durationMinutes,
  price,
  popular,
  selected,
  onSelect,
}: {
  name: string;
  durationMinutes: number;
  price: number;
  popular?: boolean;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative w-full rounded-2xl border p-4 text-left transition",
        selected ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-card hover:border-primary/40"
      )}
    >
      {popular ? (
        <Badge className="absolute right-3 top-3" variant="success">
          Хамгийн их сонголт
        </Badge>
      ) : null}
      <p className="text-lg font-semibold">{name || minutesLabel(durationMinutes)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{minutesLabel(durationMinutes)}</p>
      <p className="mt-3 text-2xl font-semibold text-primary">{formatMNT(price)}</p>
    </button>
  );
}
