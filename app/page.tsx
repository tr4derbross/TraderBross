import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { ArrowUpRight, Newspaper, Zap, LayoutDashboard, Send, Shield, LineChart } from "lucide-react";

const featureCards = [
  {
    title: "Real-time News Workspace",
    text: "Track breaking crypto headlines, source quality, sentiment context, and symbol-linked market reaction in one place.",
    icon: Newspaper,
  },
  {
    title: "Fast Execution Workflow",
    text: "Move from news to chart to execution without leaving the terminal, with integrated TP and SL management.",
    icon: Zap,
  },
  {
    title: "Strategy Workspace",
    text: "Use a focused multi-panel layout built for active traders who need flow, structure, and speed.",
    icon: LayoutDashboard,
  },
];

const footerLinks = [
  { label: "X", href: "https://x.com/traderbross" },
  { label: "Telegram", href: "https://t.me/traderbross" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "mailto:Nikokaya24@gmail.com" },
];

export default function HomePage() {
  return (
    <main className="landing-shell min-h-screen text-[var(--text-primary)]">
      <section className="mx-auto flex w-full max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:px-10">
        <header className="landing-topbar panel-shell flex flex-col gap-4 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-auto w-[138px] sm:w-[160px]" />
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase tracking-[0.28em] text-amber-200/80">TraderBross</div>
              <div className="text-[11px] text-zinc-500">Professional crypto news trading terminal</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://t.me/traderbross"
              target="_blank"
              rel="noreferrer"
              className="brand-badge hidden rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-200 sm:inline-flex"
            >
              Telegram
            </a>
            <a
              href="https://x.com/traderbross"
              target="_blank"
              rel="noreferrer"
              className="brand-badge hidden rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-200 sm:inline-flex"
            >
              X
            </a>
            <Link
              href="/terminal"
              className="brand-chip-active inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em]"
            >
              Open Terminal
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10 lg:py-12">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[rgba(212,161,31,0.16)] bg-[rgba(212,161,31,0.08)] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-amber-200">
              <Shield className="h-3.5 w-3.5" />
              News-first trading workflow
            </div>
            <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.04em] text-[#f8f3e5] sm:text-5xl lg:text-6xl">
              Trade the news faster
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
              TraderBross is a crypto news trading terminal built for traders who want to move from
              headline to chart to execution with less noise and more structure.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/terminal"
                className="brand-chip-active inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em]"
              >
                Open Terminal
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a
                href="https://t.me/traderbross"
                target="_blank"
                rel="noreferrer"
                className="terminal-chip inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-100"
              >
                Join Telegram
                <Send className="h-4 w-4" />
              </a>
              <a
                href="https://x.com/traderbross"
                target="_blank"
                rel="noreferrer"
                className="terminal-chip inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-100"
              >
                Follow on X
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="landing-hero-card panel-shell relative overflow-hidden rounded-[24px] border p-4 sm:rounded-[28px] sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,161,31,0.15),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(245,239,225,0.06),transparent_32%)]" />
            <div className="relative z-10 grid gap-3 sm:grid-cols-2">
              <div className="panel-shell-alt rounded-2xl p-4">
                <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-amber-200">Signal flow</div>
                <p className="text-sm leading-6 text-zinc-200">
                  News, funding, watchlists, and execution controls aligned in one continuous workflow.
                </p>
              </div>
              <div className="panel-shell-alt rounded-2xl p-4">
                <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-amber-200">Built for speed</div>
                <p className="text-sm leading-6 text-zinc-200">
                  Route directly from information to action without switching between disconnected tools.
                </p>
              </div>
            </div>
            <div className="relative z-10 mt-4 flex items-center justify-between rounded-2xl border border-[rgba(212,161,31,0.12)] bg-black/20 px-4 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Workspace mode</div>
                <div className="mt-1 text-sm font-semibold text-[#f8f3e5]">News-driven crypto terminal</div>
              </div>
              <LineChart className="h-7 w-7 text-amber-200" />
            </div>
          </div>
        </section>

        <section className="grid gap-4 py-4 md:grid-cols-3">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="panel-shell-alt rounded-2xl p-5">
                <div className="mb-4 inline-flex rounded-xl border border-[rgba(212,161,31,0.16)] bg-[rgba(212,161,31,0.08)] p-2">
                  <Icon className="h-4 w-4 text-amber-200" />
                </div>
                <h2 className="text-lg font-semibold text-[#f6f0e2]">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{feature.text}</p>
              </article>
            );
          })}
        </section>

        <section className="py-8 sm:py-10">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200">Terminal preview</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#f8f3e5]">
                A premium workspace for reaction trading
              </h2>
            </div>
            <Link
              href="/terminal"
              className="brand-badge hidden rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-100 md:inline-flex"
            >
              Enter terminal
            </Link>
          </div>

          <div className="landing-preview panel-shell overflow-hidden rounded-[24px] border p-2.5 sm:rounded-[30px] sm:p-4">
            <div className="landing-preview-shell rounded-[24px] border border-[rgba(212,161,31,0.14)] bg-[linear-gradient(180deg,rgba(18,16,12,0.96),rgba(6,6,6,0.98))] p-3">
              <div className="mb-3 flex items-center justify-between rounded-2xl border border-[rgba(212,161,31,0.1)] bg-black/20 px-4 py-2">
                <div className="text-[10px] uppercase tracking-[0.26em] text-amber-200">TraderBross terminal</div>
                <div className="rounded-full border border-[rgba(212,161,31,0.16)] bg-[rgba(212,161,31,0.08)] px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-zinc-200">
                  Live workspace
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[0.34fr_0.66fr] xl:grid-cols-[0.28fr_0.5fr_0.22fr]">
                <div className="panel-shell-alt rounded-2xl p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.22em] text-amber-200">News feed</span>
                    <span className="text-[10px] text-zinc-500">Realtime</span>
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((item) => (
                      <div key={item} className="rounded-xl border border-[rgba(212,161,31,0.08)] bg-black/20 p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="brand-badge brand-badge-gold rounded-full px-2 py-0.5 text-[9px]">
                            BTC
                          </span>
                          <span className="brand-badge rounded-full px-2 py-0.5 text-[9px]">Watch</span>
                        </div>
                        <div className="h-2.5 w-[88%] rounded-full bg-white/8" />
                        <div className="mt-2 h-2.5 w-[72%] rounded-full bg-white/6" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel-shell-alt rounded-2xl p-3 md:col-span-1">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.22em] text-amber-200">Chart workspace</span>
                    <span className="rounded-full border border-[rgba(212,161,31,0.12)] px-2 py-0.5 text-[9px] text-zinc-300">
                      BTCUSDT
                    </span>
                  </div>
                  <div className="relative h-[260px] overflow-hidden rounded-[22px] border border-[rgba(212,161,31,0.08)] bg-[linear-gradient(180deg,#0a0a0b,#050505)] sm:h-[320px] lg:h-[360px]">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] opacity-30" />
                    <div className="absolute left-0 right-0 top-10 mx-6 h-px border-t border-dashed border-red-300/40" />
                    <div className="absolute left-0 right-0 top-28 mx-6 h-px border-t border-dashed border-emerald-300/40" />
                    <div className="absolute bottom-0 left-0 right-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(212,161,31,0.06))]" />
                    <svg viewBox="0 0 100 40" className="absolute inset-x-6 top-14 h-[200px] w-[calc(100%-3rem)]">
                      <polyline
                        fill="none"
                        stroke="rgba(240,215,167,0.92)"
                        strokeWidth="1.2"
                        points="0,28 8,26 15,27 22,22 30,24 38,18 46,20 54,14 62,16 70,10 78,15 86,12 94,6 100,9"
                      />
                    </svg>
                    <div className="absolute bottom-4 left-4 rounded-xl border border-[rgba(212,161,31,0.16)] bg-black/40 px-3 py-2 text-[10px] text-zinc-300">
                      Entry, TP, SL overlays stay visible in the execution workflow.
                    </div>
                  </div>
                </div>

                <div className="panel-shell-alt rounded-2xl p-3 md:col-span-2 xl:col-span-1">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.22em] text-amber-200">Execution</span>
                    <span className="text-[10px] text-zinc-500">Ready</span>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[rgba(212,161,31,0.1)] bg-black/20 p-3">
                      <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Order mode</div>
                      <div className="grid grid-cols-3 gap-1">
                        {["Market", "Limit", "Stop"].map((item, index) => (
                          <div
                            key={item}
                            className={`rounded-lg px-2 py-2 text-center text-[10px] ${
                              index === 0 ? "bg-[rgba(212,161,31,0.18)] text-amber-100" : "bg-white/[0.03] text-zinc-400"
                            }`}
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[rgba(212,161,31,0.1)] bg-black/20 p-3">
                      <div className="mb-2 h-2.5 w-20 rounded-full bg-white/8" />
                      <div className="h-10 rounded-xl border border-[rgba(212,161,31,0.1)] bg-white/[0.03]" />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="h-10 rounded-xl bg-[linear-gradient(180deg,#157a5d,#0e5f48)]" />
                        <div className="h-10 rounded-xl bg-[linear-gradient(180deg,#942e2e,#6e2020)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 py-8 lg:grid-cols-[0.95fr_1.05fr] lg:py-10">
          <div className="panel-shell-alt rounded-3xl p-6">
            <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200">Why TraderBross</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#f8f3e5]">
              Built for traders who react to information first
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="panel-shell-alt rounded-2xl p-5">
              <h3 className="text-lg font-semibold text-[#f5efe1]">News trading terminal</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Follow source quality, breaking developments, social flow, and token-linked headlines
                without losing chart context.
              </p>
            </div>
            <div className="panel-shell-alt rounded-2xl p-5">
              <h3 className="text-lg font-semibold text-[#f5efe1]">Advanced strategy workspace</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Keep watchlists, execution logic, TP and SL controls, and venue awareness inside a
                single structured interface.
              </p>
            </div>
          </div>
        </section>

        <section className="panel-shell landing-cta overflow-hidden rounded-[24px] border px-5 py-7 sm:rounded-[30px] sm:px-8 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200">Get started</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#f8f3e5]">
                Open the terminal and trade the flow with more structure
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
                Enter the full TraderBross workspace or join the community channels for updates,
                releases, and trading workflow improvements.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/terminal"
                className="brand-chip-active inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em]"
              >
                Open Terminal
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <a
                href="https://t.me/traderbross"
                target="_blank"
                rel="noreferrer"
                className="terminal-chip inline-flex items-center justify-center rounded-xl px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-100"
              >
                Join Telegram
              </a>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-auto w-[110px]" />
            <span className="hidden sm:inline">Trade the news faster.</span>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {footerLinks.map((link) =>
              link.href.startsWith("/") ? (
                <Link key={link.label} href={link.href} className="transition-colors hover:text-zinc-200">
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.href.startsWith("http") ? "_blank" : undefined}
                  rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                  className="transition-colors hover:text-zinc-200"
                >
                  {link.label}
                </a>
              )
            )}
          </nav>
        </footer>
      </section>
    </main>
  );
}
