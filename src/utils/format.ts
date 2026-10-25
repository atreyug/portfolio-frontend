import type { CurrencyCode } from "@/types/api";

export const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹", USD: "$" };

export function currencySymbol(code?: string): string {
  return CURRENCY_SYMBOL[(code ?? "INR").toUpperCase()] ?? `${code ?? "INR"} `;
}

export function formatCurrency(
  value: number | null | undefined,
  currency: CurrencyCode = "INR",
  opts: { compact?: boolean; sign?: boolean; decimals?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const locale = currency.toUpperCase() === "INR" ? "en-IN" : "en-US";
  const sign = opts.sign && value !== 0 ? (value > 0 ? "+" : "-") : value < 0 ? "-" : "";
  try {
    return (
      sign +
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency.toUpperCase(),
        notation: opts.compact ? "compact" : "standard",
        maximumFractionDigits: opts.compact ? 1 : (opts.decimals ?? (abs < 100 ? 2 : 0)),
        minimumFractionDigits: 0,
      }).format(abs)
    );
  } catch {
    return `${sign}${currencySymbol(currency)}${abs.toLocaleString()}`;
  }
}

export function formatNumber(value: number | null | undefined, opts: { compact?: boolean; decimals?: number } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.decimals ?? 2,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  opts: { sign?: boolean; decimals?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = opts.sign && value !== 0 ? (value > 0 ? "+" : "-") : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(opts.decimals ?? 2)}%`;
}

export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return (
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d) +
    " · " +
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(d)
  );
}

export function timeAgo(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return String(value);
  const seconds = Math.max(1, Math.floor((Date.now() - d) / 1000));
  const units: Array<[number, string]> = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let amount = seconds;
  let unit = "second";
  for (const [factor, name] of units) {
    if (amount < factor) {
      unit = name;
      break;
    }
    amount = Math.floor(amount / factor);
    unit = name;
  }
  return `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
}

export function titleCase(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-./[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
