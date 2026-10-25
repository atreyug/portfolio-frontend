/**
 * Privacy-first Excel intake utilities.
 *
 * Everything in this module is a pure function operating on in-memory values.
 * The original workbook/array buffer never leaves the parsing component, and
 * only the normalized JSON (built with the canonical whitelists in
 * `utils/portfolio.ts`) is ever sent to the API.
 */
import type { MutualFundHoldingInput, StockHoldingInput } from "@/types/api";

/* --------------------------- Canonical field maps ------------------------- */

export type ExcelKind = "stock" | "mf";
export type CellType = "string" | "number" | "percent" | "date";

export interface CanonicalField {
  key: string;
  label: string;
  required: boolean;
  type: CellType;
  aliases: string[];
}

export const STOCK_FIELDS: CanonicalField[] = [
  { key: "client_id", label: "Client ID", required: true, type: "string",
    aliases: ["client id", "client", "client code", "client no", "account id", "account", "customer id", "investor id", "holder id"] },
  { key: "symbol", label: "Symbol", required: true, type: "string",
    aliases: ["symbol", "ticker", "stock", "stock symbol", "scrip", "scrip code", "security code", "trading symbol", "code"] },
  { key: "quantity", label: "Quantity", required: true, type: "number",
    aliases: ["quantity", "qty", "shares", "units", "no of shares", "number of shares", "holding qty", "total qty"] },
  { key: "buy_price", label: "Buy price", required: true, type: "number",
    aliases: ["buy price", "purchase price", "avg cost", "average price", "avg price", "cost price", "price", "buy rate", "rate", "purchase cost"] },
  { key: "security_name", label: "Security name", required: false, type: "string",
    aliases: ["security name", "company name", "company", "stock name", "scrip name", "instrument name", "description", "name"] },
  { key: "isin", label: "ISIN", required: false, type: "string",
    aliases: ["isin", "isin code", "isin number"] },
  { key: "exchange", label: "Exchange", required: false, type: "string",
    aliases: ["exchange", "exch", "market", "segment"] },
  { key: "buy_date", label: "Buy date", required: false, type: "date",
    aliases: ["buy date", "purchase date", "trade date", "transaction date", "acquired on", "date"] },
  { key: "current_price", label: "Current price", required: false, type: "number",
    aliases: ["current price", "ltp", "market price", "cmp", "last price", "close price", "latest price", "closing price"] },
];

export const MF_FIELDS: CanonicalField[] = [
  { key: "client_id", label: "Client ID", required: true, type: "string",
    aliases: ["client id", "client", "client code", "client no", "account id", "account", "customer id", "investor id", "holder id"] },
  { key: "scheme_name", label: "Scheme name", required: true, type: "string",
    aliases: ["scheme name", "scheme", "fund name", "fund", "plan name", "name"] },
  { key: "units", label: "Units", required: true, type: "number",
    aliases: ["units", "unit balance", "balance units", "no of units", "number of units", "quantity", "qty"] },
  { key: "scheme_code", label: "Scheme code", required: false, type: "string",
    aliases: ["scheme code", "fund code", "code"] },
  { key: "folio_no", label: "Folio number", required: false, type: "string",
    aliases: ["folio no", "folio", "folio number", "account no"] },
  { key: "invested_value", label: "Invested value", required: false, type: "number",
    aliases: ["invested value", "invested", "cost value", "investment", "invested amount", "cost", "total invested", "purchase value", "amount invested"] },
  { key: "current_nav", label: "Current NAV", required: false, type: "number",
    aliases: ["current nav", "nav", "latest nav", "nav value"] },
  { key: "current_value", label: "Current value", required: false, type: "number",
    aliases: ["current value", "market value", "valuation", "present value", "current worth", "value"] },
  { key: "investment_date", label: "Investment date", required: false, type: "date",
    aliases: ["investment date", "purchased on", "invested on", "start date", "date", "purchase date"] },
  { key: "xirr_pct", label: "XIRR %", required: false, type: "percent",
    aliases: ["xirr", "xirr %", "xirr pct", "returns", "return %", "return pct", "cagr", "returns %"] },
];

export const fieldsForKind = (kind: ExcelKind): CanonicalField[] => (kind === "stock" ? STOCK_FIELDS : MF_FIELDS);

/* ------------------------------- Header match ----------------------------- */

