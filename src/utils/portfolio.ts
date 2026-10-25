/**
 * Canonical payload builders.
 *
 * Every request body sent to the backend is constructed here through an
 * explicit key whitelist, so ONLY canonical fields ever leave the browser —
 * no stray spreadsheet columns, no empty optionals, no derived junk.
 */
import type {
  CurrencyCode,
  MonitoringCheckRequest,
  MutualFundAnalyzeRequest,
  MutualFundHoldingInput,
  MutualFundPortfolioRequest,
  ProjectionType,
  StockAnalyzeRequest,
  StockHoldingInput,
} from "@/types/api";
import { PROJECTION_REQUIREMENTS, parseNum, type ProjectionFieldKey } from "@/utils/validate";

export const EXCHANGES = ["NSE", "BSE", "NYSE", "NASDAQ", "OTHER"] as const;

export const STOCK_HOLDING_KEYS = [
  "client_id",
  "symbol",
  "quantity",
  "buy_price",
  "security_name",
  "isin",
  "exchange",
  "buy_date",
  "current_price",
] as const;

export const MF_HOLDING_KEYS = [
  "client_id",
  "scheme_name",
  "units",
  "scheme_code",
  "folio_no",
  "invested_value",
  "current_nav",
  "current_value",
  "investment_date",
  "xirr_pct",
] as const;

function prune<T extends Record<string, unknown>>(input: T, keys: readonly string[]): T {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = input[key];
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out as T;
}

function normalizeStockHolding(h: StockHoldingInput, fallbackClientId: string): StockHoldingInput {
  const clean = prune({ ...h }, STOCK_HOLDING_KEYS);
  clean.client_id = (typeof h.client_id === "string" && h.client_id.trim()) || fallbackClientId;
  if (typeof clean.symbol === "string") clean.symbol = clean.symbol.trim().toUpperCase();
  if (typeof clean.isin === "string") clean.isin = clean.isin.trim().toUpperCase();
  if (typeof clean.exchange === "string") clean.exchange = clean.exchange.trim().toUpperCase();
  if (typeof clean.security_name === "string") clean.security_name = clean.security_name.trim();
  if (typeof clean.buy_date === "string") clean.buy_date = clean.buy_date.trim();
  return clean;
}

function normalizeMFHolding(h: MutualFundHoldingInput, fallbackClientId: string): MutualFundHoldingInput {
  const clean = prune({ ...h }, MF_HOLDING_KEYS);
  clean.client_id = (typeof h.client_id === "string" && h.client_id.trim()) || fallbackClientId;
  if (typeof clean.scheme_name === "string") clean.scheme_name = clean.scheme_name.trim();
  if (typeof clean.folio_no === "string") clean.folio_no = clean.folio_no.trim();
  if (typeof clean.investment_date === "string") clean.investment_date = clean.investment_date.trim();
  return clean;
}

const hasRequiredStock = (h: Partial<StockHoldingInput>): h is StockHoldingInput =>
  !!h.client_id && !!h.symbol && h.quantity !== undefined && h.buy_price !== undefined;

const hasRequiredMF = (h: Partial<MutualFundHoldingInput>): h is MutualFundHoldingInput =>
  !!h.client_id && !!h.scheme_name && h.units !== undefined;

/** Build the exact `{ client_id, currency?, holdings }` stock analysis body. */
export function buildStockAnalyzeRequest(
  clientId: string,
  currency: CurrencyCode | undefined,
  holdings: StockHoldingInput[],
): StockAnalyzeRequest {
  const trimmedClient = clientId.trim();
  const list = holdings.map((h) => normalizeStockHolding(h, trimmedClient)).filter(hasRequiredStock);
  const request: StockAnalyzeRequest = { client_id: trimmedClient, holdings: list };
  if (currency) request.currency = currency;
  return request;
}

/** Build the exact `{ client_id, currency?, holdings }` mutual-fund analysis body. */
export function buildMutualFundAnalyzeRequest(
  clientId: string,
  currency: CurrencyCode | undefined,
  holdings: MutualFundHoldingInput[],
): MutualFundAnalyzeRequest {
  const trimmedClient = clientId.trim();
  const list = holdings.map((h) => normalizeMFHolding(h, trimmedClient)).filter(hasRequiredMF);
  const request: MutualFundAnalyzeRequest = { client_id: trimmedClient, holdings: list };
  if (currency) request.currency = currency;
  return request;
}

/**
 * Build a projection request including ONLY the inputs relevant to the
 * selected projection type (per PROJECTION_REQUIREMENTS), omitting blanks.
 */
export function buildProjectionRequest(
  type: ProjectionType,
  values: Record<string, string>,
  clientId?: string,
  currency?: CurrencyCode,
): MutualFundPortfolioRequest {
  const request: MutualFundPortfolioRequest = { projection_type: type };
  if (clientId?.trim()) request.client_id = clientId.trim();
  if (currency) request.currency = currency;
  const relevant: ProjectionFieldKey[] = [
    ...PROJECTION_REQUIREMENTS[type].required,
    ...PROJECTION_REQUIREMENTS[type].optional,
  ];
  for (const key of relevant) {
    const n = parseNum(values[key] ?? "");
    if (n !== undefined) request[key] = n;
  }
  return request;
}

export interface MonitoringCheckOptions {
  exchange?: string;
  quantity?: number;
  buyPrice?: number;
}

/** Build the canonical monitoring check body (client_id + symbol required). */
export function buildMonitoringCheckRequest(
  clientId: string,
  symbol: string,
  opts: MonitoringCheckOptions = {},
): MonitoringCheckRequest {
  const request: MonitoringCheckRequest = {
    client_id: clientId.trim(),
    symbol: symbol.trim().toUpperCase(),
  };
  if (opts.exchange?.trim()) request.exchange = opts.exchange.trim().toUpperCase();
  if (opts.quantity !== undefined) request.quantity = opts.quantity;
  if (opts.buyPrice !== undefined) request.buy_price = opts.buyPrice;
  return request;
}
