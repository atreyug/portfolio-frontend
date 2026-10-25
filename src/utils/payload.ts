/**
 * Tolerant helpers for inspecting backend payloads whose exact shapes are not
 * guaranteed. Every helper only *finds* data that exists — nothing is
 * fabricated; missing data surfaces as undefined and the UI renders "—".
 */
import type { CurrencyCode } from "@/types/api";

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const normKey = (k: string): string => k.toLowerCase().replace(/[^a-z0-9]/g, "");

export function toNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/** Breadth-first search for the first key matching any candidate name. */
export function deepFind(data: unknown, candidates: string[], maxDepth = 6): unknown {
  const wanted = new Set(candidates.map(normKey));
  const queue: Array<{ v: unknown; d: number }> = [{ v: data, d: 0 }];
  const seen = new Set<unknown>();
  while (queue.length) {
    const { v, d } = queue.shift()!;
    if (d > maxDepth || v === null || seen.has(v)) continue;
    seen.add(v);
    if (isRecord(v)) {
      for (const [k, val] of Object.entries(v)) {
        if (wanted.has(normKey(k))) return val;
      }
      for (const val of Object.values(v)) {
        if (isRecord(val) || Array.isArray(val)) queue.push({ v: val, d: d + 1 });
      }
    } else if (Array.isArray(v)) {
      for (const item of v.slice(0, 100)) {
        if (isRecord(item)) queue.push({ v: item, d: d + 1 });
      }
    }
  }
  return undefined;
}

export const deepNumber = (data: unknown, candidates: string[], maxDepth = 6): number | undefined =>
  toNumber(deepFind(data, candidates, maxDepth));

/** Find the first array of records, preferring arrays under hint-named keys. */
export function findRecordsArray(data: unknown, keyHints: string[] = [], maxDepth = 5): Record<string, unknown>[] | undefined {
  const hints = new Set(keyHints.map(normKey));
  type Hit = { arr: Record<string, unknown>[]; score: number };
  let best: Hit | undefined;
  const visit = (v: unknown, d: number, keyScore: number) => {
    if (d > maxDepth || v === null) return;
    if (Array.isArray(v)) {
      const recs = v.filter(isRecord);
      if (recs.length > 0) {
        const score = keyScore + Math.min(recs.length, 5);
        if (!best || score > best.score) best = { arr: recs as Record<string, unknown>[], score };
      }
      v.slice(0, 40).forEach((item) => visit(item, d + 1, keyScore));
      return;
    }
    if (isRecord(v)) {
      for (const [k, val] of Object.entries(v)) {
        const s = Math.max(keyScore, hints.has(normKey(k)) ? 10 : 0);
        visit(val, d + 1, s);
      }
    }
  };
  visit(data, 0, 0);
  return best?.arr;
}

/** Find the first array of plain strings, preferring hint-named keys. */
export function findStringArray(data: unknown, keyHints: string[] = [], maxDepth = 5): string[] | undefined {
  const hints = new Set(keyHints.map(normKey));
  let best: { arr: string[]; score: number } | undefined;
  const visit = (v: unknown, d: number, keyScore: number) => {
    if (d > maxDepth || v === null) return;
    if (Array.isArray(v)) {
      const strs = v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
      if (strs.length > 0) {
        const score = keyScore + Math.min(strs.length, 5);
        if (!best || score > best.score) best = { arr: strs, score };
      }
      v.slice(0, 40).forEach((item) => visit(item, d + 1, keyScore));
      return;
    }
    if (isRecord(v)) {
      for (const [k, val] of Object.entries(v)) {
        visit(val, d + 1, Math.max(keyScore, hints.has(normKey(k)) ? 10 : 0));
      }
    }
  };
  visit(data, 0, 0);
  return best?.arr;
}

/** Shallow-ish lookup inside a single record (checks the record itself first). */
export function recordFind(rec: Record<string, unknown>, candidates: string[], maxDepth = 2): unknown {
  const wanted = new Set(candidates.map(normKey));
  const queue: Array<{ v: unknown; d: number }> = [{ v: rec, d: 0 }];
  while (queue.length) {
    const { v, d } = queue.shift()!;
    if (d > maxDepth || !isRecord(v)) continue;
    for (const [k, val] of Object.entries(v)) {
      if (wanted.has(normKey(k)) && !isRecord(val) && !Array.isArray(val)) return val;
    }
    for (const val of Object.values(v)) {
      if (isRecord(val)) queue.push({ v: val, d: d + 1 });
    }
  }
  return undefined;
}