export const normalizeHeaderName = (h: unknown): string =>
  String(h ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Auto-guess canonical-field → column-index mapping from sheet headers.
 * Exact alias hit first, then prefix, then substring; each header is only
 * mapped once (first-come by field order, required fields prioritized).
 */
export function guessColumnMapping(headers: string[], fields: CanonicalField[]): Record<string, number> {
  const normHeaders = headers.map(normalizeHeaderName);
  const used = new Set<number>();
  const mapping: Record<string, number> = {};
  const ordered = [...fields].sort((a, b) => Number(b.required) - Number(a.required));

  for (const field of ordered) {
    const aliases = [field.key, field.label, ...field.aliases]
      .map(normalizeHeaderName)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    const passes: Array<(h: string, a: string) => boolean> = [
      (h, a) => h === a,
      (h, a) => h.startsWith(a),
      (h, a) => h.includes(a),
    ];
    for (const test of passes) {
      const idx = normHeaders.findIndex((h, i) => !used.has(i) && h !== "" && aliases.some((a) => test(h, a)));
      if (idx >= 0) {
        mapping[field.key] = idx;
        used.add(idx);
        break;
      }
    }
  }
  return mapping;
}

/* -------------------------------- Cell parse ------------------------------ */

/** Numbers from real numbers or strings like "1,234.50", "₹1,200", "12.5%". */
export function cellToNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v instanceof Date) return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "" || t === "-" || /^na(n)?$/i.test(t)) return undefined;
    const n = Number(t.replace(/[,₹$%\s]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return cellToISODate(v) ?? "";
  return typeof v === "number" && Number.isFinite(v) ? String(v) : String(v).trim();
}

/** Convert Excel serials, Date objects or common date strings to yyyy-mm-dd. */
export function cellToISODate(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const m = `${v.getMonth() + 1}`.padStart(2, "0");
    const d = `${v.getDate()}`.padStart(2, "0");
    return `${v.getFullYear()}-${m}-${d}`;
  }
  if (typeof v === "number" && Number.isFinite(v) && v > 20000 && v < 80000) {
    // Excel serial day (1900 date system); 25569 == 1970-01-01.
    // Serials carry no timezone — resolve in UTC so output is deterministic.
    const ms = Math.round((v - 25569) * 86400000);
    const d = new Date(ms);
    const month = `${d.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${d.getUTCDate()}`.padStart(2, "0");
    return `${d.getUTCFullYear()}-${month}-${day}`;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return undefined;
    const iso = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (iso) {
      return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    }
    const local = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (local) {
      let [day, month] = [Number(local[1]), Number(local[2])];
      let year = Number(local[3]);
      if (year < 100) year += year < 50 ? 2000 : 1900;
      if (month > 12 && day <= 12) [day, month] = [month, day];
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
      }
      return undefined;
    }
    const parsed = Date.parse(t);
    if (!Number.isNaN(parsed)) return cellToISODate(new Date(parsed));
  }
  return undefined;
}

/* ----------------------------- Row normalization -------------------------- */

type RowOf<K extends ExcelKind> = K extends "stock" ? StockHoldingInput : MutualFundHoldingInput;

export interface NormalizedRow<T> {
  /** 1-based row number as it appears in the sheet (header = row 1). */
  rowNumber: number;
  data: Partial<T>;
  clientId: string;
  errors: string[];
  /** Optional fields that were derived rather than read from the sheet. */
  derived: string[];
}

export interface NormalizeOptions {
  /** Applied to every row when the user chooses a single client for the whole sheet. */
  overrideClientId?: string;
  /** Extract only rows whose client cell equals this (case-insensitive). */
  onlyClientId?: string;
  /** Offset for human row numbers; defaults to 2 (row after the header). */
  firstRowNumber?: number;
}

export interface NormalizedSheet<T> {
  rows: NormalizedRow<T>[];
  /** Rows dropped because they belong to another client. */
  skippedOtherClients: number;
  /** Sheet rows that were completely blank. */
  skippedBlank: number;
}

