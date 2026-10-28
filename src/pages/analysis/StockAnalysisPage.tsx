import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CandlestickChart,
  ChevronDown,
  FileSpreadsheet,
  Info,
  Lock,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/fields";
import { Badge, ChangePill } from "@/components/ui/Badge";
import { ResultView } from "@/components/ResultView";
import { AllocationDonut } from "@/components/charts/AllocationDonut";
import { InsightCards } from "@/components/InsightCards";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useSessionData } from "@/context/SessionDataContext";
import { analyzeStocks } from "@/services/portfolio";
import { normalizeApiError } from "@/services/client";
import { parseNum } from "@/utils/validate";
import { detectCurrency, extractHoldings, extractInsights, extractTotals } from "@/utils/payload";
import { buildStockAnalyzeRequest, EXCHANGES } from "@/utils/portfolio";
import { ExcelImportDialog } from "@/components/import/ExcelImportDialog";
import { formatCurrency } from "@/utils/format";
import type { CurrencyCode, StockAnalyzeRequest, StockHoldingInput } from "@/types/api";
import { cn } from "@/utils/cn";

interface Row {
  id: string;
  symbol: string;
  quantity: string;
  buyPrice: string;
  securityName: string;
  isin: string;
  exchange: string;
  buyDate: string;
  currentPrice: string;
  analysisQuestion: string;
  expanded: boolean;
}

let rowSeq = 0;
const newRow = (): Row => ({
  id: `row-${++rowSeq}`,
  symbol: "",
  quantity: "",
  buyPrice: "",
  securityName: "",
  isin: "",
  exchange: "",
  buyDate: "",
  currentPrice: "",
  analysisQuestion: "",
  expanded: false,
});

