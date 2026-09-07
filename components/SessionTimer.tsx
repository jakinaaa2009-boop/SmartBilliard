"use client";

import { useEffect, useState } from "react";
import { formatDuration, remainingSeconds } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function SessionTimer({
  expiresAt,
  className,
  size = "lg",
}: {
  expiresAt?: string | Date | null;
  className?: string;
  size?: "lg" | "md" | "sm";
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = expiresAt ? Math.floor((new Date(expiresAt).getTime() - now) / 1000) : 0;
  const sizes = {
    lg: "text-5xl font-semibold tracking-tight",
    md: "text-3xl font-semibold",
    sm: "text-lg font-medium",
  };
  return (
    <div className={cn(sizes[size], seconds <= 60 ? "text-destructive" : seconds <= 300 ? "text-warning" : "", className)}>
      {formatDuration(seconds)}
    </div>
  );
}

export function useRemaining(expiresAt?: string | Date | null) {
  const [seconds, setSeconds] = useState(() => (expiresAt ? remainingSeconds(expiresAt) : 0));
  useEffect(() => {
    const t = setInterval(() => setSeconds(expiresAt ? remainingSeconds(expiresAt) : 0), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return seconds;
}
