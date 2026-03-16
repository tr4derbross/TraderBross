"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { Send, LayoutDashboard, Newspaper, Home, BarChart2, Calendar } from "lucide-react";

const NAV_TABS = [
  { label: "Home",      href: "/",          icon: Home           },
  { label: "News",      href: "/news",       icon: Newspaper      },
  { label: "Terminal",  href: "/terminal",   icon: LayoutDashboard },
  { label: "Screener",  href: "/screener",   icon: BarChart2      },
  { label: "Calendar",  href: "/calendar",   icon: Calendar       },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[rgba(212,161,31,0.08)] bg-[rgba(7,6,10,0.92)] px-4 py-2.5 backdrop-blur-xl sm:px-6 lg:px-10">
      <div className="flex items-center gap-5">
        <Link href="/" className="shrink-0">
          <BrandMark className="h-auto w-[112px] sm:w-[128px]" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 sm:flex">
          {NAV_TABS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] transition-all duration-150 ${
                  active
                    ? "bg-[rgba(212,161,31,0.13)] text-amber-300"
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

      <div className="flex items-center gap-2">
        {/* Mobile nav */}
        <nav className="flex items-center gap-0.5 sm:hidden">
          {NAV_TABS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1 rounded-full px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] transition-all ${
                  active
                    ? "bg-[rgba(212,161,31,0.13)] text-amber-300"
                    : "text-zinc-600 hover:text-zinc-300"
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
          className="hidden items-center gap-1.5 rounded-full border border-[rgba(212,161,31,0.12)] bg-[rgba(212,161,31,0.05)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400 transition-all hover:border-[rgba(212,161,31,0.25)] hover:text-zinc-200 sm:inline-flex"
        >
          <Send className="h-3 w-3" />
          Telegram
        </a>
        <a
          href="https://x.com/traderbross"
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded-full border border-[rgba(212,161,31,0.12)] bg-[rgba(212,161,31,0.05)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-zinc-400 transition-all hover:border-[rgba(212,161,31,0.25)] hover:text-zinc-200 sm:inline-flex"
        >
          𝕏
        </a>
      </div>
    </header>
  );
}
