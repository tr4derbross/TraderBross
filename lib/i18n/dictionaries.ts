import type { Locale } from "@/lib/i18n/config";

export type Dictionary = {
  language: {
    label: string;
    en: string;
    tr: string;
    de: string;
    zh: string;
  };
  nav: {
    home: string;
    terminal: string;
    news: string;
    screener: string;
    calendar: string;
    telegram: string;
    twitter: string;
  };
  footer: {
    tagline: string;
    privacy: string;
    terms: string;
    copyright: string;
  };
  landing: {
    badge: string;
    heroLine1: string;
    heroLine2: string;
    heroDesc: string;
    openTerminal: string;
    getAlerts: string;
    stats: Array<{ value: string; label: string }>;
    featuresTitle: string;
    featuresHeading: string;
    features: Array<{ title: string; desc: string }>;
    briefTitle: string;
    briefHeading: string;
    briefSub: string;
    openTerminalLive: string;
    ctaHeading: string;
    ctaPills: string[];
    ctaButton: string;
  };
  legal: {
    info: string;
    openTerminal: string;
    effectiveDate: string;
  };
};

const en: Dictionary = {
  language: {
    label: "Language",
    en: "English",
    tr: "Turkish",
    de: "German",
    zh: "Chinese",
  },
  nav: {
    home: "Home",
    terminal: "Terminal",
    news: "News",
    screener: "Screener",
    calendar: "Calendar",
    telegram: "Telegram",
    twitter: "Twitter",
  },
  footer: {
    tagline: "News-first crypto trading terminal",
    privacy: "Privacy",
    terms: "Terms",
    copyright: "© 2026 TraderBross",
  },
  landing: {
    badge: "Real-Time News Trading Terminal",
    heroLine1: "Trade Crypto News",
    heroLine2: "Before the Repricing",
    heroDesc:
      "Track breaking crypto news, get instant signal context, and execute trades from one terminal before momentum shifts.",
    openTerminal: "Open Live Terminal",
    getAlerts: "Get News Alerts",
    stats: [
      { value: "4", label: "Exchanges" },
      { value: "News+Signals", label: "Decision Flow" },
      { value: "Live", label: "Market Feed" },
      { value: "Free", label: "Access" },
    ],
    featuresTitle: "Features",
    featuresHeading: "Why Active Crypto Traders Use TraderBross",
    features: [
      {
        title: "Breaking News, Ranked Fast",
        desc: "See market-moving headlines in real time, ranked by relevance so you can react before momentum fades.",
      },
      {
        title: "Execution Across 4 Venues",
        desc: "Trade Hyperliquid, Binance, OKX, and Bybit from one terminal with the same workflow.",
      },
      {
        title: "Signal Context in Seconds",
        desc: "Turn raw headlines into clear market context, key risks, and actionable trade direction.",
      },
      {
        title: "Screener Built for Entries",
        desc: "Scan liquid pairs with RSI, open interest, long/short pressure, and volume to find setups faster.",
      },
      {
        title: "Risk Controls at Order Time",
        desc: "Set TP/SL, see risk-reward instantly, and keep liquidation visibility before you confirm the trade.",
      },
      {
        title: "Market Intelligence in One View",
        desc: "Track whales, sentiment, macro metrics, and flow signals without switching between tools.",
      },
    ],
    briefTitle: "Terminal Brief",
    briefHeading: "Fast Analysis You Can Trade On",
    briefSub: "Sample output — not live data",
    openTerminalLive: "Open Terminal and Test It Live",
    ctaHeading: "Turn Headlines Into Trades Faster",
    ctaPills: ["Live market feed", "Signal trade context", "4 exchanges"],
    ctaButton: "Start Trading Smarter",
  },
  legal: {
    info: "Legal and policy information",
    openTerminal: "Open Terminal",
    effectiveDate: "Effective date",
  },
};

