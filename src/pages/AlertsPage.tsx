import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Check, ChevronDown, Filter, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, severityTone } from "@/components/ui/Badge";
import { EmptyState, InlineError } from "@/components/ui/EmptyState";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/context/ToastContext";
import { getAlerts, markAlertRead } from "@/services/alerts";
import { normalizeApiError } from "@/services/client";
import { normalizeAlerts, type AlertView } from "@/utils/alerts";
import { timeAgo } from "@/utils/format";
import { cn } from "@/utils/cn";

const PAGE_SIZE = 25;

function AlertCard({ alert, onMarkedRead }: { alert: AlertView; onMarkedRead: (id: string | number) => void }) {
  const toast = useToast();
  const [marking, setMarking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const unread = alert.read === false;
  const extraKeys = Object.keys(alert.raw).length;

  const markRead = async () => {
    if (alert.id === undefined || marking) return;
    setMarking(true);
    try {
      await markAlertRead(alert.id);
      onMarkedRead(alert.id);
      toast.success("Marked as read");
    } catch (err) {
      toast.error("Could not update alert", normalizeApiError(err).message);
    } finally {
      setMarking(false);
    }
  };

  return (
    <Card className={cn("transition", unread && "border-l-[3px] border-l-emerald-500")}>
      <CardBody className="py-4">
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
              {
                rose: "bg-rose-50 text-rose-500 ring-rose-600/15",
                amber: "bg-amber-50 text-amber-500 ring-amber-600/15",
                sky: "bg-sky-50 text-sky-500 ring-sky-600/15",
                emerald: "bg-emerald-50 text-emerald-500 ring-emerald-600/15",
                slate: "bg-slate-100 text-slate-400 ring-slate-500/10",
                violet: "bg-violet-50 text-violet-500 ring-violet-600/15",
              }[severityTone(alert.severity)],
            )}
          >
            <Bell className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">{alert.title}</h3>
              {alert.severity && <Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge>}
              {alert.symbol && <Badge>{alert.symbol}</Badge>}
              {unread && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Unread
                </span>
              )}
            </div>
            {alert.message && <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{alert.message}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
              {alert.timestamp && <span title={alert.timestamp}>{timeAgo(alert.timestamp)}</span>}
              {alert.id !== undefined && <span className="font-mono">#{String(alert.id)}</span>}
              {extraKeys > 0 && (
                <button onClick={() => setExpanded((e) => !e)} className="inline-flex items-center gap-1 font-medium text-slate-500 transition hover:text-slate-700">
                  Raw fields <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
                </button>
              )}
            </div>
            {expanded && (
              <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-navy-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-100/90">
                {JSON.stringify(alert.raw, null, 2)}
              </pre>
            )}
          </div>
          {alert.id !== undefined && alert.read !== true && (
            <Button variant="secondary" size="sm" onClick={markRead} loading={marking} className="shrink-0">
              <Check className="h-3.5 w-3.5" /> Mark read
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export function AlertsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [alerts, setAlerts] = useState<AlertView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const load = useCallback(async (unread: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAlerts(unread);
      setAlerts(normalizeAlerts(data));
      setVisible(PAGE_SIZE);
    } catch (err) {
      setError(normalizeApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(unreadOnly);
  }, [load, unreadOnly]);

  const onMarkedRead = useCallback(
    (id: string | number) => {
      setAlerts((prev) => {
        if (!prev) return prev;
        const next = prev.map((a) => (a.id === id ? { ...a, read: true } : a));
        return unreadOnly ? next.filter((a) => a.id !== id) : next;
      });
    },
    [unreadOnly],
  );

  const unreadCount = useMemo(() => alerts?.filter((a) => a.read === false).length ?? null, [alerts]);
  const shown = alerts?.slice(0, visible) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts center"
        subtitle="Signals generated for your monitored holdings."
        actions={
          <>
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1">
              <Filter className="ml-2 h-3.5 w-3.5 text-slate-400" />
              {(
                [
                  [false, "All alerts"],
                  [true, "Unread only"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  onClick={() => setUnreadOnly(value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    unreadOnly === value ? "bg-navy-950 text-white" : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => load(unreadOnly)} loading={loading} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </>
        }
      />

      {!loading && alerts !== null && unreadCount !== null && unreadCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <Bell className="h-4 w-4" />
          You have <strong>{unreadCount}</strong> unread alert{unreadCount === 1 ? "" : "s"}
          {unreadOnly ? " shown below." : "."}
        </div>
      )}

      {loading ? (
        <CardListSkeleton count={4} />
      ) : error ? (
        <InlineError message={error} onRetry={() => load(unreadOnly)} />
      ) : alerts && shown.length > 0 ? (
        <div className="space-y-3">
          {shown.map((alert, i) => (
            <AlertCard key={alert.id ?? `alert-${i}`} alert={alert} onMarkedRead={onMarkedRead} />
          ))}
          {alerts.length > visible && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                <ChevronDown className="h-4 w-4" /> Load more ({alerts.length - visible} remaining)
              </Button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={unreadOnly ? BellOff : Bell}
          title={unreadOnly ? "No unread alerts" : "No alerts yet"}
          description={
            unreadOnly
              ? "Everything generated by monitoring has been read. Switch to “All alerts” to review history."
              : "Alerts appear after you run monitoring checks or a sweep. Head to Monitoring to run one now."
          }
        />
      )}
    </div>
  );
}
