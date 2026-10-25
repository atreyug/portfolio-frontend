/**
 * ExcelImportDialog — privacy-first spreadsheet intake.
 *
 * The workbook is parsed entirely in the browser (SheetJS, dynamic import).
 * The file, its ArrayBuffer and all parsed rows live ONLY in this component's
 * state; because parents mount this dialog conditionally, closing it drops
 * everything. The only thing that ever leaves the dialog is pruned, canonical
 * JSON for the rows of the single client the user selected.
 */
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Braces,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/fields";
import { Badge } from "@/components/ui/Badge";
import {
  fieldsForKind,
  guessColumnMapping,
  mfDerived,
  normalizeExcelRows,
  cellToString,
  stockDerived,
  uniqueClientIds,
  type ExcelKind,
  type NormalizedRow,
  type NormalizedSheet,
} from "@/utils/excel";
import {
  buildMutualFundAnalyzeRequest,
  buildStockAnalyzeRequest,
} from "@/utils/portfolio";
import { formatCurrency } from "@/utils/format";
import type { MutualFundHoldingInput, StockHoldingInput } from "@/types/api";
import type { CurrencyCode } from "@/types/api";
import { cn } from "@/utils/cn";

const MAX_ROWS = 5000;

interface ParsedSheet {
  name: string;
  headers: string[];
  rows: unknown[][];
  firstRowNumber: number;
}

type ImportRows = StockHoldingInput[] | MutualFundHoldingInput[];

interface Props {
  kind: ExcelKind;
  initialClientId?: string;
  /** Used only to format the review-preview figures. */
  currency?: CurrencyCode;
  onClose: () => void;
  onImport: (clientId: string, rows: ImportRows) => void;
}

const columnLabel = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : `Col ${i + 1}`);

const STEPS = [
  { n: 1, label: "Upload file", icon: Upload },
  { n: 2, label: "Map columns", icon: SlidersHorizontal },
  { n: 3, label: "Review & import", icon: Eye },
] as const;

