import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  ChevronDown,
  FileSpreadsheet,
  Landmark,
  Lock,
  Play,
  Plus,
  Sparkles,
  Target,
  Timer,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/fields";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResultView } from "@/components/ResultView";
import { ValueAreaChart } from "@/components/charts/ValueAreaChart";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useSessionData } from "@/context/SessionDataContext";
import { analyzeMutualFundPortfolio, analyzeMutualFunds } from "@/services/portfolio";
import { normalizeApiError } from "@/services/client";
import {
  parseNum,
  PROJECTION_FIELD_META,
  projectionFieldsFor,
  validateProjectionInputs,
} from "@/utils/validate";
import { detectCurrency, extractSeries } from "@/utils/payload";
import { buildMutualFundAnalyzeRequest, buildProjectionRequest } from "@/utils/portfolio";
import { ExcelImportDialog } from "@/components/import/ExcelImportDialog";
import { formatCurrency } from "@/utils/format";
import type { CurrencyCode, MutualFundHoldingInput, ProjectionType } from "@/types/api";
import { cn } from "@/utils/cn";

/* ------------------------------ Holdings tab ----------------------------- */

interface Row {
  id: string;
  schemeName: string;
  units: string;
  schemeCode: string;
  folioNo: string;
  investedValue: string;
  currentNav: string;
  currentValue: string;
  investmentDate: string;
  xirrPct: string;
  analysisQuestion: string;
  expanded: boolean;
}

let seq = 0;
const newRow = (): Row => ({
  id: `mf-${++seq}`,
  schemeName: "",
  units: "",
  schemeCode: "",
  folioNo: "",
  investedValue: "",
  currentNav: "",
  currentValue: "",
  investmentDate: "",
  xirrPct: "",
  analysisQuestion: "",
  expanded: false,
});

