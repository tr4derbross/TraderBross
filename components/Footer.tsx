"use client";

import Link from "next/link";
import { Send, Twitter } from "lucide-react";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function Footer() {
  const { dict } = useI18n();

  return (
    <footer className="border-t border-[#2A2A2A] bg-[#0B0B0B]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-mono text-[14px] font-bold">
              <span className="text-[#FFFFFF]">TRADER</span>
              <span className="text-[#F2B705]">BROSS</span>
            </div>
            <p className="mt-1 text-[11px] text-[#6B6B6B]">{dict.footer.tagline}</p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:items-end">
            <div className="flex items-center gap-4">
              <a
                href="https://x.com/traderbross"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B] transition-colors hover:text-[#F2B705]"
              >
                <Twitter size={13} /> {dict.nav.twitter}
              </a>
              <a
                href="https://t.me/traderbross"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B] transition-colors hover:text-[#F2B705]"
              >
                <Send size={13} /> {dict.nav.telegram}
              </a>
              <Link href="/privacy" className="text-[11px] text-[#6B6B6B] transition-colors hover:text-[#A0A0A0]">
                {dict.footer.privacy}
              </Link>
              <Link href="/terms" className="text-[11px] text-[#6B6B6B] transition-colors hover:text-[#A0A0A0]">
                {dict.footer.terms}
              </Link>
            </div>
            <p className="text-[11px] text-[#3A3A3A]">
              <a href="mailto:hello@traderbross.com" className="transition-colors hover:text-[#6B6B6B]">
                hello@traderbross.com
              </a>
              {" · "}
              {dict.footer.copyright}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
