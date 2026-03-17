"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Send, Twitter } from "lucide-react";

const NAV_LINKS = [
  { href: "/",          label: "Home" },
  { href: "/terminal",  label: "Terminal" },
  { href: "/news",      label: "News" },
  { href: "/screener",  label: "Screener" },
  { href: "/calendar",  label: "Calendar" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[rgba(59,130,246,0.15)] bg-[#0d0e11]/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center font-mono text-[15px] font-bold tracking-wider"
          >
            <span className="text-[#e2e4ea]">TRADER</span>
            <span className="text-[#3b82f6]">BROSS</span>
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
                      ? "border-b border-[#3b82f6] pb-0.5 text-[#3b82f6]"
                      : "text-[#8b95a5] hover:text-[#e2e4ea]"
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
              href="https://t.me/traderbross"
              target="_blank"
              rel="noreferrer"
              className="hidden text-[#555d6e] transition-colors hover:text-[#3b82f6] md:flex"
              aria-label="Telegram"
            >
              <Send size={16} />
            </a>
            <a
              href="https://x.com/traderbross"
              target="_blank"
              rel="noreferrer"
              className="hidden text-[#555d6e] transition-colors hover:text-[#e2e4ea] md:flex"
              aria-label="Twitter / X"
            >
              <Twitter size={16} />
            </a>
            <button
              onClick={() => setOpen(!open)}
              className="flex h-8 w-8 items-center justify-center text-[#8b95a5] md:hidden"
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
              className="fixed left-0 right-0 top-12 z-50 border-b border-[rgba(59,130,246,0.15)] bg-[#0d0e11] px-4 py-4 md:hidden"
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
                          ? "bg-[rgba(59,130,246,0.12)] text-[#3b82f6]"
                          : "text-[#8b95a5] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#e2e4ea]"
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-4 flex items-center gap-4 border-t border-[rgba(59,130,246,0.1)] pt-4">
                <a
                  href="https://t.me/traderbross"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[12px] text-[#555d6e] hover:text-[#8b95a5] transition-colors"
                >
                  <Send size={14} /> Telegram
                </a>
                <a
                  href="https://x.com/traderbross"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-[12px] text-[#555d6e] hover:text-[#8b95a5] transition-colors"
                >
                  <Twitter size={14} /> Twitter
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
