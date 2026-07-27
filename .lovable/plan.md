# Przebudowa modułu kampanii reklamowych (Meta / TikTok / LinkedIn)

## Co już istnieje (nie budujemy od zera)
Backend jest w dużej części gotowy i obsługuje 3 platformy osobno:
- Osobne adaptery: `meta.adapter.ts`, `tiktok.adapter.ts`, `linkedin.adapter.ts` (każdy ma własny `buildLaunchPlan` i `executeStep` z osobnym payloadem API).
- `tiktok-ads.service.ts` — realne wywołania TikTok Marketing API v1.3 (campaign/adgroup/ad create, upload, status, metryki).
- `launch-engine.ts` + kolejka (`cc_launch_job`) — realna publikacja przez API (gdy `CAMPAIGN_COMPOSER_DRY_RUN=false` i jest token), z retry, partial success, audytem.
- Schema draftu (`draft-schema.ts`) z sekcjami `meta` / `tiktok` / `linkedin`.

## Problem
- UI (`campaign-composer.draft.$draftId.tsx`) to **jeden wspólny formularz** dla wszystkich platform — łamie zasadę „osobny kreator per platforma”. TikTok prawie nie ma pól (brak objective, budżetu, targetowania, kreacji, trackingu).
- Walidacja preflight nie pokrywa TikTok/LinkedIn (tylko Meta + ogólne).
- Istnieje przestarzała strona „Uruchom kampanię” (`/campaigns`) do usunięcia.

## Zakres prac (fazy)

### Faza 1 — Sprzątanie + rozdzielenie kreatorów
1. Usuń stronę „Uruchom kampanię": skasuj `src/routes/campaigns.tsx`, usuń link `{ to: "/campaigns", label: "Uruchom kampanię" }` z `AppShell.tsx` (linia 220). Zostaje „Panel kampanii" (`/campaign-composer`).
2. Rozbij wspólny edytor draftu na osobne komponenty:
   - `MetaCampaignBuilder`, `TikTokCampaignBuilder`, `LinkedInCampaignBuilder` w `src/components/campaign-composer/builders/`.
   - `campaign-composer.draft.$draftId.tsx` wybiera builder po `payload.channel.provider` — każdy renderuje wyłącznie własne pola i kroki. Zero mieszania pól między platformami.

### Faza 2 — Pełny kreator TikTok Ads
Kroki: Konto → Campaign → Ad Group → Targetowanie i budżet → Kreacja → Tracking → Przegląd → Publikacja.
1. Rozszerz `tiktok` w `draft-schema.ts` o wymagane pola:
   - Campaign: objective (Traffic/Conversions/Lead Gen/Reach/Video Views/App Promotion/Product Sales), budget type (no_limit/daily/lifetime), budget amount, status (draft/active/paused).
   - Ad Group: placement (auto/manual), location/age/gender/language/interest/behavior/device targeting, custom + lookalike audiences, budżet (daily/lifetime), start/end date, schedule type, dayparting, optimization goal, bid strategy, bid/cost cap, pixel, conversion event.
   - Ad: ad name, identity, creative type (video/existing/Spark), thumbnail, ad text, CTA, destination URL, display name, UTM, tracking pixel/event.
2. UI builder TikTok z tymi polami, sterowany krokami; pokazuje tylko pola TikTok.

### Faza 3 — Walidacja per platforma
Dodaj `tiktokPreflight` i `linkedinPreflight` (rozdziel `preflight.ts`):
- TikTok: campaign name + objective wymagane; budżet wymagany dla daily/lifetime i ≥ minimum API; ad group name/location/budget/start date/optimization goal wymagane; Conversions → pixel + event; Traffic → destination URL; end date > start date; ad name/creative type/video|Spark/ad text/CTA wymagane; URL musi być https://.
- Komunikaty po polsku, konkretne (czego brakuje), nie „coś poszło nie tak".

### Faza 4 — Połączenie i publikacja TikTok
1. Sprawdzanie połączenia konta TikTok w buderze: jeśli brak → „Połącz konto TikTok Ads" + przycisk do `/integrations` (OAuth już istnieje: `tiktok.start`/`tiktok.callback`, tabela `tiktok_connections`).
2. Po połączeniu zaciągnij advertiser_id, nazwę konta, piksele, eventy konwersji, custom audiences, identity (przez `tiktok-ads.service.ts`).
3. Publikacja: przycisk „Publish" → kolejka launch (już realnie woła API). Po sukcesie: „Kampania TikTok Ads została opublikowana." + przycisk „Otwórz w TikTok Ads Manager" (link z advertiser_id + campaign_id). Błędy mapowane czytelnie (brak/wygasły token, brak uprawnień, zły budżet, brak pola, błąd uploadu, błąd API).
4. Logowanie techniczne błędów po stronie serwera (payload, endpoint, response, error code/message, timestamp, user_id, advertiser_id) — w `cc_launch_job_item` + `cc_audit_event`.

### Faza 5 — Statusy, draft i budżet per platforma
- Statusy lokalne: draft / ready_to_publish / publishing / published / failed / paused.
- „Zapisz" = draft lokalny; „Publish" = realne API.
- Budżet wg reguł platformy: TikTok (campaign no_limit/daily/lifetime + adgroup daily/lifetime, minima API), Meta (campaign/ad set zależnie od typu), LinkedIn (struktura Campaign Manager). Osobne `buildMetaPayload` / `buildTikTokPayload` / `buildLinkedInPayload` (już rozdzielone w adapterach — domknąć pola).

### Faza 6 — Meta i LinkedIn (analogicznie)
Domknięcie dedykowanych pól i walidacji dla Meta i LinkedIn w ich własnych buderach, bez pól TikToka.

## Szczegóły techniczne
- Pliki nowe: `src/components/campaign-composer/builders/{Meta,TikTok,LinkedIn}CampaignBuilder.tsx`, rozdzielone funkcje preflight.
- Pliki zmieniane: `draft-schema.ts` (rozbudowa `tiktok`/`linkedin`), `campaign-composer.draft.$draftId.tsx` (router buderów), `preflight.ts`, `tiktok.adapter.ts` (mapowanie nowych pól na payload API), `AppShell.tsx`, `campaignComposerLabels.ts`.
- Pliki usuwane: `src/routes/campaigns.tsx`.
- Realna publikacja wymaga `CAMPAIGN_COMPOSER_DRY_RUN=false` w env (domyślnie dry-run dla bezpieczeństwa) — potwierdzimy z Tobą przed włączeniem realnych wywołań na koncie reklamowym.

## Pytanie przed startem
Czy publikację TikTok od razu wykonywać realnie na Twoim koncie (DRY_RUN=false), czy najpierw w trybie testowym (dry-run), aż przejdziemy pełny przegląd pól? To jedyna decyzja blokująca; resztę realizuję wg powyższego planu.
