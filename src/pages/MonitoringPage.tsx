import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  Play,
  Radar,
  RefreshCcw,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/fields";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/Modal";
import { ResultView } from "@/components/ResultView";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useSessionData } from "@/context/SessionDataContext";
import { runMonitoringCheck, runMonitoringSweep } from "@/services/monitoring";
import { normalizeApiError } from "@/services/client";
import { parseNum, validateMonitoringInputs } from "@/utils/validate";
import { buildMonitoringCheckRequest, EXCHANGES } from "@/utils/portfolio";
import { deepFind, detectCurrency } from "@/utils/payload";
import { formatDateTime } from "@/utils/format";
import type { CurrencyCode } from "@/types/api";
import { cn } from "@/utils/cn";

interface CheckStatus {
  kind: "clear" | "triggered" | "unknown";
  label: string;
  detail?: string;
}

function interpretStatus(result: unknown): CheckStatus {
  const triggered = deepFind(result, ["alert_triggered", "triggered", "is_triggered", "breached", "alert"], 3);
  if (triggered === true) {
    const reason = deepFind(result, ["reason", "message", "detail", "trigger_reason"], 3);
    return { kind: "triggered", label: "Alert condition triggered", detail: typeof reason === "string" ? reason : undefined };
  }
  if (triggered === false) return { kind: "clear", label: "No alert condition triggered" };
  const status = deepFind(result, ["status", "monitoring_status", "state"], 3);
  if (typeof status === "string" && status.trim()) {
    const s = status.toLowerCase();
    if (/trigger|breach|alert|violation|warn|critical/.test(s)) return { kind: "triggered", label: status };
    if (/ok|normal|clear|healthy|watching|active|complete|done/.test(s)) return { kind: "clear", label: status };
    return { kind: "unknown", label: status };
  }
  return { kind: "unknown", label: "Check completed" };
}