export const recordNumber = (rec: Record<string, unknown>, candidates: string[]): number | undefined =>
  toNumber(recordFind(rec, candidates));

/* ------------------------------ Domain extracts --------------------------- */

export interface HoldingRow {
  name: string;
  invested?: number;
  current?: number;
  pnl?: number;
  pct?: number;
  quantity?: number;
  raw: Record<string, unknown>;
}

const NAME_KEYS = ["symbol", "scheme_name", "schemename", "security_name", "securityname", "ticker", "name", "scheme"];
const INVESTED_KEYS = ["invested_value", "investedvalue", "invested", "cost_value", "buy_value", "investment_amount", "total_invested", "investedamount", "cost"];
const CURRENT_KEYS = ["current_value", "currentvalue", "market_value", "marketvalue", "valuation", "current_valuation", "value_now", "currentworth"];
const PNL_KEYS = ["pnl", "pl", "profit_loss", "profitloss", "gain_loss", "absolute_return", "absolutereturn", "gain", "unrealized_pnl", "net_pnl", "profit", "returns_value"];
const PCT_KEYS = ["return_pct", "returnpct", "pnl_pct", "pnlpct", "pnl_percent", "percent_return", "percentage_return", "returns_pct", "gain_pct", "overall_return_pct", "xirr_pct", "return_percentage", "returnpercent", "cagr"];
const QTY_KEYS = ["quantity", "units", "qty"];

export function extractHoldings(data: unknown): HoldingRow[] {
  const recs = findRecordsArray(data, ["holdings", "positions", "stocks", "breakdown", "items", "portfolio", "results", "holdingwise", "schemes"]);
  if (!recs) return [];
  const rows: HoldingRow[] = [];
  for (const rec of recs.slice(0, 100)) {
    const nameRaw = recordFind(rec, NAME_KEYS);
    if (typeof nameRaw !== "string" || nameRaw.trim() === "") continue;
    let invested = recordNumber(rec, INVESTED_KEYS);
    let current = recordNumber(rec, CURRENT_KEYS);
    const quantity = recordNumber(rec, QTY_KEYS);
    const buyPrice = recordNumber(rec, ["buy_price", "buyprice", "avg_price", "purchase_price", "cost_price"]);
    const currentPrice = recordNumber(rec, ["current_price", "currentprice", "ltp", "market_price", "current_nav", "nav"]);
    if (invested === undefined && quantity !== undefined && buyPrice !== undefined) invested = quantity * buyPrice;
    if (current === undefined && quantity !== undefined && currentPrice !== undefined) current = quantity * currentPrice;
    let pnl = recordNumber(rec, PNL_KEYS);
    let pct = recordNumber(rec, PCT_KEYS);
    if (pnl === undefined && invested !== undefined && current !== undefined) pnl = current - invested;
    if (pct === undefined && invested && pnl !== undefined) pct = (pnl / invested) * 100;
    rows.push({ name: nameRaw.trim(), invested, current, pnl, pct, quantity, raw: rec });
  }
  return rows;
}

export interface PortfolioTotals {
  invested?: number;
  current?: number;
  pnl?: number;
  pct?: number;
  holdingsCount?: number;
}

export function extractTotals(data: unknown): PortfolioTotals {
  const holdings = extractHoldings(data);
  let invested = deepNumber(data, ["total_invested", "totalinvested", "total_invested_value", "invested_value", "total_investment", "invested", "total_cost"], 4);
  let current = deepNumber(data, ["total_current", "totalcurrent", "total_current_value", "current_value", "portfolio_value", "total_value", "total_valuation", "market_value"], 4);
  let pnl = deepNumber(data, ["total_pnl", "totalpnl", "total_profit_loss", "pnl", "absolute_return", "total_gain", "net_pnl", "overall_pnl"], 4);
  let pct = deepNumber(data, ["overall_return_pct", "total_return_pct", "return_pct", "total_returns_pct", "pnl_pct", "overall_return", "total_return", "returns_pct"], 4);
  if (invested === undefined && holdings.length) {
    const vals = holdings.map((h) => h.invested).filter((n): n is number => n !== undefined);
    if (vals.length) invested = vals.reduce((a, b) => a + b, 0);
  }
  if (current === undefined && holdings.length) {
    const vals = holdings.map((h) => h.current).filter((n): n is number => n !== undefined);
    if (vals.length) current = vals.reduce((a, b) => a + b, 0);
  }
  if (pnl === undefined && invested !== undefined && current !== undefined) pnl = current - invested;
  if (pct === undefined && invested && pnl !== undefined) pct = (pnl / invested) * 100;
  return { invested, current, pnl, pct, holdingsCount: holdings.length || undefined };
}

