"use client";

import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";

export default function LanguageDock() {
  return (
    <div className="fixed right-3 top-3 z-[70]">
      <LanguageSwitcher compact />
    </div>
  );
}

