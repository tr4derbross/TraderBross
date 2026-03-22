"use client";

import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/components/i18n/LanguageProvider";

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, dict } = useI18n();

  const labelMap: Record<Locale, string> = {
    en: dict.language.en,
    tr: dict.language.tr,
    de: dict.language.de,
    zh: dict.language.zh,
  };

  return (
    <div className={`flex items-center gap-1 rounded-md border border-white/10 ${compact ? "px-1 py-0.5" : "px-2 py-1"}`}>
      {!compact && <span className="text-[10px] text-zinc-500">{dict.language.label}</span>}
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="bg-transparent text-[10px] text-zinc-300 outline-none"
      >
        {SUPPORTED_LOCALES.map((item) => (
          <option key={item} value={item} className="bg-zinc-900 text-zinc-100">
            {labelMap[item]}
          </option>
        ))}
      </select>
    </div>
  );
}