export interface InsightGroup {
  title: string;
  kind: "insight" | "risk" | "news" | "action" | "narrative" | "list";
  items: string[];
}

const INSIGHT_HINTS: Array<{ re: RegExp; kind: InsightGroup["kind"]; hints: string[] }> = [
  { re: /risk|warn|concern|volatil|exposure|drawdown|caution/i, kind: "risk", hints: ["risks", "risk", "warnings", "concerns", "risk_observations"] },
  { re: /news|headline|market|event/i, kind: "news", hints: ["news", "headlines", "market_news", "market_context", "related_news"] },
  { re: /suggest|recommend|action|review|improve|rebalance/i, kind: "action", hints: ["recommendations", "suggestions", "actions", "suggested_actions", "review_areas", "areas_for_review"] },
  { re: /insight|observ|takeaway|highlight|finding|summary/i, kind: "insight", hints: ["insights", "observations", "ai_insights", "key_insights", "takeaways", "highlights"] },
];

export function extractInsights(data: unknown): InsightGroup[] {
  const groups: InsightGroup[] = [];
  const used = new Set<unknown>();
  if (!isRecord(data)) return groups;
  const walk = (v: unknown, keyName: string, depth: number) => {
    if (depth > 4 || v === null || used.has(v)) return;
    if (Array.isArray(v)) {
      const strs = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      if (strs.length > 0 && strs.length >= v.length * 0.6) {
        const meta = INSIGHT_HINTS.find((h) => h.re.test(keyName));
        used.add(v);
        groups.push({ title: keyName ? keyName.replace(/[_-]+/g, " ") : "Notes", kind: meta?.kind ?? "list", items: strs.slice(0, 12) });
        return;
      }
      v.slice(0, 30).forEach((item) => walk(item, keyName, depth + 1));
      return;
    }
    if (typeof v === "string" && v.length >= 220) {
      const meta = INSIGHT_HINTS.find((h) => h.re.test(keyName));
      used.add(v);
      groups.push({ title: keyName ? keyName.replace(/[_-]+/g, " ") : "AI narrative", kind: meta?.kind ?? "narrative", items: [v] });
      return;
    }
    if (isRecord(v)) {
      for (const [k, val] of Object.entries(v)) walk(val, k, depth + 1);
    }
  };
  walk(data, "", 0);
  const order: Record<InsightGroup["kind"], number> = { insight: 0, risk: 1, action: 2, news: 3, narrative: 4, list: 5 };
  return groups.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, 6);
}

/** Detect a plottable series: array of records each with an x-ish and y-ish field. */
export interface SeriesPoint {
  x: string;
  y: number;
  raw: Record<string, unknown>;
}

export function extractSeries(data: unknown): SeriesPoint[] | undefined {
  const recs = findRecordsArray(data, ["projection", "projection_series", "timeline", "series", "points", "growth", "schedule", "chart", "curve", "projection_points", "monthly_breakdown", "yearly_breakdown"]);
  if (!recs || recs.length < 3) return undefined;
  const X_KEYS = ["month", "year", "period", "date", "label", "step", "month_no", "duration_months", "time", "t"];
  const Y_KEYS = ["value", "projected_value", "portfolio_value", "amount", "corpus", "total", "balance", "future_value", "fv", "projected", "cumulative_value", "expected_value"];
  const points: SeriesPoint[] = [];
  for (const rec of recs.slice(0, 400)) {
    const xRaw = recordFind(rec, X_KEYS);
    let y = recordNumber(rec, Y_KEYS);
    if (y === undefined) {
      for (const [, val] of Object.entries(rec)) {
        const n = toNumber(val);
        if (n !== undefined) {
          y = n;
          break;
        }
      }
    }
    if (y === undefined) continue;
    const x = xRaw === undefined ? String(points.length + 1) : typeof xRaw === "string" ? xRaw : String(xRaw);
    points.push({ x, y: y as number, raw: rec });
  }
  return points.length >= 3 ? points : undefined;
}

export function detectCurrency(data: unknown, fallback: CurrencyCode = "INR"): CurrencyCode {
  const raw = deepFind(data, ["currency", "reporting_currency", "currency_code", "base_currency", "portfolio_currency"], 4);
  if (typeof raw === "string") {
    const up = raw.trim().toUpperCase();
    if (up === "INR" || up === "₹") return "INR";
    if (up === "USD" || up === "$") return "USD";
    if (/^[A-Z]{3}$/.test(up)) return up;
  }
  return fallback;
}
