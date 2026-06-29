# Grafika i obrazy marketingowe (AI + design)

Wspierasz tworzenie profesjonalnych assetów wizualnych: herosy blogów, social, mockupy produktu, bannery, OG — z użyciem modeli AI, narzędzi designerskich i optymalizacji pod web.

## Zanim zaczniesz

Wczytaj kontekst produktu (`.agents/product-marketing-context.md`).

Ustal:

1. **Cel** — typ grafiki, placement, wymiary
2. **Produkcja** — brand kit (logo, kolory, fonty), styl (foto vs ilustracja), one-off vs szablon
3. **Techniczne** — dostęp do API (Gemini, Replicate/Flux, Ideogram), budżet, potrzeba kompresji

## Dobór podejścia

| Podejście | Najlepsze do | Narzędzia |
|-----------|--------------|-----------|
| Generacja AI | unikalne herosy, sceny | Gemini, Flux, Ideogram, GPT Image |
| Edycja AI | zmiana tła, stylu | Gemini, Flux Flex |
| Design szablonowy | spójność marki | Canva, Figma |
| Screenshot + overlay | prawdziwe UI | devtools, ramki urządzeń |
| Stock | szybkość > unikalność | Unsplash, Pexels |

### Tekst na obrazku

- **Tak** → Ideogram (najlepszy tekst), Gemini (dobry), GPT Image (ok)
- **Spójność marki / referencje** → Flux (multi-reference)
- **Edycja istniejącego** → Gemini, Flux Flex
- **Wysoka estetyka** → Flux Pro, Midjourney (bez oficjalnego API)
- **Wolumen / koszt** → Flux szybszy/tańszy, Gemini Flash

**Prompt (szkielet):** podmiot + scena + styl + światło + kompozycja + techniczne (np. 16:9, 4K).

**Błędy:** zbyt ogólny opis, brak proporcji, długi tekst w promptcie (lepiej overlay), brak kierunku stylistycznego.

## Narzędzia designerskie

**Canva** — szybkie szablony, brand kit, Magic Resize; social, maile, proste bannery.

**Figma** — design system, OG z szablonów, pixel-perfect; lepsze przy zespole designerskim.

**Kiedy design tool zamiast AI:** ścisłe brand guidelines, wiele wariantów rozmiaru z jednego mastera, szablony powtarzalne.

## Workflow: hero bloga / OG

- metafora wizualna tematu
- typowo **1200×630** (hero + OG) lub **1920×1080** full-width
- kompresja docelowa często **&lt;200 KB**, **WebP** + fallback

## Social — rozmiary (skrót)

| Platforma | Rozmiar | Uwagi |
|-----------|---------|--------|
| X | 1200×675 | 16:9 |
| LinkedIn feed | 1200×627 | 1.91:1 |
| IG feed | 1080×1080 lub 1080×1350 | |
| Stories | 1080×1920 | 9:16 |
| Facebook link | 1200×630 | |

## Mockupy produktu

**Nie generuj UI w AI** — halucynacje. Zrób **prawdziwy screenshot** (2×), ramka urządzenia, adnotacje (strzałki, etykiety).

## Bannery profili / katalogów

| Miejsce | Rozmiar |
|---------|---------|
| LinkedIn personal | 1584×396 |
| LinkedIn company | 1128×191 (LinkedIn podaje też większe warianty) |
| X header | 1500×500 |
| Product Hunt gallery | 1270×760 |
| G2 | 1280×720 |
| GitHub social | 1280×640 |
| Google Play feature | 1024×500 |

Mało tekstu, ważne na środku (safe zone), na listingach często wygrywa **prawdziwe UI**.

## Optymalizacja

- **WebP/AVIF** tam gdzie możliwe, sensowny fallback
- serwuj rozmiar zbliżony do wyświetlania
- `loading="lazy"` poniżej folda, `width`/`height` dla CLS
- **alt** opisowy, nie keyword stuffing

## OG / meta preview

```html
<meta property="og:image" content="https://twojadomena.pl/og/strona.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
```

Dynamiczne OG: Vercel OG / Satori, Cloudinary overlays.

## Typowe błędy

- AI zamiast prawdziwego UI
- brak kompresji (LCP cierpi)
- brak OG — linki wyglądają „pusto”
- zły aspect ratio pod platformę
- długi tekst w obrazku bez Ideogram / bez overlay
- chaos wizualny marki — użyj referencji lub szablonów

## Powiązane

`marketing-video`, `ad-creative`, `page-cro`, `ai-seo`, `aso-audit`, `directory-submissions`, `content-strategy`
