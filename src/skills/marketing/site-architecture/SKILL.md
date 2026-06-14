# Architektura witryny (IA + SEO)

Planujesz **hierarchię stron, nawigację, wzorce URL i linkowanie wewnętrzne** — intuicyjnie dla ludzi i czytelnie dla wyszukiwarek.

## Zanim zaczniesz

Wczytaj `.agents/product-marketing-context.md` (lub `.claude/...`).

Zbierz: czym jest firma, audience, top 3 cele witryny (konwersja, SEO, edukacja), nowa vs restrukturyzacja, co jest zepsute, URL do zachowania (redirect 301), typ witryny (SaaS, blog, e-commerce, docs, hybryda), liczba stron, najważniejsze URL, plany rozwoju.

## Reguła ~3 klików

Kluczowe strony powinny być osiągalne w ok. **3 klikach** z home — głębiej bez dobrego powodu = gorsza findability i crawl.

## Płasko vs głęboko

| Głębokość | Kiedy |
|-----------|--------|
| Płaska (2 poziomy) | małe witryny |
| Umiarkowana (3) | typowy SaaS, content |
| Głęboka (4+) | duży e-commerce, docs — kontroluj orphan pages |

Dropdown z 20+ pozycjami → dodaj poziom lub hub.

## Nawigacja

**Header:** zwykle **4–7** pozycji, logo → home, CTA najbardziej na prawo, kolejność wg priorytetu.

**Footer:** kolumny (Produkt, Zasoby, Firma, Legal).

**Sidebar:** sekcje typu docs/blog.

**Breadcrumbs:** zgodne z hierarchią URL; każdy segment klikalny oprócz bieżącej strony.

## URL — zasady

Czytelne: `/features/analytics`, nie `/f/a123`. **Myślniki**, nie podkreślenia. **Małe litery**. Spójna polityka **trailing slash**. Ścieżka odzwierciedla strukturę. Unikaj dat w slugach bloga (`/blog/temat` lepsze niż `/blog/2024/01/...`). Unikaj `?id=` dla głównej treści — użyj sluga.

**Typowe błędy:** zmiana URL bez 301, mieszane wzorce (`/features/` vs `/product/`), same ID w path, parametry zamiast ścieżek.

## Drzewo stron (ASCII — przykład)

```
/ (Home)
├── /features
│   ├── /features/analytics
│   └── /features/automation
├── /pricing
├── /blog
│   └── /blog/{slug}
├── /docs
│   └── /docs/{section}/{page}
└── /contact
```

Dla złożonych relacji możesz dodać diagram **Mermaid** (`graph TD`, opcjonalnie `subgraph` dla stref nawigacji).

## Linkowanie wewnętrzne

- brak stron-sierot (min. 1 link przychodzący)
- kotwice opisowe (nie „kliknij tutaj”)
- orientacyjnie ~5–10 linków / 1000 słów treści kontekstowej
- **hub & spoke:** filar + artykuły satelitarne wzajemnie i do filaru
- sekcje „Powiązane”, breadcrumbs

## Deliverables (output)

1. **Drzewo hierarchii** (ASCII z URL przy węzłach).  
2. **Diagram Mermaid** (opcjonalnie — strefy nav).  
3. **Tabela URL:** Strona | URL | Rodzic | Miejsce w nav | Priorytet.  
4. **Spec nawigacji:** header (kolejność + CTA), footer, sidebar, breadcrumbs.  
5. **Plan linkowania:** huby, cross-linki (feature↔case study↔blog), audyt sierot przy migracji.

## Powiązane

`content-strategy`, `programmatic-seo`, `seo-audit`, `page-cro`, `schema-markup` (BreadcrumbList), `competitor-alternative-pages`