function HoldingsTab({
  clientId,
  currency,
  onImportedClient,
}: {
  clientId: string;
  currency: CurrencyCode;
  onImportedClient: (id: string) => void;
}) {
  const toast = useToast();
  const session = useSessionData();
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; schemeName: string; data?: unknown; error?: string }> | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const setRow = (id: string, patch: Partial<Row>) => setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const isBlankRow = (r: Row) => !r.schemeName.trim() && !r.units.trim();

  const onImportRows = (client: string, imported: unknown[]) => {
    const list = imported as MutualFundHoldingInput[];
    const gridRows: Row[] = list.map((h) => ({
      ...newRow(),
      schemeName: h.scheme_name ?? "",
      units: h.units !== undefined ? String(h.units) : "",
      schemeCode: h.scheme_code !== undefined ? String(h.scheme_code) : "",
      folioNo: h.folio_no ?? "",
      investedValue: h.invested_value !== undefined ? String(h.invested_value) : "",
      currentNav: h.current_nav !== undefined ? String(h.current_nav) : "",
      currentValue: h.current_value !== undefined ? String(h.current_value) : "",
      investmentDate: h.investment_date ?? "",
      xirrPct: h.xirr_pct !== undefined ? String(h.xirr_pct) : "",
    }));
    onImportedClient(client);
    setResults(null);
    setRows((prev) => (prev.every(isBlankRow) ? gridRows : [...prev, ...gridRows]));
    setImportOpen(false);
    toast.success(
      "Holdings imported",
      `${gridRows.length} scheme${gridRows.length === 1 ? "" : "s"} for client “${client}”. Review below, then run analysis.`,
    );
  };

  // Validate the current form values directly. Return the first error so the
  // toast does not depend on React state being updated synchronously.
  const validate = (): string | null => {
    const next: Record<string, string> = {};

    if (!clientId.trim()) {
      next.clientId = "Client ID is required above.";
    }

    // Ignore completely empty rows, but validate any row where either field is filled.
    const usable = rows.filter(
      (r) => r.schemeName.trim() !== "" || r.units.trim() !== "",
    );

    if (usable.length === 0) {
      next.form = "Add at least one mutual fund holding.";
    }

    const isFiniteNumber = (value: string): boolean => {
      if (!value.trim()) return false;
      return Number.isFinite(Number(value));
    };

    for (const r of usable) {
      if (!r.schemeName.trim()) {
        next[`${r.id}.schemeName`] = "Scheme name is required.";
      }

      if (!isFiniteNumber(r.units) || Number(r.units) <= 0) {
        next[`${r.id}.units`] = "Units must be a valid number greater than zero.";
      }

      // Invested value and current value may be zero, but cannot be negative.
      for (const [field, label] of [
        ["investedValue", "Invested value"],
        ["currentValue", "Current value"],
      ] as const) {
        const value = r[field].trim();
        if (value && (!isFiniteNumber(value) || Number(value) < 0)) {
          next[`${r.id}.${field}`] =
            `${label} must be a valid number greater than or equal to zero.`;
        }
      }

      // Current NAV must be positive when supplied.
      const nav = r.currentNav.trim();
      if (nav && (!isFiniteNumber(nav) || Number(nav) <= 0)) {
        next[`${r.id}.currentNav`] = "Current NAV must be greater than zero.";
      }

      // XIRR can be negative, so only check that a supplied value is finite.
      const xirr = r.xirrPct.trim();
      if (xirr && !isFiniteNumber(xirr)) {
        next[`${r.id}.xirrPct`] = "XIRR must be a valid number.";
      }
    }

    setErrors(next);
    return Object.values(next)[0] ?? null;
  };

  const buildHoldings = (): MutualFundHoldingInput[] =>
    rows
      .filter((r) => r.schemeName.trim())
      .map((r) => {
        const h: MutualFundHoldingInput = {
          client_id: clientId.trim(),
          scheme_name: r.schemeName.trim(),
          units: parseNum(r.units)!,
        };
        if (r.schemeCode.trim()) h.scheme_code = r.schemeCode.trim();
        if (r.folioNo.trim()) h.folio_no = r.folioNo.trim();
        const num = (v: string) => parseNum(v);
        const invested = num(r.investedValue);
        if (invested !== undefined) h.invested_value = invested;
        const nav = num(r.currentNav);
        if (nav !== undefined) h.current_nav = nav;
        const cv = num(r.currentValue);
        if (cv !== undefined) h.current_value = cv;
        if (r.investmentDate) h.investment_date = r.investmentDate;
        const xirr = num(r.xirrPct);
        if (xirr !== undefined) h.xirr_pct = xirr;
        return h;
      });

  const onAnalyze = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error("Check the form", validationError);
      return;
    }

    // Each scheme gets its own backend request so every scheme is analyzed
    // independently. Promise.all preserves the input order, while each request
    // catches its own error so one failed scheme does not cancel the others.
    const holdings = buildHoldings();
    const holdingRows = rows.filter((r) => r.schemeName.trim());
    if (submitting || holdings.length === 0) return;

    setSubmitting(true);
    setResults(null);
    try {
      const analysisResults = await Promise.all(
        holdings.map(async (holding, index) => {
          const row = holdingRows[index];
          const payload = buildMutualFundAnalyzeRequest(clientId, currency, [holding], row.analysisQuestion);
          try {
            const response = await analyzeMutualFunds(payload);
            session.record("mutualFund", payload, response);
            return { id: row.id, schemeName: holding.scheme_name, data: response };
          } catch (err) {
            const e = normalizeApiError(err);
            return {
              id: row.id,
              schemeName: holding.scheme_name,
              error: e.details?.[0] ?? e.message ?? "Analysis failed for this scheme.",
            };
          }
        }),
      );

      setResults(analysisResults);
      const failedCount = analysisResults.filter((item) => item.error).length;
      if (failedCount === 0) {
        toast.success(
          "Analysis complete",
          `${analysisResults.length} scheme${analysisResults.length === 1 ? "" : "s"} analyzed successfully.`,
        );
      } else if (failedCount === analysisResults.length) {
        toast.error("Analysis failed", "None of the schemes could be analyzed. Check each scheme's error below.");
      } else {
        toast.error(
          "Analysis partially complete",
          `${analysisResults.length - failedCount} succeeded; ${failedCount} failed. Each result is shown separately below.`,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Mutual fund holdings"
          subtitle="Only scheme name and units are required — optional fields sharpen the analysis."
          icon={<Landmark className="h-4 w-4" />}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)} disabled={submitting}>
                <FileSpreadsheet className="h-4 w-4" /> Import Excel
              </Button>
              <Button variant="subtle" size="sm" onClick={() => setRows((p) => [...p, newRow()])}>
                <Plus className="h-4 w-4" /> Add scheme
              </Button>
            </>
          }
        />
        <CardBody className="space-y-4">
          {errors.form && (
            <p className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
              <AlertTriangle className="h-4 w-4" /> {errors.form}
            </p>
          )}
          {errors.clientId && (
            <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              <AlertTriangle className="h-4 w-4" /> {errors.clientId}
            </p>
          )}

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white">
                <div className="grid grid-cols-[1fr_auto] gap-2 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto_auto] sm:gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Scheme name <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={row.schemeName}
                      invalid={!!errors[`${row.id}.schemeName`]}
                      placeholder="HDFC Flexi Cap Fund — Growth"
                      className="h-9"
                      onChange={(e) => setRow(row.id, { schemeName: e.target.value })}
                    />
                    {errors[`${row.id}.schemeName`] && <p className="mt-1 text-[11px] text-rose-600">{errors[`${row.id}.schemeName`]}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Units <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={row.units}
                      invalid={!!errors[`${row.id}.units`]}
                      placeholder="128.45"
                      inputMode="decimal"
                      className="no-spin h-9"
                      onChange={(e) => setRow(row.id, { units: e.target.value })}
                    />
                    {errors[`${row.id}.units`] && <p className="mt-1 text-[11px] text-rose-600">{errors[`${row.id}.units`]}</p>}
                  </div>
                  <div className="flex items-end pb-0.5 sm:pb-0">
                    <button
                      onClick={() => setRow(row.id, { expanded: !row.expanded })}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                      aria-label={`Toggle optional fields for scheme ${index + 1}`}
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", row.expanded && "rotate-180")} />
                    </button>
                  </div>
                  <div className="flex items-end pb-0.5 sm:pb-0">
                    <button
                      onClick={() => setRows((p) => (p.length === 1 ? p : p.filter((r) => r.id !== row.id)))}
                      disabled={rows.length === 1}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
                      aria-label={`Remove scheme ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {row.expanded && (
                  <div className="grid gap-3 border-t border-dashed border-slate-200 p-3 sm:grid-cols-3 lg:grid-cols-4">
                    {(
                      [
                        ["schemeCode", "Scheme code", "e.g. 119551", false],
                        ["folioNo", "Folio number", "e.g. 12345678/90", false],
                        ["investedValue", "Invested value", "50000", true],
                        ["currentNav", "Current NAV", "812.34", true],
                        ["currentValue", "Current value", "62000", true],
                        ["investmentDate", "Investment date", "", false],
                        ["xirrPct", "XIRR %", "14.2", true],
                      ] as const
                    ).map(([field, label, ph, isNum]) => (
                      <div key={field}>
                        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</label>
                        <Input
                          type={field === "investmentDate" ? "date" : "text"}
                          inputMode={isNum ? "decimal" : undefined}
                          value={row[field]}
                          invalid={!!errors[`${row.id}.${field}`]}
                          placeholder={ph}
                          className={cn("h-9", isNum && "no-spin")}
                          onChange={(e) => setRow(row.id, { [field]: e.target.value })}
                        />
                        {errors[`${row.id}.${field}`] && <p className="mt-1 text-[11px] text-rose-600">{errors[`${row.id}.${field}`]}</p>}
                      </div>
                    ))}
                    <div className="sm:col-span-3 lg:col-span-4">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Analysis question</label>
                      <Input
                        value={row.analysisQuestion}
                        placeholder="e.g. Is this scheme's NAV live or stale?"
                        className="h-9"
                        onChange={(e) => setRow(row.id, { analysisQuestion: e.target.value })}
                      />
                      <p className="mt-1 text-[10px] text-slate-400">Optional — the AI answers this using only this scheme's supplied data.</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400 sm:max-w-md">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Folio numbers and scheme data are sent to your API only and held in memory on this device.
            </p>
            <Button onClick={onAnalyze} loading={submitting} disabled={submitting} className="sm:w-auto w-full">
              {submitting ? "Analyzing…" : "Analyze holdings"} {!submitting && <Play className="h-4 w-4" />}
            </Button>
          </div>
        </CardBody>
      </Card>

      {results !== null && (
        <div className="space-y-4">
          {results.map((item) => (
            <Card key={item.id} className="animate-fade-up">
              <CardHeader
                title={item.schemeName}
                subtitle={item.error ? "Analysis failed for this scheme" : "Individual scheme analysis"}
                icon={<Sparkles className="h-4 w-4" />}
                actions={
                  <Badge tone="sky">
                    {item.error ? "Failed" : detectCurrency(item.data, currency)}
                  </Badge>
                }
              />
              <CardBody className="space-y-4">
                {item.error ? (
                  <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm leading-relaxed text-rose-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {item.error}
                  </p>
                ) : (
                  <>
                    <ResultView data={item.data} currency={detectCurrency(item.data, currency)} />
                    <p className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3.5 text-xs leading-relaxed text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      Narrative fields are AI-generated interpretations returned by the backend — informational, not investment advice.
                    </p>
                  </>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {importOpen && (
        <ExcelImportDialog
          kind="mf"
          initialClientId={clientId}
          currency={currency}
          onClose={() => setImportOpen(false)}
          onImport={onImportRows}
        />
      )}
    </div>
  );
}

/* ----------------------------- Projections tab ---------------------------- */

const PROJECTION_TYPES: Array<{
  type: ProjectionType;
  title: string;
  blurb: string;
  icon: typeof Calculator;
}> = [
  { type: "FUTURE_VALUE", title: "Future value", blurb: "What could my SIP grow to?", icon: TrendingUp },
  { type: "REQUIRED_SIP", title: "Required SIP", blurb: "What SIP do I need for a goal?", icon: Target },
  { type: "TIME_TO_TARGET", title: "Time to target", blurb: "How long until I reach my goal?", icon: Timer },
  { type: "LUMPSUM_GROWTH", title: "Lumpsum growth", blurb: "How could a one-time amount grow?", icon: Landmark },
];

function ProjectionsTab({ clientId, currency }: { clientId: string; currency: CurrencyCode }) {
  const toast = useToast();
  const session = useSessionData();
  const [projectionType, setProjectionType] = useState<ProjectionType>("FUTURE_VALUE");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<unknown | null>(null);

  const config = PROJECTION_TYPES.find((p) => p.type === projectionType)!;
  const activeFields = projectionFieldsFor(projectionType);

  const setValue = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const onRun = async () => {
    const next = validateProjectionInputs(projectionType, values);
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Check the form", "Fix the highlighted projection inputs.");
      return;
    }
    setSubmitting(true);
    setResult(null);
    const payload = buildProjectionRequest(projectionType, values, clientId, currency);
    try {
      const response = await analyzeMutualFundPortfolio(payload);
      setResult(response);
      session.record("projection", payload, response);
      toast.success("Projection ready", "The backend returned your projection.");
    } catch (err) {
      const e = normalizeApiError(err);
      toast.error("Projection failed", e.details?.[0] ?? e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resultCurrency = result ? detectCurrency(result, currency) : currency;
  const series = result ? extractSeries(result) : undefined;
  const chartData = useMemo(
    () => series?.map((p) => ({ x: p.x, y: p.y })) ?? [],
    [series],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Card className="h-fit xl:sticky xl:top-24">
        <CardHeader title="Projection setup" subtitle="Pick a goal type, then fill the inputs it needs." />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            {PROJECTION_TYPES.map((p) => (
              <button
                key={p.type}
                onClick={() => {
                  setProjectionType(p.type);
                  setErrors({});
                  setResult(null);
                }}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all",
                  projectionType === p.type
                    ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/25"
                    : "border-slate-200 bg-white hover:border-slate-300",
                )}
              >
                <p.icon className={cn("h-4 w-4", projectionType === p.type ? "text-emerald-600" : "text-slate-400")} />
                <p className="mt-2 text-[13px] font-semibold text-slate-900">{p.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{p.blurb}</p>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {activeFields.map(({ key: field, optional }) => {
              const meta = PROJECTION_FIELD_META[field];
              return (
                <Field
                  key={`${projectionType}.${field}`}
                  label={meta.label}
                  required={!optional}
                  hint={optional ? `${meta.hint} (Optional)` : meta.hint}
                  error={errors[field]}
                >
                  {(id) => (
                    <div className="relative">
                      <Input
                        id={id}
                        value={values[field] ?? ""}
                        invalid={!!errors[field]}
                        inputMode="decimal"
                        className={cn("no-spin", meta.money ? "pl-8" : meta.suffix ? "pr-16" : "")}
                        placeholder={field === "expected_return_pct" ? "12" : field === "duration_months" ? "120" : "10000"}
                        onChange={(e) => setValue(field, e.target.value)}
                      />
                      {meta.money && (
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-slate-400">
                          {currency === "USD" ? "$" : "₹"}
                        </span>
                      )}
                      {meta.suffix && (
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-slate-400">
                          {meta.suffix}
                        </span>
                      )}
                    </div>
                  )}
                </Field>
              );
            })}
          </div>

          <Button onClick={onRun} loading={submitting} size="lg" className="w-full">
            {submitting ? "Projecting…" : "Run projection"} {!submitting && <Calculator className="h-4 w-4" />}
          </Button>
        </CardBody>
      </Card>

      <div className="space-y-5">
        {result === null ? (
          <EmptyState
            icon={Calculator}
            title="No projection yet"
            description="Configure a projection on the left and run it. Growth curves appear here whenever the backend returns a series."
          />
        ) : (
          <Card className="animate-fade-up">
            <CardHeader
              title={`${config.title} — results`}
              subtitle="Everything the backend returned for this projection"
              icon={<Sparkles className="h-4 w-4" />}
              actions={<Badge tone="sky">{resultCurrency}</Badge>}
            />
            <CardBody className="space-y-5">
              {chartData.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="mb-2 text-[13px] font-semibold text-slate-700">Projected growth curve</p>
                  <ValueAreaChart data={chartData} currency={resultCurrency} height={260} />
                  <p className="mt-2 text-right text-[11px] text-slate-400">
                    Peak: {formatCurrency(Math.max(...chartData.map((c) => c.y)), resultCurrency, { compact: true })}
                  </p>
                </div>
              )}
              <ResultView data={result} currency={resultCurrency} />
              <p className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3.5 text-xs leading-relaxed text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Projections are mathematical estimates based on your assumed return rate. Markets are uncertain — projected
                values are not guaranteed outcomes.
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

/* --------------------------------- Page ---------------------------------- */

export function MutualFundPage() {
  const { manager } = useAuth();
  const [tab, setTab] = useState<"holdings" | "projections">("holdings");
  const defaultClientId = typeof manager?.id === "string" || typeof manager?.id === "number" ? String(manager.id) : "";
  const [clientId, setClientId] = useState(defaultClientId);
  const [currency, setCurrency] = useState<CurrencyCode>("INR");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mutual fund & SIP analysis"
        subtitle="Analyze scheme holdings, or project future value, required SIP, time to target and lumpsum growth."
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {(
            [
              ["holdings", "Holdings analysis", Landmark],
              ["projections", "SIP projections", Calculator],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold transition",
                tab === key ? "bg-navy-950 text-white shadow-sm" : "text-slate-500 hover:text-slate-800",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Client ID" className="w-44">
            {(id) => <Input id={id} value={clientId} placeholder="e.g. client-1024" onChange={(e) => setClientId(e.target.value)} />}
          </Field>
          <Field label="Currency" className="w-32">
            {(id) => (
              <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </Select>
            )}
          </Field>
        </div>
      </div>

      {/* Both tabs stay mounted so entries survive tab switches (memory only). */}
      <div className={tab === "holdings" ? "" : "hidden"}>
        <HoldingsTab clientId={clientId} currency={currency} onImportedClient={setClientId} />
      </div>
      <div className={tab === "projections" ? "" : "hidden"}>
        <ProjectionsTab clientId={clientId} currency={currency} />
      </div>
    </div>
  );
}