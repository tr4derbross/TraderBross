import Link from "next/link";
import { Send, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-[rgba(59,130,246,0.12)] bg-[#0d0e11]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-mono text-[14px] font-bold">
              <span className="text-[#e2e4ea]">TRADER</span>
              <span className="text-[#3b82f6]">BROSS</span>
            </div>
            <p className="mt-1 text-[11px] text-[#555d6e]">
              News-first crypto trading terminal
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:items-end">
            <div className="flex items-center gap-4">
              <a
                href="https://x.com/traderbross"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-[#555d6e] transition-colors hover:text-[#8b95a5]"
              >
                <Twitter size={13} /> X
              </a>
              <a
                href="https://t.me/traderbross"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-[#555d6e] transition-colors hover:text-[#8b95a5]"
              >
                <Send size={13} /> Telegram
              </a>
              <Link
                href="/privacy"
                className="text-[11px] text-[#555d6e] hover:text-[#8b95a5] transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-[11px] text-[#555d6e] hover:text-[#8b95a5] transition-colors"
              >
                Terms
              </Link>
            </div>
            <p className="text-[11px] text-[#3a4050]">
              <a
                href="mailto:hello@traderbross.com"
                className="hover:text-[#555d6e] transition-colors"
              >
                hello@traderbross.com
              </a>
              {" · "}© 2026 TraderBross
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
