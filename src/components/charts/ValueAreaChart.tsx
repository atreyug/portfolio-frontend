import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrencyCode } from "@/types/api";
import { formatCurrency } from "@/utils/format";

export interface AreaPoint {
  x: string | number;
  y: number;
}

function AreaTooltip(props: {
  active?: boolean;
  currency: CurrencyCode;
  label?: string | number;
  payload?: Array<{ value?: number }>;
}) {
  const { active, payload, label, currency } = props;
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{String(label)}</p>
      <p className="mt-0.5 text-emerald-600">{formatCurrency(Number(payload[0].value ?? 0), currency)}</p>
    </div>
  );
}

export function ValueAreaChart({
  data,
  currency,
  color = "#10b981",
  height = 260,
  showCurrencyAxis = true,
}: {
  data: AreaPoint[];
  currency: CurrencyCode;
  color?: string;
  height?: number;
  showCurrencyAxis?: boolean;
}) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (data.length === 0) return null;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="x"
            tickLine={false}
            axisLine={false}
            minTickGap={42}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickMargin={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickFormatter={(v: number) => (showCurrencyAxis ? formatCurrency(v, currency, { compact: true }) : String(v))}
          />
          <Tooltip content={<AreaTooltip currency={currency} />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }} />
          <Area
            type="monotone"
            dataKey="y"
            stroke={color}
            strokeWidth={2.2}
            fill={`url(#grad-${gid})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
