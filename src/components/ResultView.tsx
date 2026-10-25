/**
 * ResultView — renders *whatever the backend actually returned*.
 *
 * Instead of assuming a fixed response schema, this component inspects the
 * payload at runtime and presents it in a polished, structured way:
 *  - scalar fields          → metric tiles (auto currency/percent/date aware)
 *  - arrays of objects      → data tables
 *  - arrays of strings      → insight / risk / news bullet lists
 *  - long text fields       → AI narrative cards
 *  - nested objects         → titled sections
 *  - everything else        → an expandable raw JSON view
 *
 * Nothing is invented: fields that the API does not return simply never appear.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Braces,
  ChevronDown,
  FileText,
  Lightbulb,
  ListChecks,
  Newspaper,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isRecord, toNumber } from "@/utils/payload";
import { formatCurrency, formatDateTime, formatNumber, titleCase } from "@/utils/format";
import type { CurrencyCode } from "@/types/api";
import { cn } from "@/utils/cn";

type ScalarKind = "currency" | "percent" | "count" | "date" | "number" | "boolean" | "text";

const CUR_RE = /(price|value|nav|amount|invest|cost|target|corpus|pnl|profit|loss|sip|lumpsum|worth|premium|balance|total|buy|sell|fee|tax)/i;
const PCT_RE = /(pct|percent|percentage|xirr|cagr|weight|allocation|yield|return|change)/i;
const COUNT_RE = /(count|quantity|qty|units|number|months?|days?|years?|schemes?|alerts?|holdings?)/i;
const DATE_RE = /(date$|^date|_at$|timestamp|datetime)/i;
const TONE_RE = /(pnl|profit|loss|gain|return|change|growth|xirr)/i;

function classify(key: string, value: unknown): ScalarKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string") {
    if (DATE_RE.test(key) && value.length >= 6 && !Number.isNaN(Date.parse(value))) return "date";
    return "text";
  }
  const n = toNumber(value);
  if (n === undefined) return "text";
  if (PCT_RE.test(key)) return "percent";
  if (CUR_RE.test(key)) return "currency";
  if (COUNT_RE.test(key)) return "count";
  return "number";
}

function formatScalar(kind: ScalarKind, value: unknown, currency: CurrencyCode): string {
  if (kind === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "—";
  if (kind === "date") return formatDateTime(String(value));
  const n = toNumber(value);
  if (kind === "currency" && n !== undefined) return formatCurrency(n, currency);
  if (kind === "percent" && n !== undefined) return `${n.toFixed(2)}%`;
  if (kind === "count" && n !== undefined) return formatNumber(n, { decimals: Number.isInteger(n) ? 0 : 2 });
  if (kind === "number" && n !== undefined) return formatNumber(n, { decimals: 4 });
  return String(value);
}

function toneClass(key: string, value: unknown): string {
  const n = toNumber(value);
  if (n === undefined || n === 0 || !TONE_RE.test(key)) return "text-slate-900";
  return n > 0 ? "text-emerald-600" : "text-rose-600";
}

const isScalar = (v: unknown): v is string | number | boolean =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean";

/* ------------------------------- Sub views ------------------------------- */

