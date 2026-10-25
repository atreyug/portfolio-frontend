import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bell,
  CandlestickChart,
  CheckCircle2,
  Database,
  Landmark,
  Lock,
  Radar,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { ValueAreaChart } from "@/components/charts/ValueAreaChart";
import { useAuth } from "@/context/AuthContext";

const PREVIEW_SERIES = [
  { x: "Jan", y: 118000 },
  { x: "Feb", y: 124500 },
  { x: "Mar", y: 121200 },
  { x: "Apr", y: 131800 },
  { x: "May", y: 138400 },
  { x: "Jun", y: 136900 },
  { x: "Jul", y: 145700 },
  { x: "Aug", y: 152300 },
  { x: "Sep", y: 149800 },
  { x: "Oct", y: 161200 },
  { x: "Nov", y: 168500 },
  { x: "Dec", y: 174900 },
];

const FEATURES = [
  {
    icon: CandlestickChart,
    title: "Stock portfolio analysis",
    text: "Submit holdings with symbol, quantity and buy price to receive valuation, absolute and percentage returns, and holding-level breakdowns.",
  },
  {
    icon: Landmark,
    title: "Mutual fund & SIP intelligence",
    text: "Analyze individual schemes or project SIP futures — future value, required SIP, time to target and lumpsum growth.",
  },
  {
    icon: Radar,
    title: "Continuous monitoring",
    text: "Run targeted checks on a holding or sweep your watched portfolio to surface signals the moment conditions change.",
  },
  {
    icon: Bell,
    title: "Actionable alerts",
    text: "Severity-tagged alerts keep you ahead of material moves. Unread filtering and one-tap acknowledgement included.",
  },
  {
    icon: Sparkles,
    title: "AI-generated insight",
    text: "Every analysis returns machine-generated observations, risk notes and areas worth reviewing — clearly labelled as AI output.",
  },
  {
    icon: Lock,
    title: "Private by architecture",
    text: "Portfolio payloads travel per-request, stay in browser memory, and are never written to storage or third-party analytics.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Create your manager account",
    text: "Sign up with an email and password. Your profile is the only identity the platform keeps.",
  },
  {
    step: "02",
    title: "Enter holdings in your browser",
    text: "Type stock or mutual fund positions directly into the workspace — no file uploads, nothing retained client-side.",
  },
  {
    step: "03",
    title: "Get AI-powered analysis",
    text: "The backend computes valuation, returns, risk observations and news context, then answers in seconds.",
  },
  {
    step: "04",
    title: "Monitor and act on alerts",
    text: "Run checks on the holdings you care about and track every generated alert in one center.",
  },
];

const PRIVACY_POINTS = [
  {
    icon: Database,
    title: "No persistent raw storage",
    text: "The backend processes your holdings to compute results and does not persistently store the raw portfolio payload.",
  },
  {
    icon: Lock,
    title: "Memory-only session data",
    text: "Analyses you run live in application memory and are wiped on sign-out — never in localStorage, cookies or the URL.",
  },
  {
    icon: ShieldCheck,
    title: "No third-party trackers",
    text: "Portfolio details are never sent to analytics or advertising services. Authenticated endpoints only.",
  },
];

