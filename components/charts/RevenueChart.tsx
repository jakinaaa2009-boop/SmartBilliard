"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMNT } from "@/lib/utils";

export function RevenueChart({ data }: { data: { date: string; total: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1F2A2E" vertical={false} />
          <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} tickLine={false} />
          <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip
            contentStyle={{ background: "#101619", border: "1px solid #1F2A2E", borderRadius: 12 }}
            formatter={(v) => formatMNT(Number(v || 0))}
          />
          <Area type="monotone" dataKey="total" stroke="#22C55E" fill="url(#rev)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
