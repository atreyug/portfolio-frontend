import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CurrencyCode } from "@/types/api";
import { formatCurrency, formatPercent } from "@/utils/format";

export interface DonutItem {
  name: string;
  value: number;
}

const PALETTE = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#f43f5e", "#14b8a6", "#64748b", "#84cc16"];

function DonutTooltip(props: {
  active?: boolean;
  currency: CurrencyCode;
  total: number;
  payload?: Array<{ name?: string; value?: number }>;
}) {
  const { active, payload, currency, total } = props;
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const value = Number(item.value ?? 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{item.name}</p>
      <p className="mt-0.5 text-slate-500">
        {formatCurrency(value, currency)} · {total > 0 ? formatPercent((value / total) * 100, { decimals: 1 }) : "—"}
      </p>
    </div>
  );
}

export function AllocationDonut({
  items,
  currency,
  height = 240,
  centerLabel,
}: {
  items: DonutItem[];
  currency: CurrencyCode;
  height?: number;
  centerLabel?: string;
}) {
  const total = useMemo(() => items.reduce((sum, i) => sum + i.value, 0), [items]);
  if (items.length === 0 || total <= 0) return null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
      <div className="relative" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2.5}
              strokeWidth={0}
              cornerRadius={4}
            >
              {items.map((item, i) => (
                <Cell key={item.name} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip currency={currency} total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{centerLabel ?? "Total"}</span>
          <span className="text-lg font-bold tracking-tight text-slate-900">{formatCurrency(total, currency, { compact: true })}</span>
        </div>
      </div>
      <ul className="grid w-full flex-1 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {items.map((item, i) => (
          <li key={item.name} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate font-medium text-slate-700" title={item.name}>
              {item.name}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">
              {total > 0 ? formatPercent((item.value / total) * 100, { decimals: 1 }) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