export function ExcelImportDialog({ kind, initialClientId = "", currency = "INR", onClose, onImport }: Props) {
  const fields = useMemo(() => fieldsForKind(kind), [kind]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIx, setSheetIx] = useState(0);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [clientSource, setClientSource] = useState<"column" | "single">("single");
  const [singleClientId, setSingleClientId] = useState(initialClientId);
  const [pickedClientId, setPickedClientId] = useState("");
  const [showJson, setShowJson] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sheet = sheets[sheetIx];

  const configureSheet = (next: ParsedSheet) => {
    const guessed = guessColumnMapping(next.headers, fields);
    setMapping(guessed);
    const clientCol = guessed.client_id;
    const ids = uniqueClientIds(next.rows, clientCol);
    if (clientCol !== undefined && ids.length > 0) {
      setClientSource("column");
      setPickedClientId(ids[0]);
    } else {
      setClientSource("single");
      setPickedClientId("");
    }
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const parsed: ParsedSheet[] = [];
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        if (!ws) continue;
        const aoa = XLSX.utils
          .sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true, blankrows: false })
          .slice(0, MAX_ROWS + 5);
        const headerIx = aoa.findIndex((row) => row.filter((c) => String(c).trim() !== "").length >= 2);
        if (headerIx < 0) continue;
        const headers = aoa[headerIx].map(cellToString);
        const rows = aoa.slice(headerIx + 1, headerIx + 1 + MAX_ROWS);
        if (rows.length === 0) continue;
        parsed.push({ name, headers, rows, firstRowNumber: headerIx + 2 });
      }
      if (parsed.length === 0) {
        setParseError(
          "No usable sheet found. Expected a header row (e.g. client_id, symbol, quantity, buy_price) with data beneath it.",
        );
        return;
      }
      setFileName(file.name);
      setSheets(parsed);
      setSheetIx(0);
      configureSheet(parsed[0]);
      setStep(2);
    } catch {
      setParseError("Could not read that file. Supported formats: .xlsx, .xls and .csv.");
    } finally {
      setParsing(false);
    }
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const clientIds = useMemo(() => (sheet ? uniqueClientIds(sheet.rows, mapping.client_id) : []), [sheet, mapping]);

  const normalized: NormalizedSheet<StockHoldingInput | MutualFundHoldingInput> | null = useMemo(() => {
    if (!sheet) return null;
    return normalizeExcelRows(kind, sheet.rows, mapping, {
      firstRowNumber: sheet.firstRowNumber,
      ...(clientSource === "single"
        ? { overrideClientId: singleClientId.trim() || undefined }
        : { onlyClientId: pickedClientId }),
    }) as NormalizedSheet<StockHoldingInput | MutualFundHoldingInput>;
  }, [kind, sheet, mapping, clientSource, singleClientId, pickedClientId]);

  const validRows = useMemo(
    () => (normalized?.rows ?? []).filter((r) => r.errors.length === 0 && r.clientId !== ""),
    [normalized],
  );
  const errorRows = useMemo(() => (normalized?.rows ?? []).filter((r) => r.errors.length > 0), [normalized]);
  const effectiveClient = clientSource === "single" ? singleClientId.trim() : pickedClientId;
  const canImport = validRows.length > 0 && effectiveClient !== "";
  const requiredMapped = fields.filter((f) => f.required && f.key !== "client_id").every((f) => mapping[f.key] !== undefined);

  const jsonPreview = useMemo(() => {
    const sample = validRows.slice(0, 4).map((r) => r.data);
    const pruned =
      kind === "stock"
        ? buildStockAnalyzeRequest(effectiveClient, undefined, sample as StockHoldingInput[]).holdings
        : buildMutualFundAnalyzeRequest(effectiveClient, undefined, sample as MutualFundHoldingInput[]).holdings;
    return JSON.stringify(pruned, null, 2);
  }, [kind, validRows, effectiveClient]);

  const doImport = () => {
    if (!canImport) return;
    const rows =
      kind === "stock"
        ? buildStockAnalyzeRequest(effectiveClient, undefined, validRows.map((r) => r.data) as StockHoldingInput[]).holdings
        : buildMutualFundAnalyzeRequest(effectiveClient, undefined, validRows.map((r) => r.data) as MutualFundHoldingInput[]).holdings;
    onImport(effectiveClient, rows);
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-navy-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl animate-scale-in flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-slate-900">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Import {kind === "stock" ? "stock holdings" : "mutual fund holdings"} from Excel
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Parsed locally in your browser — the file is never uploaded; only normalized JSON for one client is used.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close import" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-6 py-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && <span className="mx-1 h-px w-6 bg-slate-200" />}
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                  step > s.n ? "bg-emerald-100 text-emerald-700" : step === s.n ? "bg-navy-950 text-white" : "bg-slate-200 text-slate-500",
                )}
              >
                {step > s.n ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.n}
              </span>
              <span className={cn("text-xs font-semibold", step === s.n ? "text-slate-900" : "text-slate-400")}>{s.label}</span>
            </div>
          ))}
          {fileName && (
            <span className="ml-auto truncate rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
              {fileName}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 1 && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition",
                  dragOver ? "border-emerald-400 bg-emerald-50/60" : "border-slate-300 bg-slate-50/60 hover:border-slate-400",
                )}
              >
                {parsing ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                    <p className="text-sm font-semibold text-slate-700">Parsing spreadsheet locally…</p>
                  </>
                ) : (
                  <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200">
                      <Upload className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Drop your Excel file here, or click to browse</p>
                      <p className="mt-1 text-xs text-slate-500">.xlsx, .xls or .csv · first sheet with a header row is used · up to {MAX_ROWS.toLocaleString()} rows</p>
                    </div>
                  </>
                )}
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onPickFile} />
              </div>
              {parseError && (
                <p className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {parseError}
                </p>
              )}
              <div className="rounded-xl bg-slate-50 p-4 text-[13px] leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-800">Expected columns (any naming works — you'll map them next)</p>
                <p className="mt-1.5">
                  {kind === "stock" ? (
                    <>Required: <code className="rounded bg-white px-1 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">client_id</code>, <code className="rounded bg-white px-1 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">symbol</code>, <code className="rounded bg-white px-1 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">quantity</code>, <code className="rounded bg-white px-1 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">buy_price</code> · optional: security_name, isin, exchange, buy_date, current_price.</>
                  ) : (
                    <>Required: <code className="rounded bg-white px-1 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">client_id</code>, <code className="rounded bg-white px-1 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">scheme_name</code>, <code className="rounded bg-white px-1 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200">units</code> · optional: scheme_code, folio_no, invested_value, current_nav, current_value, investment_date, xirr_pct.</>
                  )}
                </p>
              </div>
            </div>
          )}

          {step === 2 && sheet && (
            <div className="space-y-6">
              {sheets.length > 1 && (
                <div className="max-w-xs">
                  <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Worksheet</label>
                  <Select
                    value={String(sheetIx)}
                    onChange={(e) => {
                      const ix = Number(e.target.value);
                      setSheetIx(ix);
                      configureSheet(sheets[ix]);
                    }}
                  >
                    {sheets.map((s, i) => (
                      <option key={s.name} value={i}>
                        {s.name} ({s.rows.length} rows)
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Column mapping */}
              <div>
                <p className="text-[13px] font-semibold text-slate-800">Map spreadsheet columns to canonical fields</p>
                <p className="mt-0.5 text-xs text-slate-500">We guessed based on header names — adjust anything that looks off. Unmapped optional fields are simply skipped.</p>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field.key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-800">
                          {field.label} {field.required && <span className="text-rose-500">*</span>}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">{field.key}</p>
                      </div>
                      <Select
                        className="h-8 w-44 text-xs"
                        value={mapping[field.key] !== undefined ? String(mapping[field.key]) : ""}
                        onChange={(e) =>
                          setMapping((prev) => {
                            const next = { ...prev };
                            if (e.target.value === "") delete next[field.key];
                            else next[field.key] = Number(e.target.value);
                            return next;
                          })
                        }
                      >
                        <option value="">— Not in file —</option>
                        {sheet.headers.map((h, i) => (
                          <option key={`${i}-${h}`} value={i}>
                            {columnLabel(i)} · {h || "(blank header)"}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
                {!requiredMapped && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                    <AlertTriangle className="h-4 w-4" /> Map all required fields (*) to columns, otherwise those rows will fail validation.
                  </p>
                )}
              </div>

              {/* Client selection */}
              <div>
                <p className="text-[13px] font-semibold text-slate-800">Choose whose rows to extract</p>
                <p className="mt-0.5 text-xs text-slate-500">Only the selected client's holdings are normalized and imported — everything else stays behind.</p>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <button
                    onClick={() => setClientSource("column")}
                    disabled={mapping.client_id === undefined || clientIds.length === 0}
                    className={cn(
                      "rounded-xl border p-3.5 text-left transition",
                      clientSource === "column" ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/25" : "border-slate-200 bg-white hover:border-slate-300",
                      (mapping.client_id === undefined || clientIds.length === 0) && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <p className="text-[13px] font-semibold text-slate-900">Pick from the file</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {mapping.client_id === undefined
                        ? "Map a client_id column first"
                        : `${clientIds.length} client${clientIds.length === 1 ? "" : "s"} found in the sheet`}
                    </p>
                  </button>
                  <button
                    onClick={() => setClientSource("single")}
                    className={cn(
                      "rounded-xl border p-3.5 text-left transition",
                      clientSource === "single" ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/25" : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <p className="text-[13px] font-semibold text-slate-900">One client for all rows</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Apply a single client ID to every valid row</p>
                  </button>
                </div>
                <div className="mt-3 max-w-sm">
                  {clientSource === "column" ? (
                    <>
                      <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Client to extract</label>
                      <Select value={pickedClientId} onChange={(e) => setPickedClientId(e.target.value)}>
                        {clientIds.map((id) => (
                          <option key={id} value={id}>{id}</option>
                        ))}
                      </Select>
                    </>
                  ) : (
                    <>
                      <label className="mb-1.5 block text-[13px] font-medium text-slate-700">Client ID</label>
                      <Input value={singleClientId} placeholder="e.g. client-1024" onChange={(e) => setSingleClientId(e.target.value)} />
                    </>
                  )}
                </div>
              </div>

              {/* Live result hint */}
              {normalized && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
                  <Badge tone="emerald">{validRows.length} valid</Badge>
                  {errorRows.length > 0 && <Badge tone="rose">{errorRows.length} with errors</Badge>}
                  {normalized.skippedOtherClients > 0 && <Badge>{normalized.skippedOtherClients} other clients skipped</Badge>}
                  {normalized.skippedBlank > 0 && <Badge>{normalized.skippedBlank} blank rows skipped</Badge>}
                </div>
              )}
            </div>
          )}

          {step === 3 && sheet && normalized && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="emerald">{validRows.length} rows to import</Badge>
                <Badge tone={errorRows.length ? "rose" : "slate"}>{errorRows.length} rows with errors</Badge>
                <Badge>Client · {effectiveClient || "—"}</Badge>
                <Badge>{sheet.name}</Badge>
              </div>

              {validRows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[640px] border-collapse bg-white text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        {kind === "stock"
                          ? ["#", "Symbol", "Qty", "Buy price", "Invested*", "Cur. price", "Current*", "P&L*"].map((h) => (
                              <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{h}</th>
                            ))
                          : ["#", "Scheme", "Units", "Invested", "NAV", "Current", "P&L", "XIRR"].map((h) => (
                              <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{h}</th>
                            ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 8).map((row) => (
                        <PreviewRow key={row.rowNumber} kind={kind} row={row} currency={currency} />
                      ))}
                    </tbody>
                  </table>
                  {validRows.length > 8 && (
                    <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-400">
                      + {validRows.length - 8} more valid rows will be imported · * derived from your data
                    </p>
                  )}
                </div>
              ) : (
                <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> No valid rows to import for this client. Adjust the mapping or fix the errors below.
                </p>
              )}

              {errorRows.length > 0 && (
                <div className="rounded-xl border border-rose-200/70 bg-rose-50/50">
                  <p className="border-b border-rose-100 px-4 py-2.5 text-xs font-semibold text-rose-700">
                    Rows needing fixes ({errorRows.length}) — they will be skipped
                  </p>
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto px-4 py-3">
                    {errorRows.slice(0, 12).map((row) => (
                      <li key={row.rowNumber} className="text-xs text-rose-600">
                        <span className="font-mono font-semibold">Row {row.rowNumber}</span>
                        <span className="text-rose-400"> — </span>
                        {row.errors.join(" · ")}
                      </li>
                    ))}
                    {errorRows.length > 12 && <li className="text-xs text-rose-400">+ {errorRows.length - 12} more</li>}
                  </ul>
                </div>
              )}

              <div>
                <button
                  onClick={() => setShowJson((s) => !s)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <Braces className="h-3.5 w-3.5" />
                  {showJson ? "Hide" : "Preview"} normalized JSON (only this is used)
                </button>
                {showJson && (
                  <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-navy-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-100/90">
                    {jsonPreview}
                    {validRows.length > 4 ? `\n… + ${validRows.length - 4} more` : ""}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          <p className="hidden items-center gap-1.5 text-[11px] text-slate-400 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Closing this dialog discards the file and all parsed data.
          </p>
          <div className="flex gap-2">
            {step === 1 && <Button variant="secondary" onClick={onClose}>Cancel</Button>}
            {step === 2 && (
              <>
                <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button onClick={() => setStep(3)} disabled={!normalized || (clientSource === "single" && !singleClientId.trim())}>
                  Review rows <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {step === 3 && (
              <>
                <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button variant="secondary" onClick={onClose}>Discard</Button>
                <Button onClick={doImport} disabled={!canImport}>
                  Import {validRows.length} holding{validRows.length === 1 ? "" : "s"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PreviewRow({
  kind,
  row,
  currency,
}: {
  kind: ExcelKind;
  row: NormalizedRow<StockHoldingInput | MutualFundHoldingInput>;
  currency: CurrencyCode;
}) {
  if (kind === "stock") {
    const d = row.data as Partial<StockHoldingInput>;
    const m = stockDerived(d);
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{row.rowNumber}</td>
        <td className="px-3 py-2 text-[13px] font-semibold text-slate-900">{d.symbol}</td>
        <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-700">{d.quantity}</td>
        <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-700">{formatCurrency(d.buy_price, currency)}</td>
        <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-500">{formatCurrency(m.invested, currency)}</td>
        <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-700">{formatCurrency(d.current_price, currency)}</td>
        <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-500">{formatCurrency(m.current, currency)}</td>
        <td className={cn("px-3 py-2 text-right text-[13px] font-medium tabular-nums", (m.pnl ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
          {m.pnl === undefined ? "—" : formatCurrency(m.pnl, currency, { sign: true })}
        </td>
      </tr>
    );
  }
  const d = row.data as Partial<MutualFundHoldingInput>;
  const m = mfDerived(d);
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{row.rowNumber}</td>
      <td className="max-w-[220px] truncate px-3 py-2 text-[13px] font-semibold text-slate-900" title={d.scheme_name}>{d.scheme_name}</td>
      <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-700">{d.units}</td>
      <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-700">{formatCurrency(d.invested_value, currency)}</td>
      <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-700">{formatCurrency(d.current_nav, currency)}</td>
      <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-500">
        {formatCurrency(m.current, currency)}
        {row.derived.includes("current_value") && (
          <span className="ml-1 rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-bold text-emerald-600">derived</span>
        )}
      </td>
      <td className={cn("px-3 py-2 text-right text-[13px] font-medium tabular-nums", (m.pnl ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
        {m.pnl === undefined ? "—" : formatCurrency(m.pnl, currency, { sign: true })}
      </td>
      <td className="px-3 py-2 text-right text-[13px] tabular-nums text-slate-700">{d.xirr_pct !== undefined ? `${d.xirr_pct}%` : "—"}</td>
    </tr>
  );
}
