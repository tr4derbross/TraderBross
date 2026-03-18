# TraderBross News System v2.0 — Audit Raporu

## Değişen/Oluşturulan Dosyalar

| Dosya | İşlem | Ajan |
|-------|-------|------|
| `types/news.ts` | Yeni | Agent 2 |
| `lib/telegram-scraper.ts` | Yeni | Agent 1 |
| `lib/rss-parser.ts` | Güncelleme | Agent 2 |
| `lib/news-sources.ts` | Güncelleme (legacy compat) | Agent 2 |
| `lib/news-aggregator.ts` | Yeni | Agent 2 |
| `lib/binance-liquidation-ws.ts` | Yeni | Agent 3 |
| `lib/time.ts` | Yeni | Agent 3 |
| `lib/format.ts` | Yeni | Agent 3 |
| `app/api/whales/route.ts` | Yeni | Agent 1 |
| `app/api/news/route.ts` | Güncelleme | Agent 2 |
| `app/api/liquidations/route.ts` | Yeni | Agent 3 |

## API Key Durumu

SIFIR API KEY GEREKMIYOR. Tüm kaynaklar acik:
- cryptocurrency.cv/api — ucretsiz JSON API
- RSS feed'ler — herkese acik
- Nitter RSS — herkese acik (rsshub fallback)
- Telegram public channels — HTML scraping, login gerekmez
- Binance WS forceOrder — auth gerektirmez

## Endpoint Cache Sureleri

- GET /api/news  → s-maxage=60s
- GET /api/whales → s-maxage=30s
- GET /api/liquidations → s-maxage=10s

## Mock Durumu

- Whale feed: Telegram scraping calisiyorsa gercek, yoksa mock
- Liquidations: Binance WS calisiyorsa gercek (buffer), yoksa mock
- News: cryptocurrency.cv → RSS fallback → MOCK_NEWS

## Bilinen Sinirlamalar

- Binance WS serverless'ta surekli acik kalmaz, buffer yaklasimi kullanildi
- Nitter zaman zaman rate limit verebilir, rsshub fallback var
- Telegram HTML yapisi degisirse scraper guncellenebilir
- cryptocurrency.cv yeni bir servis, uptime garantisi yok, RSS fallback var
- TypeScript: npx tsc --noEmit = 0 hata
