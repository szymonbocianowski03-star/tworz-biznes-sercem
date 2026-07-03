# Campaign Composer — dokumentacja techniczna

## Cel

Moduł **Campaign Composer / Launch Center** pod `/campaign-composer`: szkice kampanii Meta i LinkedIn, walidacja preflight, kolejka launch job, biblioteka assetów, zbiory, centrum błędów.

## Architektura (warstwy)

| Warstwa | Lokalizacja |
|--------|-------------|
| Model DB (Supabase) | `supabase/migrations/20260514090000_campaign_composer.sql` |
| Schemat draftu (Zod) | `src/modules/campaign-composer/domain/draft-schema.ts` |
| Walidacja preflight | `src/modules/campaign-composer/validation/preflight.ts` |
| Adapter Meta | `src/modules/campaign-composer/adapters/meta.adapter.ts` |
| Adapter LinkedIn | `src/modules/campaign-composer/adapters/linkedin.adapter.ts` |
| Silnik launchu | `src/modules/campaign-composer/launch/launch-engine.ts` |
| Server functions | `src/modules/campaign-composer/server/campaign-composer.fns.ts` |
| Worker HTTP | `src/routes/lovable/campaign-composer/queue/process.ts` |
| UI | `src/routes/campaign-composer*.tsx`, `src/components/campaign-composer/` |

## Użytkownik końcowy

1. Zaloguj się i połącz Meta / LinkedIn w `/integrations`.
2. Wejdź w **Composer** (`/campaign-composer`), utwórz szkic.
3. Uzupełnij kroki w edytorze, uruchom **Przegląd** (preflight).
4. **Kolejkuj live** — job trafia do `cc_launch_job`; przetwarzanie: dev przycisk „Przetwórz job (dev)” albo worker HTTP.

## Anulowanie

- **Przed publikacją:** `cancel_requested` na jobie — przerwanie pętli kroków, szkic zostaje (`cc_campaign_draft`).
- **Po utworzeniu u providera:** brak sztucznego statusu „cancelled” dla encji providera — używamy **pause / archive / delete** w adapterach (TODO pod produkcyjne endpointy).

## Testy

```bash
npm install
npm run test
```

## E2E (zalecenie)

Projekt nie zawiera Playwright out-of-the-box. Zalecana ścieżka: Playwright + środowisko testowe Supabase, scenariusz: login → composer → zapis draftu → enqueue → asercja rekordu job.

## Zmienne środowiska

Zobacz `docs/CAMPAIGN_COMPOSER_ENV.md`.
