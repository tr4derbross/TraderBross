"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Send, Twitter } from "lucide-react";
import { useI18n } from "@/components/i18n/LanguageProvider";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { dict } = useI18n();
  const NAV_LINKS = [
    { href: "/", label: dict.nav.home },
    { href: "/terminal", label: dict.nav.terminal },
    { href: "/news", label: dict.nav.news },
    { href: "/screener", label: dict.nav.screener },
    { href: "/calendar", label: dict.nav.calendar },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[#2A2A2A] bg-[#0B0B0B]/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center font-mono text-[15px] font-bold tracking-wider"
          >
            <span className="text-[#FFFFFF]">TRADER</span>
            <span className="text-[#F2B705]">BROSS</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map(({ href, label }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`text-[12px] font-medium tracking-wide transition-colors ${
                    active
                      ? "border-b border-[#F2B705] pb-0.5 text-[#F2B705]"
                      : "text-[#A0A0A0] hover:text-[#FFFFFF]"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right icons + mobile hamburger */}
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/+gmvsMPoWofA2ZjY0"
              target="_blank"
              rel="noreferrer"
              className="hidden text-[#6B6B6B] transition-colors hover:text-[#F2B705] md:flex"
              aria-label={dict.nav.telegram}
            >
              <Send size={16} />
            </a>
            <a
              href="https://x.com/traderbross"
              target="_blank"
              rel="noreferrer"
              className="hidden text-[#6B6B6B] transition-colors hover:text-[#FFFFFF] md:flex"
              aria-label={dict.nav.twitter}
            >
              <Twitter size={16} />
            </a>
            <button
              onClick={() => setOpen(!open)}
              className="flex h-8 w-8 items-center justify-center text-[#A0A0A0] md:hidden"
              aria-label="Menu"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="fixed left-0 right-0 top-12 z-50 border-b border-[#2A2A2A] bg-[#0B0B0B] px-4 py-4 md:hidden"
            >
              <nav className="flex flex-col gap-1">
                {NAV_LINKS.map(({ href, label }) => {
                  const active =
                    href === "/" ? pathname === "/" : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={`rounded-lg px-3 py-3 text-[13px] font-medium transition-colors ${
                        active
                          ? "bg-[rgba(242,183,5,0.1)] text-[#F2B705]"
                          : "text-[#A0A0A0] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#FFFFFF]"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-4 flex items-center gap-4 border-t border-[#2A2A2A] pt-4">
                <a
                  href="https://t.me/+gmvsMPoWofA2ZjY0"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[12px] text-[#6B6B6B] hover:text-[#A0A0A0] transition-colors"
                >
                  <Send size={14} /> {dict.nav.telegram}
                </a>
                <a
                  href="https://x.com/traderbross"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[12px] text-[#6B6B6B] hover:text-[#A0A0A0] transition-colors"
                >
                  <Twitter size={14} /> {dict.nav.twitter}
                </a>
                <div className="ml-auto">
                  <LanguageSwitcher />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
