"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { Send, LayoutDashboard, Newspaper, Home } from "lucide-react";

const NAV_TABS = [
  { label: "Home",     href: "/",         icon: Home },
  { label: "News",     href: "/news",      icon: Newspaper },
  { label: "Terminal", href: "/terminal",  icon: LayoutDashboard },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[rgba(212,161,31,0.1)] bg-[rgba(7,6,10,0.88)] px-5 py-3 backdrop-blur-xl sm:px-8 lg:px-12">
      <div className="flex items-center gap-6">
        <Link href="/">
          <BrandMark className="h-auto w-[120px] sm:w-[136px]" />
        </Link>

        {/* Page tabs */}
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_TABS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${
                  active
                    ? "bg-[rgba(212,161,31,0.14)] text-amber-300"
                    : "text-zinc-500 hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-300"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Mobile tab bar (bottom of header) */}
      <div className="flex items-center gap-2">
        {/* Mobile nav tabs */}
        <nav className="flex items-center gap-1 sm:hidden">
          {NAV_TABS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] transition-all ${
                  active
                    ? "bg-[rgba(212,161,31,0.14)] text-amber-300"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden xs:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <a
          href="https://t.me/traderbross"
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded-full border border-[rgba(212,161,31,0.14)] bg-[rgba(212,161,31,0.06)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:text-zinc-100 sm:inline-flex"
        >
          <Send className="h-3 w-3" />
          Telegram
        </a>
        <a
          href="https://x.com/traderbross"
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded-full border border-[rgba(212,161,31,0.14)] bg-[rgba(212,161,31,0.06)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:text-zinc-100 sm:inline-flex"
        >
          𝕏
        </a>
      </div>
    </header>
  );
}
