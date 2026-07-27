# Kontekst product marketing (dokument źródłowy)

Pomagasz utworzyć i utrzymywać **jeden kanoniczny dokument** z positioningiem i messagingiem, z którego korzystają inne umiejętności marketingowe — żeby nie powtarzać wywiadu od zera.

## Lokalizacja pliku

Zapisuj jako **`.agents/product-marketing-context.md`** (starsze setupy: `.claude/product-marketing-context.md` — jeśli istnieje tylko tam, zaproponuj przeniesienie).

## Workflow

### Krok 1: Sprawdź istniejący plik

- Jeśli **jest** — podsumuj sekcje, zapytaj co zaktualizować, zbieraj tylko brakujące.
- Jeśli **nie ma** — zaproponuj:
  - **Auto-draft z repo (zalecane):** README, strony marketingowe, copy w kodzie, `package.json`, docs → szkic V1 → user koryguje.
  - **Od zera:** sekcja po sekcji, bez zalewania pytaniami naraz.

### Krok 2: Zbieraj informacje

- Priorytet: **dosłowny język klienta** (cytaty), nie tylko „ładny opis marketingowy”.
- Pomijaj sekcje niepasujące (np. persony przy czystym B2C).

### Krok 3: Zapisz dokument

Użyj struktury poniżej. Na końcu: data aktualizacji.

---

## Szablon dokumentu

```markdown
# Product Marketing Context

*Ostatnia aktualizacja: [data]*

## Product Overview
**One-liner:**
**Co robi (2–3 zdania):**
**Kategoria produktu (półka):**
**Typ produktu:**
**Model biznesowy / pricing:**

## Target Audience
**Firmy docelowe:**
**Decydenci / role:**
**Główny use case:**
**Jobs to be done:**
-
**Scenariusze:**
-

## Personas (B2B)
| Persona | O co dba | Wyzwanie | Obietnica wartości |
|---------|----------|----------|---------------------|
| | | | |

## Problems & Pain Points
**Rdzeń problemu:**
**Czemu alternatywy nie wystarczają:**
-
**Koszt braku rozwiązania:**
**Napięcie emocjonalne:**

## Competitive Landscape
**Bezpośredni:** [konkurent] — słabość dla naszego ICP…
**Wtórny (inna kategoria, ten sam job):**
**Pośredni (inny paradygmat):**

## Differentiation
**Kluczowe różnicatory:**
-
**Jak robimy to inaczej:**
**Dlaczego to lepsze (benefit):**
**Dlaczego wybierają nas:**

## Objections
| Obiekcja | Odpowiedź |
|----------|-----------|
| | |

**Anti-persona (kto NIE jest fit):**

## Switching dynamics
**Push (co wypycha ze starego):**
**Pull (co przyciąga do nas):**
**Habit (co trzyma przy starym):**
**Anxiety (lęk przed zmianą):**

## Customer language
**Jak opisują problem (verbatim):**
- „…”
**Jak opisują nas:**
- „…”
**Słowa do użycia:**
**Słowa do unikania:**
**Glosariusz:**
| Termin | Znaczenie |
|--------|-----------|
| | |

## Brand voice
**Ton:**
**Styl:**
**Osobowość (przymiotniki):**

## Proof points
**Metryki:**
**Klienci / logo:**
**Cytaty:**
> „…” — [kto]
**Tematy wartości:**
| Temat | Dowód |
|-------|-------|
| | |

## Goals
**Cel biznesowy:**
**Główna konwersja:**
**Aktualne metryki (jeśli znane):**
```

## Krok 4: Potwierdź

Pokaż gotowy plik, popraw po feedbacku, zapisz w `.agents/product-marketing-context.md`.

**Komunikat dla usera:** inne umiejętności marketingowe powinny ten plik wczytywać przed pytaniami; aktualizuj dokument, gdy zmienia się produkt lub ICP.

## Powiązane

Wszystkie `marketing/*` — zwłaszcza `copywriting`, `page-cro`, `sales-enablement`, `skill-director`
