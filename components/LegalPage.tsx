import Link from "next/link";
import BrandMark from "@/components/BrandMark";

type LegalPageProps = {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
};

export default function LegalPage({ title, effectiveDate, children }: LegalPageProps) {
  return (
    <main className="landing-shell min-h-screen text-[var(--text-primary)]">
      <section className="mx-auto flex w-full max-w-4xl flex-col px-5 pb-12 pt-6 sm:px-8 lg:px-10">
        <header className="landing-topbar panel-shell flex items-center justify-between rounded-2xl border px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark className="h-auto w-[138px] sm:w-[160px]" />
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase tracking-[0.28em] text-amber-200/80">TraderBross</div>
              <div className="text-[11px] text-zinc-500">Legal and policy information</div>
            </div>
          </div>

          <Link
            href="/terminal"
            className="brand-chip-active inline-flex items-center justify-center rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em]"
          >
            Open Terminal
          </Link>
        </header>

        <article className="panel-shell mt-8 rounded-[28px] border p-6 sm:p-8">
          <div className="mb-8 border-b border-[rgba(212,161,31,0.1)] pb-6">
            <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200">TraderBross</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#f8f3e5]">{title}</h1>
            <p className="mt-3 text-sm text-zinc-500">Effective date: {effectiveDate}</p>
          </div>

          <div className="legal-content space-y-8 text-[15px] leading-8 text-[var(--text-secondary)]">
            {children}
          </div>
        </article>
      </section>
    </main>
  );
}
