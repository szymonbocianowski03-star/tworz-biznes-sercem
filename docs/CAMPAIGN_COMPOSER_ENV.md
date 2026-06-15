# Campaign Composer — sekrety, scope OAuth, zmienne środowiska

## Zmienne aplikacji (serwer / worker)

| Zmienna | Opis |
|---------|------|
| `CAMPAIGN_COMPOSER_DRY_RUN` | Opcjonalnie `true` — wymusza symulację bez wywołań API. Gdy **nieustawione**, przycisk „Opublikuj kampanię” wysyła na prawdziwe Meta/TikTok API (wymaga tokenów w `meta_connections`). |
| `CAMPAIGN_LAUNCH_WORKER_SECRET` | Bearer dla endpointu `POST /lovable/campaign-composer/queue/process` (cron / zewnętrzny worker). |
| `SUPABASE_SERVICE_ROLE_KEY` | Już używane w projekcie — worker przetwarza joby z pominięciem RLS. |
| `SUPABASE_URL` | URL projektu Supabase. |

## Meta Marketing API

- Token użytkownika w tabeli `meta_connections.access_token`.
- Typowe scope: `ads_management`, `ads_read`, `business_management` (zależnie od konfiguracji aplikacji Meta).
- Wymagane pola w szkicu: konto reklamowe (`ad_account_id`), **Page ID** dla reklam linkowych.
- **Specjalna kategoria reklam:** `special_ad_categories` + kraje — walidowane w preflight.

## LinkedIn Ads API

- Token w `linkedin_connections`; odświeżanie przez istniejący flow OAuth w repo.
- Scope (przykłady): `r_ads`, `rw_ads`, `r_ads_reporting` — dokładna lista zależy od operacji (tworzenie kampanii, images API, DSC).
- Kreacja **Sponsored Content** / upload obrazów: adapter zwraca komunikat TODO do czasu uzupełnienia ścieżki Images API i formatów (karuzela / wideo).

## Migracja bazy

Uruchom migracje Supabase (CLI lub dashboard), plik: `supabase/migrations/20260514090000_campaign_composer.sql`.

## Regeneracja typów TypeScript

Po migracji: `supabase gen types typescript` i scalenie z `src/integrations/supabase/types.ts` (w tym PR dodano tabele `cc_*` ręcznie do `types.ts`).