export function MonitoringPage() {
  const { manager } = useAuth();
  const toast = useToast();
  const session = useSessionData();

  const defaultClientId = typeof manager?.id === "string" || typeof manager?.id === "number" ? String(manager.id) : "";
  const [clientId, setClientId] = useState(defaultClientId);
  const [symbol, setSymbol] = useState("");
  const [exchange, setExchange] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [currency] = useState<CurrencyCode>("INR");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<unknown | null>(null);
  const [checkTime, setCheckTime] = useState<string | null>(null);

  const [sweepOpen, setSweepOpen] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<unknown | null>(null);

  const status = checkResult !== null ? interpretStatus(checkResult) : null;

  const onCheck = async () => {
    const next = validateMonitoringInputs({ clientId, symbol, quantity, buyPrice });
    setErrors(next);
    if (Object.keys(next).length) return;

    setChecking(true);
    setCheckResult(null);
    const payload = buildMonitoringCheckRequest(clientId, symbol, {
      exchange: exchange || undefined,
      quantity: parseNum(quantity),
      buyPrice: parseNum(buyPrice),
    });

    try {
      const response = await runMonitoringCheck(payload);
      setCheckResult(response);
      setCheckTime(new Date().toISOString());
      session.record("monitoring", payload, response);
      const s = interpretStatus(response);
      if (s.kind === "triggered") toast.info("Monitoring flag raised", s.label);
      else toast.success("Check complete", s.label);
    } catch (err) {
      const e = normalizeApiError(err);
      toast.error("Monitoring check failed", e.details?.[0] ?? e.message);
    } finally {
      setChecking(false);
    }
  };

  const onSweep = async () => {
    setSweeping(true);
    setSweepResult(null);
    try {
      const payload = clientId.trim() ? { client_id: clientId.trim() } : {};
      const response = await runMonitoringSweep(payload);
      setSweepResult(response);
      toast.success("Monitoring sweep finished", "The backend completed its monitoring run.");
    } catch (err) {
      const e = normalizeApiError(err);
      toast.error("Sweep failed", e.message);
    } finally {
      setSweeping(false);
      setSweepOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio monitoring"
        subtitle="Run targeted monitoring checks against a holding, or trigger the backend's full monitoring pass."
        actions={
          <Button variant="navy" size="sm" onClick={() => setSweepOpen(true)} loading={sweeping}>
            <Zap className="h-4 w-4" /> Run full sweep
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Monitoring check" subtitle="Evaluate one holding right now" icon={<Radar className="h-4 w-4" />} />
            <CardBody className="space-y-4">
              <Field label="Client ID" required error={errors.clientId}>
                {(id) => <Input id={id} value={clientId} invalid={!!errors.clientId} placeholder="e.g. client-1024" onChange={(e) => setClientId(e.target.value)} />}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Symbol" required error={errors.symbol}>
                  {(id) => <Input id={id} value={symbol} invalid={!!errors.symbol} placeholder="RELIANCE" className="uppercase" onChange={(e) => setSymbol(e.target.value)} />}
                </Field>
                <Field label="Exchange" hint="Optional">
                  {(id) => (
                    <Select id={id} value={exchange} onChange={(e) => setExchange(e.target.value)}>
                      <option value="">— Any —</option>
                      {EXCHANGES.map((ex) => (
                        <option key={ex} value={ex}>{ex}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity" hint="Optional" error={errors.quantity}>
                  {(id) => <Input id={id} value={quantity} invalid={!!errors.quantity} placeholder="25" inputMode="decimal" className="no-spin" onChange={(e) => setQuantity(e.target.value)} />}
                </Field>
                <Field label="Buy price" hint="Optional" error={errors.buyPrice}>
                  {(id) => <Input id={id} value={buyPrice} invalid={!!errors.buyPrice} placeholder="2450.00" inputMode="decimal" className="no-spin" onChange={(e) => setBuyPrice(e.target.value)} />}
                </Field>
              </div>
              <Button onClick={onCheck} loading={checking} size="lg" className="w-full">
                {checking ? "Checking…" : "Run monitoring check"} {!checking && <Play className="h-4 w-4" />}
              </Button>
            </CardBody>
          </Card>

          <Card className="bg-slate-50/60">
            <CardBody className="flex gap-3 text-[13px] leading-relaxed text-slate-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>
                The current backend supports on-demand checks and sweeps only — there are no endpoints yet for saving
                monitoring rules (thresholds, schedules). When those endpoints arrive, rule management will slot in here
                without changing your data flow.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Check result */}
          <Card>
            <CardHeader
              title="Check status"
              subtitle={checkTime ? `Last run ${formatDateTime(checkTime)}` : "Results of your most recent targeted check"}
              icon={<Activity className="h-4 w-4" />}
              actions={status && <Badge tone={status.kind === "triggered" ? "rose" : status.kind === "clear" ? "emerald" : "slate"}>{status.kind === "triggered" ? "Flagged" : status.kind === "clear" ? "Clear" : "Done"}</Badge>}
            />
            <CardBody className="space-y-4">
              {checking ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-6 text-sm text-slate-500">
                  <RefreshCcw className="h-4 w-4 animate-spin text-emerald-500" />
                  Evaluating {symbol.trim().toUpperCase() || "holding"} against monitoring rules…
                </div>
              ) : status ? (
                <>
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-4 py-3.5",
                      status.kind === "triggered" ? "border-rose-200 bg-rose-50/70" : status.kind === "clear" ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50/60",
                    )}
                  >
                    {status.kind === "triggered" ? (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                    ) : (
                      <CheckCircle2 className={cn("mt-0.5 h-5 w-5 shrink-0", status.kind === "clear" ? "text-emerald-500" : "text-slate-400")} />
                    )}
                    <div>
                      <p className={cn("text-sm font-semibold", status.kind === "triggered" ? "text-rose-700" : status.kind === "clear" ? "text-emerald-700" : "text-slate-700")}>
                        {status.label}
                      </p>
                      {status.detail && <p className="mt-0.5 text-[13px] text-slate-600">{status.detail}</p>}
                    </div>
                  </div>
                  <ResultView data={checkResult} currency={detectCurrency(checkResult, currency)} />
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
                  <Radar className="h-5 w-5 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">No check run yet</p>
                  <p className="max-w-sm text-[13px] text-slate-500">
                    Enter a holding on the left and run a check to see live monitoring output here.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Sweep result */}
          {(sweeping || sweepResult !== null) && (
            <Card className="animate-fade-up">
              <CardHeader title="Sweep output" subtitle="Response from the backend's monitoring run" icon={<Zap className="h-4 w-4" />} />
              <CardBody>
                {sweeping ? (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-6 text-sm text-slate-500">
                    <RefreshCcw className="h-4 w-4 animate-spin text-emerald-500" />
                    Running the full monitoring pass…
                  </div>
                ) : (
                  <ResultView data={sweepResult} currency={detectCurrency(sweepResult, currency)} />
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={sweepOpen}
        onClose={() => setSweepOpen(false)}
        onConfirm={onSweep}
        loading={sweeping}
        title="Run full monitoring sweep?"
        message={
          clientId.trim()
            ? `This asks the backend to execute its complete monitoring pass for client "${clientId.trim()}". Depending on your setup this may generate alerts.`
            : "This asks the backend to execute its complete monitoring pass. Depending on your setup this may generate alerts. Enter a client ID to scope it to one portfolio."
        }
        confirmLabel="Run sweep"
      />
    </div>
  );
}
