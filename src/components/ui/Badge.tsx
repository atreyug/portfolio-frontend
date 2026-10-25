import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatPercent } from "@/utils/format";

type Tone = "emerald" | "rose" | "amber" | "sky" | "slate" | "violet";

const TONES: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/15",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  sky: "bg-sky-50 text-sky-700 ring-sky-600/15",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/10",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15",
};

export function Badge({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Signed-change pill — green for gains, red for losses, neutral when unavailable. */
export function ChangePill({ value, className }: { value: number | undefined; className?: string }) {
  if (value === undefined || Number.isNaN(value)) {
    return <Badge className={className}>—</Badge>;
  }
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <Badge tone={up ? "emerald" : "rose"} className={className}>
      <Icon className="h-3 w-3" />
      {formatPercent(value, { sign: true })}
    </Badge>
  );
}

export function severityTone(severity?: string): Tone {
  const s = (severity ?? "").toLowerCase();
  if (/critical|high|danger|error|breach/.test(s)) return "rose";
  if (/warn|medium|moderate|caution/.test(s)) return "amber";
  if (/info|low|notice/.test(s)) return "sky";
  if (/success|ok|positive|resolved/.test(s)) return "emerald";
  return "slate";
}

export function dotTone(severity?: string): string {
  const tone = severityTone(severity);
  return {
    rose: "bg-rose-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    emerald: "bg-emerald-500",
    slate: "bg-slate-300",
    violet: "bg-violet-500",
  }[tone];
}
