# Audyt SEO (klasyczne wyszukiwarki)

Identyfikujesz problemy SEO i dajesz **konkretne rekomendacje** pod organiczny wzrost — technika, on-page, treść, autorytet.

## Zanim zaczniesz

Wczytaj `.agents/product-marketing-context.md` (lub `.claude/...`).

Ustal: typ witryny, cele SEO, priorytety fraz, znane problemy, poziom ruchu, migracje, zakres (cała strona vs URL), dostęp do GSC/analityki.

## Ograniczenie: wykrywanie schema przez `web_fetch` / curl

**Statyczny HTML i narzędzia bez JS często nie widzą JSON-LD** — wiele CMS (Yoast, RankMath itd.) wstrzykuje `<script type="application/ld+json">` po stronie klienta.

Żeby **nie raportować fałszywie „brak schema”**:

- przeglądarka po renderze: `document.querySelectorAll('script[type="application/ld+json"]')`
- [Rich Results Test](https://search.google.com/test/rich-results) (renderuje JS)
- eksport Screaming Frog z renderowaniem JS, jeśli klient dostarczy

Patrz też umiejętność `schema-markup`.

## Kolejność priorytetów

1. Crawlowalność i indeksacja  
2. Fundamenty techniczne (szybkość, działanie)  
3. On-page  
4. Jakość treści  
5. Autorytet i linki  

## Techniczne (skrót)

**Crawl:** `robots.txt` (brak przypadkowych blokad), sitemap XML (canonical, aktualna, w GSC), architektura (ważne strony w ~3 klikach), brak sierot, parametry/facetów pod kontrolą.

**Indeksacja:** `site:`, Coverage w GSC, `noindex` na kluczowych, canonicali, redirect chains, soft 404, duplikaty bez canonicala, spójność www/https/slash.

**Core Web Vitals (orientacyjnie):** LCP, INP, CLS — PSI, CrUX, GSC.

**Mobile:** responsywność, viewport, tap targety, ta sama treść co desktop (mobile-first).

**HTTPS:** w całej domenie, brak mixed content.

**URL:** czytelne, małe litery, myślniki, spójna polityka końcowych slashy.

## International SEO (hreflang + canonical)

- **Self-reference:** każda strona w zestawie hreflang musi wskazywać sama na siebie.
- **Wzajemność:** jeśli A→B, to B→A (inaczej para może być zignorowana).
- **Kody:** ISO 639-1 + opcjonalnie region (np. `en-GB`, nie `en-UK`).
- **`x-default`** do strony fallback.
- Cele hreflang: **200**, **indeksowalne**, **zgodne z canonical** — canonical **nie może** być cross-locale (np. wszystkie wersje → EN zabija lokalizacje).
- Przy wielu locale: często hreflang w sitemap; uwaga na limity rozmiaru pliku.
- **Treść:** tłumacz całą widoczną treść, nie tylko nawigację; cienkie locale obniżają sygnały całej domeny.

## On-page

**Title:** unikalny, główne słowo wcześnie, ~50–60 znaków, klikalny, marka zwykle na końcu.

**Meta description:** unikalna, wartość + CTA, ~150–160 znaków.

**Nagłówki:** jeden H1, hierarchia H2→H3, sens semantyczny nie tylko styl.

**Treść:** intencja, słowa powiązane, głębia vs konkurencja, unikanie thin content.

**Obrazy:** nazwy plików, alt, formaty nowoczesne, lazy load, rozmiar.

**Linkowanie wewnętrzne:** hub & spoke, kotwice opisowe, brak sierot, sensowna liczba linków.

**Kanibalizacja:** jedna główna intencja na URL; mapa keyword → URL.

## Jakość treści (E-E-A-T — skrót)

Doświadczenie, ekspertyza, autorytet, wiarygodność: cytowalne źródła, autorzy, case’y, aktualizacje, transparentność (kontakt, polityki).

## Typowe problemy wg typu witryny

- **SaaS:** cienkie product/feature, brak porównań/alternatyw, słaba integracja blog↔produkt.  
- **E-commerce:** cienkie kategorie, duplikaty opisów, facetów, OOS.  
- **Blog:** brak klastrów, stare posty, słabe linkowanie.  
- **Wielojęzyczność:** błędy hreflang + canonical.  
- **Lokalnie:** spójne NAP, GBP, lokalne strony.

## Format raportu

1. **Executive summary** — ogólna ocena, top 3–5 priorytetów, quick wins.  
2. **Techniczne** — Issue / Impact / Evidence / Fix / Priority.  
3. **On-page** — ten sam format.  
4. **Treść / E-E-A-T** — ten sam format.  
5. **Plan działań** — krytyczne → wysoki wpływ → szybkie → długi horyzont.

## Narzędzia

GSC, PageSpeed Insights, Bing WMT, Rich Results Test, test mobile, walidatory schema (z renderowaniem).

## Powiązane

`ai-seo` (GEO / AI Overviews / LLM), `programmatic-seo`, `site-architecture`, `schema-markup`, `page-cro`, `analytics-tracking`
