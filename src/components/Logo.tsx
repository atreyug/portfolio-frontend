import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 shadow-[0_2px_8px_rgba(16,185,129,0.35)]",
        className ?? "h-9 w-9",
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[58%] w-[58%] text-white" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l5-5 4 4 6.5-7.5" />
        <path d="M14.5 8.5h4v4" />
      </svg>
    </span>
  );
}

export function Logo({
  dark = false,
  to,
  compact = false,
}: {
  dark?: boolean;
  to?: string;
  compact?: boolean;
}) {
  const content = (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className={cn("block text-[17px] font-bold tracking-tight", dark ? "text-white" : "text-slate-900")}>
            Meridian
          </span>
          <span className={cn("mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em]", dark ? "text-emerald-400" : "text-emerald-600")}>
            Portfolio AI
          </span>
        </span>
      )}
    </span>
  );
  if (to) {
    return (
      <Link to={to} className="rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        {content}
      </Link>
    );
  }
  return content;
}
