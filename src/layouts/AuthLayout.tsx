import { Navigate, Outlet } from "react-router-dom";
import { ShieldCheck, Sparkles, Database } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { PageLoader } from "@/components/ui/Skeleton";

const POINTS = [
  {
    icon: Sparkles,
    title: "AI-generated insights",
    text: "Valuation, risk observations and review suggestions for stocks, mutual funds and SIPs.",
  },
  {
    icon: Database,
    title: "No persistent portfolio storage",
    text: "Raw holdings are submitted per-request and are not persistently stored by the backend.",
  },
  {
    icon: ShieldCheck,
    title: "Session-safe by design",
    text: "Portfolio payloads live in memory only and are cleared the moment you sign out.",
  },
];

export function AuthLayout() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950">
        <PageLoader label="Preparing your workspace…" />
      </div>
    );
  }
  if (status === "authenticated") {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <aside className="relative hidden w-[44%] overflow-hidden bg-navy-950 lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 15% 0%, rgba(16,185,129,0.18) 0%, transparent 60%), radial-gradient(40% 40% at 100% 100%, rgba(14,165,233,0.12) 0%, transparent 60%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.14) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative z-10 flex h-full flex-col p-10 xl:p-14">
          <Logo dark to="/" />
          <div className="mt-auto max-w-md">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400">Privacy-first intelligence</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
              Understand your portfolio. Keep your data yours.
            </h2>
            <div className="mt-10 space-y-6">
              {POINTS.map((point) => (
                <div key={point.title} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-emerald-400 ring-1 ring-white/10">
                    <point.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{point.title}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{point.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="relative z-10 mt-12 text-xs text-slate-500">
            Meridian provides analytics, not investment advice. Figures are informational estimates.
          </p>
        </div>
      </aside>

      {/* Form side */}
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center bg-slate-50 p-6">
        <div className="mb-8 lg:hidden">
          <Logo to="/" />
        </div>
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
