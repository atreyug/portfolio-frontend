import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Bell,
  CandlestickChart,
  ChevronDown,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { useSessionData } from "@/context/SessionDataContext";
import { getAlerts } from "@/services/alerts";
import { findRecordsArray } from "@/utils/payload";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/analysis/stocks", label: "Stock analysis", icon: CandlestickChart },
  { to: "/app/analysis/mutual-funds", label: "Mutual funds & SIP", icon: Landmark },
  { to: "/app/monitoring", label: "Monitoring", icon: Activity },
  { to: "/app/alerts", label: "Alerts", icon: Bell },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

const TITLES: Array<[RegExp, string]> = [
  [/^\/app$/, "Overview"],
  [/^\/app\/analysis\/stocks/, "Stock portfolio analysis"],
  [/^\/app\/analysis\/mutual-funds/, "Mutual fund & SIP analysis"],
  [/^\/app\/monitoring/, "Portfolio monitoring"],
  [/^\/app\/alerts/, "Alerts center"],
  [/^\/app\/settings/, "Profile & settings"],
];

function managerEmail(manager: Record<string, unknown> | null): string {
  const v = manager?.email;
  return typeof v === "string" ? v : "Account";
}

function managerDisplayName(manager: Record<string, unknown> | null): string {
  const full = manager?.full_name ?? manager?.name;
  if (typeof full === "string" && full.trim()) return full.trim();
  const email = managerEmail(manager);
  return email.includes("@") ? email.split("@")[0] : email;
}

function SidebarContent({ unread, onNavigate }: { unread: number | null; onNavigate?: () => void }) {
  const { manager, logout } = useAuth();
  const { clearAll } = useSessionData();
  const navigate = useNavigate();
  const name = managerDisplayName(manager);
  const email = managerEmail(manager);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-white/[0.06] px-5">
        <Logo dark to="/app" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                isActive ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-emerald-400" />}
                <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300")} />
                <span className="flex-1">{item.label}</span>
                {item.to === "/app/alerts" && unread !== null && unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-bold text-emerald-400 ring-1 ring-emerald-500/25">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-[13px] font-bold text-white">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{name}</p>
            <p className="truncate text-[11px] text-slate-500">{email}</p>
          </div>
          <button
            onClick={() => {
              clearAll();
              logout();
              navigate("/login");
            }}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 px-2 pb-1 text-[10px] leading-relaxed text-slate-600">
          Session data stays in memory and is cleared on sign-out.
        </p>
      </div>
    </div>
  );
}

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState<number | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { manager, logout } = useAuth();
  const { clearAll } = useSessionData();
  const menuRef = useRef<HTMLDivElement>(null);

  const title = useMemo(() => TITLES.find(([re]) => re.test(location.pathname))?.[1] ?? "Workspace", [location.pathname]);

  const refreshUnread = useCallback(async () => {
    try {
      const data = await getAlerts(true);
      const recs = Array.isArray(data) ? data.filter((x) => typeof x === "object" && x !== null) : findRecordsArray(data, ["alerts", "items", "results"]) ?? [];
      setUnread(recs.length);
    } catch {
      setUnread(null);
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread, location.pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const name = managerDisplayName(manager);
  const email = managerEmail(manager);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] bg-navy-950 lg:block">
        <SidebarContent unread={unread} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-navy-950/60 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] animate-fade-in bg-navy-950 shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent unread={unread} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[268px]">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{title}</p>
          </div>

          <button
            onClick={() => navigate("/app/alerts")}
            className="relative rounded-lg p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Open alerts"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread !== null && unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 transition hover:bg-slate-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", userMenuOpen && "rotate-180")} />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 origin-top-right animate-scale-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/5">
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <p className="truncate text-[13px] font-semibold text-slate-900">{name}</p>
                  <p className="truncate text-xs text-slate-500">{email}</p>
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/app/settings");
                  }}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  <Settings className="h-4 w-4 text-slate-400" /> Profile & settings
                </button>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    clearAll();
                    logout();
                    navigate("/login");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
