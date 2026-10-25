import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bell,
  CandlestickChart,
  Landmark,
  RefreshCw,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, ChangePill, dotTone } from "@/components/ui/Badge";
import { EmptyState, InlineError } from "@/components/ui/EmptyState";
import { CardListSkeleton, StatCardSkeleton } from "@/components/ui/Skeleton";
import { AllocationDonut, type DonutItem } from "@/components/charts/AllocationDonut";
import { InsightCards } from "@/components/InsightCards";
import { useAuth } from "@/context/AuthContext";
import { useSessionData } from "@/context/SessionDataContext";
import { getAlerts } from "@/services/alerts";
import { normalizeApiError } from "@/services/client";
import { extractHoldings, extractInsights, extractTotals, detectCurrency, type HoldingRow } from "@/utils/payload";
import { normalizeAlerts, type AlertView } from "@/utils/alerts";
import { formatCurrency, timeAgo } from "@/utils/format";
import type { CurrencyCode } from "@/types/api";
import { cn } from "@/utils/cn";

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p
        className={cn(
          "mt-2 text-[22px] font-bold tracking-tight tabular-nums",
          tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-slate-900",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </Card>
  );
}

function PerformerList({ title, rows, currency, positive }: { title: string; rows: HoldingRow[]; currency: CurrencyCode; positive: boolean }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => Math.abs(r.pnl ?? 0)), 1);
  return (
    <div>
      <p className="mb-3 text-[13px] font-semibold text-slate-700">{title}</p>
      <ul className="space-y-3">
        {rows.map((row, i) => {
          const pnl = row.pnl ?? 0;
          return (
            <li key={`${row.name}-${i}`}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 flex-1 truncate font-medium text-slate-700" title={row.name}>{row.name}</span>
                <span className={cn("shrink-0 font-semibold tabular-nums", positive ? "text-emerald-600" : "text-rose-600")}>
                  {pnl !== 0 || row.pnl !== undefined ? formatCurrency(pnl, currency, { sign: true, compact: true }) : "—"}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn("h-full rounded-full", positive ? "bg-emerald-500/80" : "bg-rose-500/80")}
                  style={{ width: `${Math.min(100, (Math.abs(pnl) / max) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DashboardPage() {
  const { manager } = useAuth();
  const session = useSessionData();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<AlertView[] | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const data = await getAlerts(false);
      setAlerts(normalizeAlerts(data));
    } catch (err) {
      setAlertsError(normalizeApiError(err).message);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const latestAnalysis = session.stock ?? session.mutualFund ?? null;
  const totals = useMemo(() => (latestAnalysis ? extractTotals(latestAnalysis.response) : null), [latestAnalysis]);
  const holdings = useMemo(() => (latestAnalysis ? extractHoldings(latestAnalysis.response) : []), [latestAnalysis]);
  const currency: CurrencyCode = useMemo(
    () => (latestAnalysis ? detectCurrency(latestAnalysis.response, detectCurrency(latestAnalysis.request)) : "INR"),
    [latestAnalysis],
  );
  const insights = useMemo(() => {
    const groups = [
      ...(session.stock ? extractInsights(session.stock.response) : []),
      ...(session.mutualFund ? extractInsights(session.mutualFund.response) : []),
    ];
    return groups.slice(0, 4);
  }, [session.stock, session.mutualFund]);

  const donutItems: DonutItem[] = useMemo(() => {
    const withValue = holdings
      .map((h) => ({ name: h.name, value: h.current ?? h.invested ?? 0 }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
    const top = withValue.slice(0, 6);
    const rest = withValue.slice(6);
    if (rest.length) top.push({ name: `Other (${rest.length})`, value: rest.reduce((s, r) => s + r.value, 0) });
    return top;
  }, [holdings]);

  const sortedByPnl = useMemo(() => holdings.filter((h) => h.pnl !== undefined).sort((a, b) => (b.pnl ?? 0) - (a.pnl ?? 0)), [holdings]);
  const topPerformers = sortedByPnl.filter((h) => (h.pnl ?? 0) > 0).slice(0, 4);
  const underPerformers = [...sortedByPnl].reverse().filter((h) => (h.pnl ?? 0) < 0).slice(0, 4).reverse();

  const unreadCount = alerts?.filter((a) => a.read === false).length;
  const firstName = (() => {
    const full = manager?.full_name ?? manager?.name;
    if (typeof full === "string" && full.trim()) return full.trim().split(" ")[0];
    const email = typeof manager?.email === "string" ? manager.email : "";
    return email.includes("@") ? email.split("@")[0] : "there";
  })();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date())} — here is what your portfolio workspace looks like.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate("/app/monitoring")}>
            <Activity className="h-4 w-4" /> Run a check
          </Button>
          <Button size="sm" onClick={() => navigate("/app/analysis/stocks")}>
            <CandlestickChart className="h-4 w-4" /> Analyze stocks
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {alertsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              icon={Bell}
              label="Unread alerts"
              value={unreadCount === undefined ? "—" : String(unreadCount)}
              sub={unreadCount === undefined ? "Read status not provided" : unreadCount === 0 ? "You're all caught up" : "Needs your attention"}
            />
            <MetricCard
              icon={Bell}
              label="Total alerts"
              value={alerts ? String(alerts.length) : "—"}
              sub={alertsError ? "Could not load alerts" : "From your account"}
            />
          </>
        )}
        <MetricCard
          icon={Sparkles}
          label="Analyses this session"
          value={String(session.analysesRun)}
          sub="Held in memory only"
        />
        <MetricCard
          icon={Wallet}
          label="Holdings analyzed"
          value={totals?.holdingsCount !== undefined ? String(totals.holdingsCount) : "—"}
          sub={latestAnalysis ? `Updated ${timeAgo(latestAnalysis.at)}` : "Run an analysis to begin"}
        />
      </div>

      {/* Portfolio snapshot */}
      {totals && (totals.current !== undefined || totals.invested !== undefined) ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Portfolio snapshot"
              subtitle={`Derived from your latest ${latestAnalysis === session.stock ? "stock" : "mutual fund"} analysis · ${currency}`}
              icon={<Wallet className="h-4 w-4" />}
              actions={
                latestAnalysis === session.stock ? (
                  <Badge tone="emerald">Stocks</Badge>
                ) : (
                  <Badge tone="violet">Mutual funds</Badge>
                )
              }
            />
            <CardBody>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Invested</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{formatCurrency(totals.invested, currency, { compact: true })}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Current value</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{formatCurrency(totals.current, currency, { compact: true })}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Profit / loss</p>
                  <p className={cn("mt-1 text-lg font-bold tabular-nums", (totals.pnl ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {totals.pnl === undefined ? "—" : formatCurrency(totals.pnl, currency, { sign: true, compact: true })}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Return</p>
                  <div className="mt-1.5"><ChangePill value={totals.pct} /></div>
                </div>
              </div>
              <div className="mt-6 grid gap-8 md:grid-cols-2">
                <PerformerList title="Top performers" rows={topPerformers} currency={currency} positive />
                <PerformerList title="Needs attention" rows={underPerformers} currency={currency} positive={false} />
              </div>
              {topPerformers.length === 0 && underPerformers.length === 0 && (
                <p className="mt-4 text-xs text-slate-400">Per-holding P&L was not included in this response — open the analysis to view everything the backend returned.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Allocation" subtitle="By current holding value" />
            <CardBody>
              {donutItems.length > 0 ? (
                <AllocationDonut items={donutItems} currency={currency} centerLabel="Holdings" />
              ) : (
                <EmptyState compact icon={Wallet} title="No allocation data" description="Holding values were not present in the latest response." />
              )}
              <div className="mt-2 border-t border-slate-100 pt-4">
                <Button variant="secondary" size="sm" className="w-full" onClick={() => navigate(session.stock ? "/app/analysis/stocks" : "/app/analysis/mutual-funds")}>
                  Open full analysis <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="relative">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(45% 60% at 85% 20%, rgba(16,185,129,0.07) 0%, transparent 60%)" }}
            />
            <CardBody className="relative flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/15">
                <Sparkles className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">Run your first analysis</h3>
                <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
                  Enter stock or mutual fund holdings and Meridian will return valuation, returns, risk observations
                  and AI-generated insight. Results stay in memory — nothing is persisted here.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => navigate("/app/analysis/stocks")}>
                  <CandlestickChart className="h-4 w-4" /> Analyze stocks
                </Button>
                <Button variant="secondary" onClick={() => navigate("/app/analysis/mutual-funds")}>
                  <Landmark className="h-4 w-4" /> Analyze mutual funds
                </Button>
              </div>
            </CardBody>
          </div>
        </Card>
      )}

      {/* AI insights + recent alerts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="AI insight"
            subtitle="From your session analyses — interpretations, not advice"
            icon={<Sparkles className="h-4 w-4" />}
          />
          <CardBody>
            {insights.length > 0 ? (
              <InsightCards groups={insights} max={2} />
            ) : (
              <EmptyState
                compact
                icon={Sparkles}
                title="No AI insight yet"
                description="Insights appear here after you run a stock or mutual fund analysis."
                action={<Button size="sm" variant="secondary" onClick={() => navigate("/app/analysis/stocks")}>Run an analysis</Button>}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent alerts"
            subtitle="Latest signals generated by monitoring"
            icon={<Bell className="h-4 w-4" />}
            actions={
              <Button variant="ghost" size="sm" onClick={loadAlerts} loading={alertsLoading} aria-label="Refresh alerts">
                <RefreshCw className="h-4 w-4" />
              </Button>
            }
          />
          <CardBody>
            {alertsLoading ? (
              <CardListSkeleton count={3} />
            ) : alertsError ? (
              <InlineError message={alertsError} onRetry={loadAlerts} />
            ) : alerts && alerts.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {alerts.slice(0, 4).map((alert, i) => (
                  <li key={alert.id ?? i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotTone(alert.severity))} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-[13px] font-semibold text-slate-800">
                          {alert.title}
                          {alert.read === false && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />}
                        </p>
                        <span className="shrink-0 text-[11px] text-slate-400">{alert.timestamp ? timeAgo(alert.timestamp) : ""}</span>
                      </div>
                      {alert.message && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{alert.message}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={Bell}
                title="No alerts yet"
                description="When monitoring produces alerts, they'll show up here and in the alerts center."
                action={<Button size="sm" variant="secondary" onClick={() => navigate("/app/monitoring")}>Set up a check</Button>}
              />
            )}
            {alerts && alerts.length > 4 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <Button variant="secondary" size="sm" className="w-full" onClick={() => navigate("/app/alerts")}>
                  View all {alerts.length} alerts <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