export function normalizeExcelRows<K extends ExcelKind>(
  kind: K,
  rows: unknown[][],
  mapping: Record<string, number>,
  opts: NormalizeOptions = {},
): NormalizedSheet<RowOf<K>> {
  const fields = fieldsForKind(kind);
  const clientCol = mapping.client_id;
  const firstRowNumber = opts.firstRowNumber ?? 2;
  const out: NormalizedRow<RowOf<K>>[] = [];
  let skippedOtherClients = 0;
  let skippedBlank = 0;

  rows.forEach((cells, i) => {
    const isBlank = cells.every((c) => c === null || c === undefined || String(c).trim() === "");
    if (isBlank) {
      skippedBlank += 1;
      return;
    }
    const rowNumber = firstRowNumber + i;
    const sheetClient = clientCol !== undefined ? cellToString(cells[clientCol]) : "";
    if (opts.overrideClientId === undefined && opts.onlyClientId !== undefined) {
      if (sheetClient.toLowerCase() !== opts.onlyClientId.trim().toLowerCase()) {
        skippedOtherClients += 1;
        return;
      }
    }
    const clientId = (opts.overrideClientId ?? sheetClient).trim();

    const data: Record<string, unknown> = { client_id: clientId };
    const errors: string[] = [];
    const derived: string[] = [];

    for (const field of fields) {
      if (field.key === "client_id") {
        if (!clientId) errors.push("client_id: required");
        continue;
      }
      const col = mapping[field.key];
      const raw = col !== undefined ? cells[col] : undefined;
      const has = raw !== undefined && raw !== null && String(raw).trim() !== "";

      if (!has) {
        if (field.required) errors.push(`${field.key}: required`);
        continue;
      }
      switch (field.type) {
        case "string": {
          let s = cellToString(raw);
          if (["symbol", "isin", "exchange", "scheme_code"].includes(field.key)) s = s.toUpperCase();
          if (!s && field.required) errors.push(`${field.key}: required`);
          else if (s) data[field.key] = s;
          break;
        }
        case "number":
        case "percent": {
          const n = cellToNumber(raw);
          if (n === undefined) {
            errors.push(`${field.key}: must be a number (got "${String(raw).slice(0, 24)}")`);
          } else if (field.type === "number" && n <= 0) {
            errors.push(`${field.key}: must be greater than 0`);
          } else {
            data[field.key] = n;
          }
          break;
        }
        case "date": {
          const iso = cellToISODate(raw);
          if (!iso) errors.push(`${field.key}: unrecognized date "${String(raw).slice(0, 24)}"`);
          else data[field.key] = iso;
          break;
        }
      }
    }

    /* Derived values — fill canonical optional fields when derivable. */
    if (kind === "mf") {
      const units = data.units as number | undefined;
      const nav = data.current_nav as number | undefined;
      if (data.current_value === undefined && units !== undefined && nav !== undefined) {
        data.current_value = Math.round(units * nav * 100) / 100;
        derived.push("current_value");
      }
    }

    out.push({ rowNumber, data: data as Partial<RowOf<K>>, clientId, errors, derived });
  });

  return { rows: out, skippedOtherClients, skippedBlank };
}

/* ------------------------- Client-id discovery ----------------------------- */

export function uniqueClientIds(rows: unknown[][], clientCol: number | undefined, cap = 200): string[] {
  if (clientCol === undefined) return [];
  const seen = new Set<string>();
  for (const cells of rows) {
    const s = cellToString(cells[clientCol]);
    if (s) seen.add(s);
    if (seen.size >= cap) break;
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/* ----------------------------- Derived metrics ---------------------------- */

export interface StockDerived {
  invested?: number;
  current?: number;
  pnl?: number;
  returnPct?: number;
}

/** Derived figures for display — never required as input fields. */
export function stockDerived(h: Partial<StockHoldingInput>): StockDerived {
  const invested = h.quantity !== undefined && h.buy_price !== undefined ? h.quantity * h.buy_price : undefined;
  const current =
    h.quantity !== undefined && h.current_price !== undefined ? h.quantity * h.current_price : undefined;
  const pnl = invested !== undefined && current !== undefined ? current - invested : undefined;
  const returnPct = invested && pnl !== undefined ? (pnl / invested) * 100 : undefined;
  return { invested, current, pnl, returnPct };
}

export interface MFDerived {
  invested?: number;
  current?: number;
  pnl?: number;
}

export function mfDerived(h: Partial<MutualFundHoldingInput>): MFDerived {
  const current =
    h.current_value !== undefined
      ? h.current_value
      : h.units !== undefined && h.current_nav !== undefined
        ? h.units * h.current_nav
        : undefined;
  const invested = h.invested_value;
  const pnl = invested !== undefined && current !== undefined ? current - invested : undefined;
  return { invested, current, pnl };
}