export function LandingPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const authed = status === "authenticated";

  const scrollTo = (id: string) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo to="/" />
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <button onClick={scrollTo("features")} className="transition hover:text-slate-900">Features</button>
            <button onClick={scrollTo("how-it-works")} className="transition hover:text-slate-900">How it works</button>
            <button onClick={scrollTo("privacy")} className="transition hover:text-slate-900">Privacy</button>
          </nav>
          <div className="flex items-center gap-2">
            {authed ? (
              <Button onClick={() => navigate("/app")}>
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/login")} className="hidden sm:inline-flex">
                  Sign in
                </Button>
                <Button onClick={() => navigate("/signup")}>
                  Get started <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 45% at 75% 10%, rgba(16,185,129,0.09) 0%, transparent 60%), radial-gradient(40% 35% at 10% 20%, rgba(14,165,233,0.07) 0%, transparent 60%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(226,232,240,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(226,232,240,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(70% 60% at 50% 30%, black 30%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(70% 60% at 50% 30%, black 30%, transparent 100%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-24">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Privacy-first AI portfolio intelligence
            </div>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl xl:text-[3.4rem]">
              Know what your portfolio is telling you —{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                without giving it away.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Meridian analyzes stock portfolios, mutual funds and SIPs, monitors the holdings you choose, and
              turns the results into clear, AI-generated observations. Raw portfolio data is processed per request —
              not persistently stored.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => navigate(authed ? "/app" : "/signup")}>
                {authed ? "Open dashboard" : "Get started free"} <ArrowRight className="h-4 w-4" />
              </Button>
              {!authed && (
                <Button size="lg" variant="secondary" onClick={() => navigate("/login")}>
                  Sign in
                </Button>
              )}
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-slate-200 pt-6">
              {[
                ["4", "Analysis workflows"],
                ["2", "Currencies — INR & USD"],
                ["0", "Trackers on your data"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-bold tracking-tight text-slate-900">{v}</dt>
                  <dd className="mt-1 text-xs font-medium text-slate-500">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Product preview (illustrative) */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/[0.08]">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-3 text-[11px] font-medium text-slate-400">meridian.app/overview</span>
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  Illustrative preview
                </span>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["Current value", "₹1.75L", "+18.2%", true],
                    ["Invested", "₹1.48L", "24 holdings", false],
                    ["Unread alerts", "3", "2 high priority", false],
                  ].map(([label, value, sub, accent]) => (
                    <div key={label as string} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                      <p className="mt-1 text-lg font-bold tracking-tight text-slate-900">{value}</p>
                      <p className={`mt-0.5 text-[11px] font-semibold ${accent ? "text-emerald-600" : "text-slate-400"}`}>{sub}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between px-1 pb-1">
                    <p className="text-xs font-semibold text-slate-700">Portfolio value</p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <TrendingUp className="h-3 w-3" /> Last 12 months
                    </span>
                  </div>
                  <ValueAreaChart data={PREVIEW_SERIES} currency="INR" height={170} />
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <p className="text-xs leading-relaxed text-slate-600">
                    <span className="font-semibold text-slate-800">AI observation:</span> allocation is concentrated in
                    banking — consider reviewing sector exposure. Demonstration text; real insights come from your data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-slate-100 bg-slate-50/60 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">Capabilities</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything between you and a clearer portfolio
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Four connected workflows — analysis, projection, monitoring and alerts — share one privacy-first pipeline.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="group rounded-2xl border border-slate-200/80 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-900/[0.04]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/10 transition group-hover:bg-emerald-100">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t border-slate-100 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-600">How it works</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              From holdings to insight in four steps
            </h2>
          </div>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.step} className="relative">
                {i < STEPS.length - 1 && (
                  <span className="absolute left-[calc(100%-8px)] top-6 hidden h-px w-8 bg-slate-200 lg:block" aria-hidden />
                )}
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-950 font-mono text-sm font-semibold text-emerald-400">
                  {s.step}
                </span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Privacy */}
      <section id="privacy" className="relative overflow-hidden bg-navy-950 py-20 lg:py-28">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(50% 60% at 20% 0%, rgba(16,185,129,0.14) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400">Privacy commitment</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Your holdings are inputs, not assets we keep
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Meridian was designed so that the most sensitive thing you own — your financial life — never becomes
              someone else's data set.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PRIVACY_POINTS.map((p) => (
              <article key={p.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                  <p.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-white">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-slate-500">
            {[
              "No Excel uploads required",
              "No portfolio data in URLs",
              "Access tokens held in memory",
              "Alerts fetched over authenticated calls only",
            ].map((t) => (
              <span key={t} className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-emerald-50/50 px-6 py-14 text-center sm:px-12">
            <h2 className="mx-auto max-w-xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Start understanding your portfolio today
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-slate-600">
              Create an account in under a minute. Your first analysis is a few keystrokes away.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" onClick={() => navigate(authed ? "/app" : "/signup")}>
                {authed ? "Open dashboard" : "Get started free"} <ArrowRight className="h-4 w-4" />
              </Button>
              {!authed && (
                <Button size="lg" variant="secondary" onClick={() => navigate("/login")}>
                  Sign in
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Privacy-first AI portfolio intelligence for stocks, mutual funds and SIP planning.
              </p>
              <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <Activity className="h-3.5 w-3.5" />
                Analytics and AI outputs are informational estimates — not investment advice.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:gap-16">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Product</p>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                  <li><button onClick={scrollTo("features")} className="transition hover:text-slate-900">Features</button></li>
                  <li><button onClick={scrollTo("how-it-works")} className="transition hover:text-slate-900">How it works</button></li>
                  <li><button onClick={scrollTo("privacy")} className="transition hover:text-slate-900">Privacy</button></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Account</p>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                  <li><Link to="/signup" className="transition hover:text-slate-900">Create account</Link></li>
                  <li><Link to="/login" className="transition hover:text-slate-900">Sign in</Link></li>
                  <li><Link to="/app" className="transition hover:text-slate-900">Dashboard</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} Meridian Portfolio AI. All rights reserved.</p>
            <p>Built for investors who value discretion.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