const tr: Dictionary = {
  ...en,
  nav: {
    home: "Ana Sayfa",
    terminal: "Terminal",
    news: "Haberler",
    screener: "Tarayıcı",
    calendar: "Takvim",
    telegram: "Telegram",
    twitter: "Twitter",
  },
  footer: {
    tagline: "Haber odaklı kripto işlem terminali",
    privacy: "Gizlilik",
    terms: "Şartlar",
    copyright: "© 2026 TraderBross",
  },
  landing: {
    ...en.landing,
    badge: "Gerçek Zamanlı Haber İşlem Terminali",
    heroLine1: "Kripto Haberlerini",
    heroLine2: "Fiyatlanmadan Önce İşlemle",
    heroDesc:
      "Önemli kripto haberlerini takip et, hızlı piyasa bağlamı al ve momentum değişmeden işlemlerini terminalden yönet.",
    openTerminal: "Canlı Terminali Aç",
    getAlerts: "Haber Alarmı Al",
    featuresTitle: "Özellikler",
    featuresHeading: "Aktif Trader'lar Neden TraderBross Kullanıyor",
    briefTitle: "Terminal Özeti",
    briefHeading: "İşleme Dönüşen Hızlı Analiz",
    openTerminalLive: "Terminali Aç ve Canlı Dene",
    ctaHeading: "Manşetleri Daha Hızlı İşleme Çevir",
    ctaButton: "Daha Akıllı İşlem Yap",
  },
  legal: {
    info: "Yasal ve politika bilgileri",
    openTerminal: "Terminali Aç",
    effectiveDate: "Yürürlük tarihi",
  },
};

const de: Dictionary = {
  ...en,
  nav: {
    home: "Start",
    terminal: "Terminal",
    news: "News",
    screener: "Screener",
    calendar: "Kalender",
    telegram: "Telegram",
    twitter: "Twitter",
  },
  footer: {
    tagline: "News-first Krypto-Trading-Terminal",
    privacy: "Datenschutz",
    terms: "Nutzungsbedingungen",
    copyright: "© 2026 TraderBross",
  },
  landing: {
    ...en.landing,
    badge: "Echtzeit-News-Trading-Terminal",
    heroLine1: "Handle Krypto-News",
    heroLine2: "Vor der Neubewertung",
    heroDesc:
      "Verfolge marktbewegende Krypto-News, erhalte sofort Kontext und führe Trades aus einem Terminal aus.",
    openTerminal: "Live-Terminal öffnen",
    getAlerts: "News-Alerts erhalten",
    featuresTitle: "Funktionen",
    featuresHeading: "Warum aktive Trader TraderBross nutzen",
    briefTitle: "Terminal-Überblick",
    briefHeading: "Schnelle Analyse für klare Trades",
    openTerminalLive: "Terminal live testen",
    ctaHeading: "Mache aus Schlagzeilen schneller Trades",
    ctaButton: "Smarter traden",
  },
  legal: {
    info: "Rechtliche und Richtlinien-Informationen",
    openTerminal: "Terminal öffnen",
    effectiveDate: "Gültig ab",
  },
};

const zh: Dictionary = {
  ...en,
  nav: {
    home: "首页",
    terminal: "终端",
    news: "新闻",
    screener: "筛选器",
    calendar: "日历",
    telegram: "电报",
    twitter: "推特",
  },
  footer: {
    tagline: "以新闻为核心的加密交易终端",
    privacy: "隐私政策",
    terms: "服务条款",
    copyright: "© 2026 TraderBross",
  },
  landing: {
    ...en.landing,
    badge: "实时新闻交易终端",
    heroLine1: "交易加密新闻",
    heroLine2: "抢在重新定价之前",
    heroDesc: "追踪突发加密新闻，快速获得市场上下文，并在动量变化前完成交易。",
    openTerminal: "打开实时终端",
    getAlerts: "获取新闻提醒",
    featuresTitle: "功能",
    featuresHeading: "活跃交易者为何选择 TraderBross",
    briefTitle: "终端简报",
    briefHeading: "可直接执行的快速分析",
    openTerminalLive: "打开终端并实时测试",
    ctaHeading: "更快把新闻转化为交易",
    ctaButton: "开始更智能交易",
  },
  legal: {
    info: "法律与政策信息",
    openTerminal: "打开终端",
    effectiveDate: "生效日期",
  },
};

export const dictionaries: Record<Locale, Dictionary> = {
  en,
  tr,
  de,
  zh,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] || dictionaries.en;
}

