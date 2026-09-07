import { cn } from "@/lib/utils";

export function BallCounter({
  detected,
  expected,
  large,
}: {
  detected: number;
  expected: number;
  large?: boolean;
}) {
  const missing = Math.max(0, expected - detected);
  return (
    <div>
      <p className={cn("font-semibold", large ? "text-4xl" : "text-xl")}>
        {detected} / {expected}
      </p>
      {missing > 0 ? <p className="mt-1 text-sm text-destructive">Дутуу: {missing}</p> : null}
    </div>
  );
}