function MetricTiles({ rec, currency }: { rec: Record<string, unknown>; currency: CurrencyCode }) {
  const tiles = Object.entries(rec)
    .filter(([, v]) => isScalar(v) && !(typeof v === "string" && v.length >= 160))
    .slice(0, 12);
  if (tiles.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
      {tiles.map(([key, value]) => {
        const kind = classify(key, value);
        return (
          <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-3">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400" title={titleCase(key)}>
              {titleCase(key)}
            </p>
            <p className={cn("mt-1 truncate text-[15px] font-semibold tabular-nums", kind === "currency" || kind === "percent" || kind === "number" || kind === "count" ? toneClass(key, value) : "text-slate-900")} title={formatScalar(kind, value, currency)}>
              {formatScalar(kind, value, currency)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

const LIST_ICONS: Array<{ re: RegExp; icon: LucideIcon; classes: string }> = [
  { re: /risk|warn|concern|caution|negative|drawdown|volatil|exposure/i, icon: AlertTriangle, classes: "bg-amber-50 text-amber-600" },
  { re: /news|headline|event|market/i, icon: Newspaper, classes: "bg-sky-50 text-sky-600" },
  { re: /suggest|recommend|action|review|improve|rebalance|todo/i, icon: Lightbulb, classes: "bg-violet-50 text-violet-600" },
  { re: /insight|observ|analysis|takeaway|highlight|finding/i, icon: Sparkles, classes: "bg-emerald-50 text-emerald-600" },
];

function StringList({ name, items }: { name: string; items: string[] }) {
  const meta = LIST_ICONS.find((l) => l.re.test(name)) ?? { icon: ListChecks, classes: "bg-slate-100 text-slate-500" };
  const Icon = meta.icon;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <header className="flex items-center gap-2.5">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", meta.classes)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h4 className="text-[13px] font-semibold tracking-tight text-slate-800">{titleCase(name)}</h4>
      </header>
      <ul className="mt-3 space-y-2">
        {items.slice(0, 12).map((item, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-600">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-300" />
            <span>{item}</span>
          </li>
        ))}
        {items.length > 12 && <li className="text-xs text-slate-400">+ {items.length - 12} more</li>}
      </ul>
    </section>
  );
}

function Narrative({ name, text }: { name: string; text: string }) {
  const meta = LIST_ICONS.find((l) => l.re.test(name)) ?? { icon: Sparkles, classes: "bg-emerald-50 text-emerald-600" };
  const Icon = meta.icon;
  return (
    <section className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/60 to-white p-5">
      <header className="flex items-center gap-2.5">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", meta.classes)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h4 className="text-[13px] font-semibold tracking-tight text-slate-800">{titleCase(name)}</h4>
      </header>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{text}</p>
    </section>
  );
}

const COLUMN_PRIORITY = [
  "symbol", "scheme_name", "schemename", "security_name", "securityname", "name", "ticker",
  "quantity", "units", "qty", "buy_price", "buyprice", "current_price", "currentprice", "current_nav", "nav",
  "invested_value", "investedvalue", "current_value", "currentvalue", "market_value", "marketvalue",
  "pnl", "profit_loss", "absolute_return", "absolutereturn", "return_pct", "returnpct", "xirr_pct", "returns",
  "weight", "allocation_pct", "status", "recommendation", "signal",
];

function columnScore(key: string): number {
  const norm = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const idx = COLUMN_PRIORITY.indexOf(norm);
  return idx === -1 ? 999 : idx;
}

function RecordsTable({ records, currency }: { records: Record<string, unknown>[]; currency: CurrencyCode }) {
  const columns = useMemo(() => {
    const seen = new Map<string, number>();
    for (const rec of records.slice(0, 60)) {
      for (const [k, v] of Object.entries(rec)) {
        if (isScalar(v)) seen.set(k, (seen.get(k) ?? 0) + 1);
      }
    }
    return [...seen.entries()]
      .sort((a, b) => columnScore(a[0]) - columnScore(b[0]) || b[1] - a[1])
      .map(([k]) => k)
      .slice(0, 6);
  }, [records]);

  if (columns.length === 0) return <JsonBlock data={records} />;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[560px] border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {titleCase(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.slice(0, 25).map((rec, ri) => (
            <tr key={ri} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
              {columns.map((col) => {
                const v = rec[col];
                const kind = classify(col, v);
                const numeric = kind === "currency" || kind === "percent" || kind === "number" || kind === "count";
                return (
                  <td
                    key={col}
                    className={cn(
                      "whitespace-nowrap px-4 py-2.5 text-[13px]",
                      numeric ? cn("text-right font-medium tabular-nums", toneClass(col, v)) : "text-slate-700",
                      col === columns[0] && "font-semibold text-slate-900",
                    )}
                  >
                    {v === null || v === undefined || v === "" ? <span className="text-slate-300">—</span> : formatScalar(kind, v, currency)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {records.length > 25 && (
        <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-400">
          Showing first 25 of {records.length} rows
        </p>
      )}
    </div>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  let text: string;
  try {
    text = JSON.stringify(data, null, 2) ?? "";
  } catch {
    text = String(data);
  }
  return (
    <pre className="max-h-96 overflow-auto rounded-xl bg-navy-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-100/90">
      {text}
    </pre>
  );
}

function SectionCard({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-4 py-2.5">
        <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">{titleCase(name)}</h4>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Node({ name, value, depth, currency }: { name: string; value: unknown; depth: number; currency: CurrencyCode }) {
  if (Array.isArray(value)) {
    const records = value.filter(isRecord);
    const strings = value.filter((v): v is string => typeof v === "string");
    if (records.length > 0 && records.length >= value.length * 0.5) {
      return (
        <SectionCard name={name}>
          <RecordsTable records={records} currency={currency} />
        </SectionCard>
      );
    }
    if (strings.length > 0 && strings.length >= value.length * 0.5) {
      return <StringList name={name} items={strings} />;
    }
    return (
      <SectionCard name={name}>
        <JsonBlock data={value} />
      </SectionCard>
    );
  }
  if (isRecord(value)) {
    if (depth >= 3) {
      return (
        <SectionCard name={name}>
          <JsonBlock data={value} />
        </SectionCard>
      );
    }
    return (
      <SectionCard name={name}>
        <RecordBody rec={value} depth={depth + 1} currency={currency} />
      </SectionCard>
    );
  }
  return null;
}

function RecordBody({ rec, depth, currency }: { rec: Record<string, unknown>; depth: number; currency: CurrencyCode }) {
  const entries = Object.entries(rec).filter(([, v]) => v !== null && v !== undefined && v !== "");
  const scalars = entries.filter(([, v]) => isScalar(v));
  const longTexts = scalars.filter(([, v]) => typeof v === "string" && (v as string).length >= 160);
  const tileScalars = scalars.filter(([, v]) => !(typeof v === "string" && (v as string).length >= 160));
  const complex = entries.filter(([, v]) => !isScalar(v));

  return (
    <div className="space-y-3.5">
      {tileScalars.length > 0 && <MetricTiles rec={Object.fromEntries(tileScalars)} currency={currency} />}
      {longTexts.map(([k, v]) => (
        <Narrative key={k} name={k} text={String(v)} />
      ))}
      {complex.map(([k, v]) => (
        <Node key={k} name={k} value={v} depth={depth} currency={currency} />
      ))}
    </div>
  );
}

/* --------------------------------- Main ----------------------------------- */

export function ResultView({
  data,
  currency = "INR",
  emptyMessage = "The backend returned an empty response.",
}: {
  data: unknown;
  currency?: CurrencyCode;
  emptyMessage?: string;
}) {
  const [rawOpen, setRawOpen] = useState(false);

  const isEmpty =
    data === null ||
    data === undefined ||
    (isRecord(data) && Object.keys(data).length === 0) ||
    (Array.isArray(data) && data.length === 0);

  if (isEmpty) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-6 text-sm text-slate-500">
        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isRecord(data) ? (
        <RecordBody rec={data} depth={0} currency={currency} />
      ) : Array.isArray(data) ? (
        <Node name="Results" value={data} depth={0} currency={currency} />
      ) : (
        <p className="text-sm text-slate-700">{String(data)}</p>
      )}

      <div>
        <button
          onClick={() => setRawOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <Braces className="h-3.5 w-3.5" />
          {rawOpen ? "Hide raw response" : "View raw response"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", rawOpen && "rotate-180")} />
        </button>
        {rawOpen && <div className="mt-2 animate-fade-in"><JsonBlock data={data} /></div>}
      </div>
    </div>
  );
}
