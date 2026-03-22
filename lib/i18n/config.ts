export const SUPPORTED_LOCALES = ["en", "tr", "de", "zh"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE_KEY = "tb_locale";
export const LOCALE_STORAGE_KEY = "tb_locale";

export function normalizeLocale(value: string | null | undefined): Locale {
  const input = String(value || "").toLowerCase();
  if (input.startsWith("tr")) return "tr";
  if (input.startsWith("de")) return "de";
  if (input.startsWith("zh")) return "zh";
  return "en";
}