export function StockAnalysisPage() {
  const { manager } = useAuth();
  const toast = useToast();
  const session = useSessionData();

  const defaultClientId = typeof manager?.id === "string" || typeof manager?.id === "number" ? String(manager.id) : "";

  const [clientId, setClientId] = useState(defaultClientId);
  const [currency, setCurrency] = useState<CurrencyCode>("INR");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<unknown | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: string) => setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));

  /* ------- live client-side preview (computed, never sent) ------- */
  const preview = useMemo(() => {
    let invested = 0;
    let current = 0;
    let hasCurrent = false;
    let valid = 0;
    for (const r of rows) {
      const q = parseNum(r.quantity);
      const bp = parseNum(r.buyPrice);
      const cp = parseNum(r.currentPrice);
      if (r.symbol.trim() && q !== undefined && q > 0 && bp !== undefined && bp > 0) {
        valid += 1;
        invested += q * bp;
        if (cp !== undefined) {
          current += q * cp;
          hasCurrent = true;
        }
      }
    }
    return { invested, current: hasCurrent ? current : undefined, valid };
  }, [rows]);

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};

    if (!clientId.trim()) {
      next.clientId = "Client ID is required.";
    }

    // Validate every partially or fully populated row. Completely blank rows
    // are ignored so an unused extra row does not block analysis.
    const usable = rows.filter(
      (r) => r.symbol.trim() !== "" || r.quantity.trim() !== "" || r.buyPrice.trim() !== "",
    );

    if (usable.length === 0) {
      next.form = "Add at least one stock holding.";
    }

    const numericValue = (value: string): number | undefined => {
      if (!value.trim()) return undefined;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    for (const [index, r] of usable.entries()) {
      const rowLabel = `Stock ${index + 1}`;

      if (!r.symbol.trim()) {
        next[`${r.id}.symbol`] = `${rowLabel}: symbol is required.`;
      }

      const quantity = numericValue(r.quantity);
      if (quantity === undefined || quantity <= 0) {
        next[`${r.id}.quantity`] = `${rowLabel}: quantity must be a valid number greater than zero.`;
      }

      const buyPrice = numericValue(r.buyPrice);
      if (buyPrice === undefined || buyPrice <= 0) {
        next[`${r.id}.buyPrice`] = `${rowLabel}: buy price must be a valid number greater than zero.`;
      }

      const currentPriceText = r.currentPrice.trim();
      if (currentPriceText !== "") {
        const currentPrice = numericValue(currentPriceText);
        if (currentPrice === undefined || currentPrice <= 0) {
          next[`${r.id}.currentPrice`] = `${rowLabel}: current price must be a valid number greater than zero.`;
        }
      }
    }

    // The backend requires all holdings in one request to use the same client ID.
    setErrors(next);
    return next;
  };

  const buildPayload = (): StockAnalyzeRequest => {
    const holdings: StockHoldingInput[] = rows
      .filter((r) => r.symbol.trim())
      .map((r) => {
        const h: StockHoldingInput = {
          client_id: clientId.trim(),
          symbol: r.symbol.trim().toUpperCase(),
          quantity: parseNum(r.quantity) ?? Number.NaN,
          buy_price: parseNum(r.buyPrice) ?? Number.NaN,
        };
        if (r.securityName.trim()) h.security_name = r.securityName.trim();
        if (r.isin.trim()) h.isin = r.isin.trim().toUpperCase();
        if (r.exchange) h.exchange = r.exchange;
        if (r.buyDate) h.buy_date = r.buyDate;
        const cp = parseNum(r.currentPrice);
        if (cp !== undefined) h.current_price = cp;
        return h;
      });
    return buildStockAnalyzeRequest(clientId, currency, holdings);
  };

  const onAnalyze = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      const firstError = Object.values(validationErrors)[0];
      toast.error("Check the form", firstError);
      return;
    }

    setSubmitting(true);
    setResult(null);
    const fullPayload = buildPayload();
    const holdings = fullPayload.holdings;
    // Rows filtered the same way buildPayload filters holdings, so indices line up.
    const activeRows = rows.filter((r) => r.symbol.trim());

    try {
      const settled = await Promise.all(
        holdings.map(async (holding, index) => {
          const question = activeRows[index]?.analysisQuestion;
          const payload = buildStockAnalyzeRequest(clientId, currency, [holding], question);
          try {
            const response = await analyzeStocks(payload);
            session.record("stock", payload, response);
            return { symbol: holding.symbol, success: true as const, response };
          } catch (err) {
            const e = normalizeApiError(err);
            return {
              symbol: holding.symbol,
              success: false as const,
              error: e.details?.[0] ?? e.message ?? "Analysis failed for this stock.",
            };
          }
        }),
      );

      const successful = settled.filter((item) => item.success).length;
      const failed = settled.length - successful;
      const combinedResult = { individual_analyses: settled };
      setResult(combinedResult);

      if (successful === settled.length) {
        toast.success(
          "Analysis complete",
          `Analysis completed for all ${successful} stock${successful === 1 ? "" : "s"}.`,
        );
      } else if (successful > 0) {
        toast.error(
          "Partial analysis complete",
          `${successful} stock${successful === 1 ? "" : "s"} analysed; ${failed} failed. See individual results below.`,
        );
      } else {
        toast.error("Analysis failed", "None of the stock requests succeeded. See the individual errors below.");
      }

      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (err) {
      const e = normalizeApiError(err);
      toast.error("Analysis failed", e.details?.[0] ?? e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setRows([newRow()]);
    setResult(null);
    setErrors({});
  };

  /* Excel import — rows arrive already pruned to canonical fields. */
  const [importOpen, setImportOpen] = useState(false);
  const onImportRows = (client: string, imported: Array<StockHoldingInput | unknown>) => {
    const list = imported as StockHoldingInput[];
    const gridRows: Row[] = list.map((h) => ({
      ...newRow(),
      symbol: h.symbol,
      quantity: String(h.quantity),
      buyPrice: String(h.buy_price),
      securityName: h.security_name ?? "",
      isin: h.isin ?? "",
      exchange: h.exchange ?? "",
      buyDate: h.buy_date ?? "",
      currentPrice: h.current_price !== undefined ? String(h.current_price) : "",
    }));
    setClientId(client);
    setResult(null);
    setRows((prev) =>
      prev.every((r) => !r.symbol.trim() && !r.quantity.trim() && !r.buyPrice.trim()) ? gridRows : [...prev, ...gridRows],
    );
    setImportOpen(false);
    toast.success(
      "Holdings imported",
      `${gridRows.length} row${gridRows.length === 1 ? "" : "s"} for client “${client}”. Review below, then run analysis.`,
    );
  };

  const resultCurrency = result ? detectCurrency(result, currency) : currency;
  const individualAnalyses =
    result && typeof result === "object" &&
    Array.isArray((result as { individual_analyses?: unknown[] }).individual_analyses)
      ? (result as { individual_analyses: Array<{
          symbol: string;
          success: boolean;
          response?: unknown;
          error?: string;
        }> }).individual_analyses
      : null;
  const totals = result && !individualAnalyses ? extractTotals(result) : null;
  const holdingRows = result && !individualAnalyses ? extractHoldings(result) : [];
  const insightGroups = result && !individualAnalyses ? extractInsights(result) : [];
  const donutItems = holdingRows
    .map((h) => ({ name: h.name, value: h.current ?? h.invested ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock portfolio analysis"
        subtitle="Enter holdings directly or import them from Excel — data stays in memory and only normalized JSON is sent."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)} disabled={submitting}>
              <FileSpreadsheet className="h-4 w-4" /> Import Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={resetAll} disabled={submitting}>
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        {/* ------------------------------ Editor ------------------------------ */}
        <Card>
          <CardHeader
            title="Holdings"
            subtitle="Required: symbol, quantity and buy price. Expand a row for optional fields."
            icon={<CandlestickChart className="h-4 w-4" />}
            actions={
              <Button variant="subtle" size="sm" onClick={() => setRows((prev) => [...prev, newRow()])}>
                <Plus className="h-4 w-4" /> Add holding
              </Button>
            }
          />
          <CardBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client ID" required error={errors.clientId} hint="Identifies the portfolio owner to the backend.">
                {(id) => (
                  <Input
                    id={id}
                    value={clientId}
                    invalid={!!errors.clientId}
                    placeholder="e.g. client-1024"
                    onChange={(e) => setClientId(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Reporting currency" hint="Used for values in this request.">
                {(id) => (
                  <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
                    <option value="INR">INR — Indian Rupee (₹)</option>
                    <option value="USD">USD — US Dollar ($)</option>
                  </Select>
                )}
              </Field>
            </div>

            {errors.form && (
              <p className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                <AlertTriangle className="h-4 w-4" /> {errors.form}
              </p>
            )}

            <div className="space-y-3">
              {rows.map((row, index) => (
                <div
                  key={row.id}
                  className={cn(
                    "rounded-xl border bg-white transition-colors",
                    Object.keys(errors).some((k) => k.startsWith(row.id)) ? "border-rose-300" : "border-slate-200",
                  )}
                >
                  <div className="grid grid-cols-[1fr_auto] items-start gap-2 p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Symbol <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        value={row.symbol}
                        invalid={!!errors[`${row.id}.symbol`]}
                        placeholder="RELIANCE"
                        className="h-9 font-semibold uppercase"
                        onChange={(e) => setRow(row.id, { symbol: e.target.value })}
                      />
                      {errors[`${row.id}.symbol`] && <p className="mt-1 text-[11px] text-rose-600">{errors[`${row.id}.symbol`]}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Qty <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        value={row.quantity}
                        invalid={!!errors[`${row.id}.quantity`]}
                        placeholder="25"
                        inputMode="decimal"
                        className="no-spin h-9"
                        onChange={(e) => setRow(row.id, { quantity: e.target.value })}
                      />
                      {errors[`${row.id}.quantity`] && <p className="mt-1 text-[11px] text-rose-600">{errors[`${row.id}.quantity`]}</p>}
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Buy price <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        value={row.buyPrice}
                        invalid={!!errors[`${row.id}.buyPrice`]}
                        placeholder="2450.00"
                        inputMode="decimal"
                        className="no-spin h-9"
                        onChange={(e) => setRow(row.id, { buyPrice: e.target.value })}
                      />
                      {errors[`${row.id}.buyPrice`] && <p className="mt-1 text-[11px] text-rose-600">{errors[`${row.id}.buyPrice`]}</p>}
                    </div>
                    <div className="flex items-end pb-0.5 sm:pb-0">
                      <button
                        onClick={() => setRow(row.id, { expanded: !row.expanded })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                        aria-label={`Toggle optional fields for row ${index + 1}`}
                        title="Optional fields"
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", row.expanded && "rotate-180")} />
                      </button>
                    </div>
                    <div className="flex items-end pb-0.5 sm:pb-0">
                      <button
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
                        aria-label={`Remove row ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {row.expanded && (
                    <div className="grid gap-3 border-t border-dashed border-slate-200 p-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Security name</label>
                        <Input value={row.securityName} placeholder="Reliance Industries" className="h-9" onChange={(e) => setRow(row.id, { securityName: e.target.value })} />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">ISIN</label>
                        <Input value={row.isin} placeholder="INE002A01018" className="h-9 uppercase" onChange={(e) => setRow(row.id, { isin: e.target.value })} />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Exchange</label>
                        <Select value={row.exchange} className="h-9" onChange={(e) => setRow(row.id, { exchange: e.target.value })}>
                          <option value="">— Select —</option>
                          {[...EXCHANGES, ...(row.exchange && !(EXCHANGES as readonly string[]).includes(row.exchange) ? [row.exchange] : [])].map((ex) => (
                            <option key={ex} value={ex}>{ex}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Buy date</label>
                        <Input type="date" value={row.buyDate} className="h-9" onChange={(e) => setRow(row.id, { buyDate: e.target.value })} />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Current price</label>
                        <Input
                          value={row.currentPrice}
                          invalid={!!errors[`${row.id}.currentPrice`]}
                          placeholder="Leave blank to let the API price it"
                          inputMode="decimal"
                          className="no-spin h-9"
                          onChange={(e) => setRow(row.id, { currentPrice: e.target.value })}
                        />
                        {errors[`${row.id}.currentPrice`] ? (
                          <p className="mt-1 text-[11px] text-rose-600">{errors[`${row.id}.currentPrice`]}</p>
                        ) : (
                          <p className="mt-1 text-[10px] text-slate-400">Optional — enables local P&amp;L preview.</p>
                        )}
                      </div>
                      <div className="sm:col-span-3">
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Analysis question</label>
                        <Input
                          value={row.analysisQuestion}
                          placeholder="e.g. How exposed am I to this one stock?"
                          className="h-9"
                          onChange={(e) => setRow(row.id, { analysisQuestion: e.target.value })}
                        />
                        <p className="mt-1 text-[10px] text-slate-400">Optional — the AI answers this using only this stock's supplied data.</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* ------------------------------ Preview ------------------------------ */}
        <div className="space-y-4">
          <Card className="xl:sticky xl:top-24">
            <CardHeader title="Submission preview" subtitle="Calculated locally in your browser" />
            <CardBody className="space-y-4">
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Valid holdings</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{preview.valid}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Total invested</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {preview.valid ? formatCurrency(preview.invested, currency) : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Current value</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">
                    {preview.current !== undefined ? formatCurrency(preview.current, currency) : "—"}
                  </dd>
                </div>
                {preview.current !== undefined && preview.invested > 0 && (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <dt className="text-slate-500">Indicative P&amp;L</dt>
                    <dd>
                      <ChangePill value={((preview.current - preview.invested) / preview.invested) * 100} />
                    </dd>
                  </div>
                )}
              </dl>
              <p className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                Preview figures are computed from your inputs only. Official valuation and insight come from the API response.
              </p>
              <Button onClick={onAnalyze} loading={submitting} size="lg" className="w-full">
                {submitting ? "Analyzing…" : "Analyze portfolio"} {!submitting && <Play className="h-4 w-4" />}
              </Button>
              <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Holdings go directly to your configured API. This app keeps them in memory only — never in browser storage or analytics.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ------------------------------ Results ------------------------------ */}
      {result !== null && (
        <div ref={resultRef} className="space-y-5 animate-fade-up">
          <Card>
            <CardHeader
              title="Analysis results"
              subtitle={
                totals && (totals.invested !== undefined || totals.current !== undefined)
                  ? "Headline figures extracted from the API response"
                  : "Structured view of everything the API returned"
              }
              icon={<Sparkles className="h-4 w-4" />}
              actions={<Badge tone="sky">{resultCurrency}</Badge>}
            />
            <CardBody className="space-y-6">
              {totals && (totals.invested !== undefined || totals.current !== undefined || totals.pnl !== undefined) && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { label: "Invested value", value: formatCurrency(totals.invested, resultCurrency) },
                    { label: "Current value", value: formatCurrency(totals.current, resultCurrency) },
                    {
                      label: "Profit / loss",
                      value: totals.pnl === undefined ? "—" : formatCurrency(totals.pnl, resultCurrency, { sign: true }),
                      tone: totals.pnl === undefined ? "" : totals.pnl >= 0 ? "text-emerald-600" : "text-rose-600",
                    },
                    {
                      label: totals.holdingsCount !== undefined ? `Return · ${totals.holdingsCount} holdings` : "Overall return",
                      value: undefined,
                      extra: <ChangePill value={totals.pct} />,
                    },
                  ].map((tile) => (
                    <div key={tile.label} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400" title={tile.label}>{tile.label}</p>
                      {tile.value !== undefined && (
                        <p className={cn("mt-1.5 text-xl font-bold tabular-nums tracking-tight", tile.tone || "text-slate-900")}>{tile.value}</p>
                      )}
                      {tile.extra && <div className="mt-2">{tile.extra}</div>}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-2">
                {donutItems.length > 0 && (
                  <div>
                    <p className="mb-3 text-[13px] font-semibold text-slate-700">Allocation by holding value</p>
                    <AllocationDonut items={donutItems} currency={resultCurrency} height={210} />
                  </div>
                )}
                {insightGroups.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[13px] font-semibold text-slate-700">AI observations</p>
                    <InsightCards groups={insightGroups} max={2} />
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-5 space-y-4">
                {individualAnalyses ? (
                  individualAnalyses.map((item, index) => (
                    <Card key={`${item.symbol}-${index}`}>
                      <CardHeader
                        title={`${item.symbol} analysis`}
                        subtitle={item.success ? "Individual backend analysis result" : "This stock request failed"}
                        icon={<CandlestickChart className="h-4 w-4" />}
                        actions={
                          <Badge tone={item.success ? "sky" : "rose"}>
                            {item.success ? "Completed" : "Failed"}
                          </Badge>
                        }
                      />
                      <CardBody>
                        {item.success && item.response !== undefined ? (
                          <ResultView data={item.response} currency={resultCurrency} />
                        ) : (
                          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                            {item.error ?? "The backend request failed for this stock."}
                          </p>
                        )}
                      </CardBody>
                    </Card>
                  ))
                ) : (
                  <ResultView data={result} currency={resultCurrency} />
                )}
              </div>

              <p className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3.5 text-xs leading-relaxed text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Market data and computed metrics come from the backend; narrative fields are AI-generated interpretations.
                All outputs are informational and not investment advice.
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {importOpen && (
        <ExcelImportDialog
          kind="stock"
          initialClientId={clientId}
          currency={currency}
          onClose={() => setImportOpen(false)}
          onImport={onImportRows}
        />
      )}
    </div>
  );
}