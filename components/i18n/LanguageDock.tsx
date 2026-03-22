"use client";
// mobile: hidden, desktop: visible

import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

export default function LanguageDock() {
  const pathname = usePathname();
  if (pathname?.startsWith("/terminal")) return null;

  return (
    <div className="fixed right-3 top-3 z-[70] hidden md:block">
      <LanguageSwitcher compact />
    </div>
  );
}
