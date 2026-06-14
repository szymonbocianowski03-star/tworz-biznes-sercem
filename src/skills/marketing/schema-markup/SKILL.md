# Schema.org (structured data)

Wdrażasz **JSON-LD** zgodnie z treścią strony i wytycznymi wyszukiwarek, żeby ułatwić zrozumienie treści i **rich results** tam, gdzie są dostępne.

## Zanim zaczniesz

Wczytaj kontekst produktu (`.agents/product-marketing-context.md`).

Ustal: typ strony, obecny markup, błędy w Search Console / walidatorze, które rich results są celem.

## Zasady

1. **Dokładność** — schema odzwierciedla to, co widać dla usera; nie oznaczaj fikcji.
2. **Format:** preferuj **JSON-LD** (`<script type="application/ld+json">` w `<head>` lub końcu `<body>`).
3. **Wytyczne Google** — tylko typy i właściwości wspierane dla danego wyniku.
4. **Walidacja** przed wdrożeniem i monitoring po.

## Częste typy

| Typ | Kiedy | Kluczowe pola |
|-----|--------|----------------|
| Organization | strona firmy / about | name, url, logo, sameAs |
| WebSite | home + sitelinks search | name, url |
| Article / BlogPosting | blog | headline, image, datePublished, author |
| Product | produkt | name, image, offers |
| SoftwareApplication | SaaS | name, offers (jeśli dotyczy) |
| FAQPage | FAQ | mainEntity (Q&A) |
| HowTo | instrukcje | step |
| BreadcrumbList | ścieżka nawigacji | itemListElement |
| LocalBusiness | lokalnie | address, geo |
| Event | webinar | startDate, location |

## Wiele typów na jednej stronie

Użyj `@graph` w jednym obiekcie JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "name": "…", "url": "https://…" },
    { "@type": "WebSite", "name": "…", "url": "https://…" },
    { "@type": "BreadcrumbList", "itemListElement": [] }
  ]
}
```

## Walidacja

- [Rich Results Test](https://search.google.com/test/rich-results)  
- [Schema.org Validator](https://validator.schema.org/)  
- Search Console → raporty ulepszeń

**Typowe błędy:** brak wymaganych pól, złe formaty dat (ISO 8601), URL niepełne, rozjazd schema ↔ widoczna treść.

## Implementacja

Statyczne: fragment w szablonie. React/SSR: komponent serwerowy emitujący JSON. CMS: pluginy lub pola custom.

## Output

Pełny blok JSON-LD + checklist walidacji + zgodność z treścią strony.

## Powiązane

`seo-audit`, `ai-seo`, `programmatic-seo`, `site-architecture`, `page-cro`, `analytics-tracking`
