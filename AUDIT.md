# Production Risk Audit Checklist

Date: 2026-03-19

## Aşama 1: Envanter ve bağımlılık audit

- [x] `components/`, `hooks/`, `lib/`, `app/` içinde kalan `fetch("/api...")` çağrıları frontend tarafında temizlendi.
- [x] `@/app/api/*` type bağımlılıkları kaldırıldı.
- [x] Aktif akışta olan polling noktaları sınıflandırıldı (realtime kritik akışlar WS’ye taşındı, düşük kritik alanlar düşük frekans REST olarak bırakıldı).

## Aşama 2: Frontend veri yolu tekilleştirme

- [x] Frontend çağrıları `lib/api-client.ts` + `lib/runtime-env.ts` üzerinden external backend’e yönlendirildi.
- [x] `lib/runtime-env.ts` local Next API fallback davranışı kaldırıldı.
- [x] `useNews`, `WhaleFeed`, `LiquidationFeed`, `news/page` içinde agresif polling azaltıldı; realtime önceliği WS oldu.
- [x] UI düzeni korunarak yalnız veri akışı güncellendi.

## Aşama 3: Next app/api decommission

- [x] `app/api/*` route dosyaları tamamen kaldırıldı.
- [x] Type bağımlılıkları `types/` altına taşındı (`calendar`, `screener`, `trending`).
- [x] Acceptance: `npm run build` çıktısında Next dynamic API route listelenmiyor.

## Aşama 4: Backend production hardening

- [x] CORS allowlist `CORS_ORIGINS` ile kısıtlandı ve `DELETE` metodu eklendi.
- [x] `/health` endpoint dependency/cached-state bilgisi döndürüyor.
- [x] Structured logging alanları standardize edildi: `request_id`, `route`, `latency_ms`, `upstream_status`, `status_code`.
- [x] WS heartbeat/reconnect davranışı README’de dokümante edildi.
- [x] Eksik backend endpointleri eklendi: `/api/calendar`, `/api/screener`, `/api/trending`, `/api/liquidations`, `/api/whales`.

## Aşama 5: Deploy ve runbook

- [x] README tek kaynak olacak şekilde güncellendi.
- [x] Vercel env ve Railway/VPS runbook netleştirildi.
- [x] Process manager örneği (`pm2`) ve başlatma komutu eklendi.

## Test Sonuçları

- [x] Build: `npm run build` başarılı.
- [x] Deployment acceptance: build output’ta `app/api/*` route yok.
- [x] Security acceptance: frontend kaynak kodunda local Next `app/api/*` kullanım yolu kaldırıldı.
- [ ] Realtime failover testi (backend stop/start sırasında canlı UI davranışı) manuel ortamda tekrar doğrulanmalı.
- [ ] Production domain CORS doğrulaması (Vercel production URL ile) deploy ortamında doğrulanmalı.

## Kalan Riskler (Düşük/Orta)

- [ ] Bazı non-critical ekranlarda düşük frekans polling devam ediyor (örn. screener 120s). Bu bilinçli seçimdir.
- [ ] Backend port conflict/availability kontrolü deployment orchestration ile garanti edilmeli.

## 2026-03-19 Hotfix Audit (Live Empty Data)

- [x] /terminal eski basarili UI (TerminalApp) geri alindi.
- [x] Next same-origin proxy aktif: app/api/[...path]/route.ts
- [x] Proxy path mapping duzeltildi:
  - /api/health -> backend /health
  - digerleri -> backend /api/*
- [x] Eksik endpoint tamamlandi: backend GET /api/okx/orderbook
- [x] Browser API cagirlari relative olacak sekilde sabitlendi (CORS/env drift azaltildi).
- [x] Backend 5xx/timeout durumunda emergency live fallback eklendi:
  - /api/bootstrap
  - /api/news
  - /api/prices?type=quotes
  - /api/market
  - /api/screener

### Son durum

- Build: npm run build basarili.
- Kritik risk: canli Railway backend zaman zaman 502/timeout veriyor.
- Mitigasyon: fallback katmani ile UI'nin tamamen bos kalmasi engellendi.
