# ASO Audit (App Store / Google Play)

Analizuj listing aplikacji w App Store i Google Play pod kątem ASO. Zbieraj dane z live strony, oceniaj metadane + assety + ratingi i twórz **priorytetyzowany plan działań**.

## Kiedy używać

- użytkownik podaje link do App Store / Google Play
- użytkownik chce audyt/optymalizację listingu
- użytkownik chce porównać aplikację z konkurencją
- użytkownik pyta o ranking, widoczność, konwersję pobrań

## Zanim zaczniesz

Jeśli istnieje `.agents/product-marketing-context.md` (albo `.claude/product-marketing-context.md`), wczytaj i nie pytaj o rzeczy już znane.

## Faza 1 — wykryj sklep i pobierz listing

### Rozpoznaj sklep po URL

- Apple: `apps.apple.com/{kraj}/app/{nazwa}/id{cyfry}`
- Google: `play.google.com/store/apps/details?id={package}`

Jeśli użytkownik poda nazwę aplikacji bez URL:

- szukaj: `site:apps.apple.com "Nazwa"` lub `site:play.google.com "Nazwa"`

### Pobierz listing

Pobierz i wyciągnij pola (tyle ile się da).

**Apple:**

- tytuł (limit 30), subtitle (30)
- opis długi (nie indeksowany, ale wpływa na konwersję)
- promo text (170)
- kategorie, screenshoty, video, rating, reviews, cena/IAP, dev, update, wersje, wiek, rozmiar, języki

**Google Play:**

- tytuł (30), short desc (80), full desc (4,000) — **indeksowane**
- kategoria/tagi, feature graphic, screenshoty, video, rating/reviews, cena/IAP, update, downloads, data safety, języki

**Assety wizualne**: jeśli nie da się pobrać automatycznie, poproś o screenshot listingu.

## Faza 1.5 — dojrzałość marki (tier)

Zaklasyfikuj:

- **Dominant**: 1M+ opinii, top-10, rozpoznawalność
- **Established**: 100k+ opinii, silna pozycja w kategorii
- **Challenger**: <100k opinii — tu ASO ma największą dźwignię

Zasada: zanim „odejmiesz punkty”, sprawdź czy to nie jest świadomy wybór marki dominującej.

## Faza 2 — scoring 0–10 (wymiary)

Skaluj do 100 pkt:

1) **Title & Subtitle** (20%)
2) **Description** (15%)
3) **Visual assets** (25%)
4) **Ratings & Reviews** (20%)
5) **Metadata & Freshness** (10%)
6) **Conversion signals** (10%)

## Faza 3 — porównanie z konkurencją (opcjonalnie)

Jeśli są URL-e konkurencji: zrób ten sam scoring i wskaż luki (keyword + assety + proof).

## Faza 4 — raport

Raport ma zawierać:

- **Scorecard** (wynik + oceny wymiarów)
- **Top 3 quick wins** (<1h)
- szczegółowe rekomendacje per wymiar (konkretne zmiany, z limitami znaków)
- sugestie keywordów (z uzasadnieniem)
- rekomendacje assetów (kolejność screenshotów, messaging)
- priorytety: impact × effort

## Reguły

- rekomendacje mają być **konkretne** („Zmień X na Y”), nie ogólnikowe
- podawaj limity znaków i uzasadnienie
- jasno rozróżniaj Apple vs Google
- zaznacz, czego nie da się ocenić bez danych/narzędzi

