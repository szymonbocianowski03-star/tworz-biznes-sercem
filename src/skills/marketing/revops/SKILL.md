# RevOps (Revenue Operations)

Projektujesz **spójny silnik przychodu**: marketing, sales i CS na jednych definicjach, danych i handoffach.

## Zanim zaczniesz

Wczytaj kontekst produktu (`.agents/product-marketing-context.md`).

Zbierz: motion (PLG / sales / hybrid), ACV, długość cyklu, stack (CRM, MA, enrichment), jak dziś lecą leady, gdzie uciekają, cel (speed-to-lead, konwersja MQL→SQL, higiena, greenfield).

Działaj na tym co user poda; braki oznacz jako „do doprecyzowania”.

## Zasady

1. **Jedno źródło prawdy** — kanoniczny CRM; reszta synchronizacja.
2. **Najpierw definicje, potem automatyzacje** — zła automatyzacja przyspiesza chaos.
3. **Każdy handoff ma właściciela, SLA i metrykę** — marketing→SDR→AE→CS.
4. **Alignment** — wspólne definicje MQL/SQL; jeśli sales odrzuca MQL „z definicji”, definicja jest zła.

## Lejek (przykładowe etapy)

| Etap | Wejście / wyjście | Owner |
|------|-------------------|--------|
| Subscriber | zgoda na content → sygnał fit/zaangażowania | Marketing |
| Lead | znany kontakt → spełnia min. fit | Marketing |
| MQL | fit + engagement próg → akceptacja/odrzucenie w SLA | Marketing→Sales |
| SQL | sales zakwalifikował rozmową → opp lub recycle | Sales |
| Opportunity | BANT/MEDDIC wg waszego modelu | AE |
| Customer | closed-won | CS |
| Evangelist | NPS, referral, case | CS/Marketing |

**MQL:** ani sam „idealny fit bez zachowania”, ani „student ściągający wszystkie PDF” — **fit + intencja**.

## SLA handoffu (przykład do dostosowania)

Alert do opiekuna → pierwszy kontakt w **&lt;4h** roboczych → kwalifikacja w **48h** → odrzucone z kodem powodu → nurture.

**Speed-to-lead:** im szybciej pierwszy kontakt po formularzu, tym wyższa szansa kwalifikacji (priorytet pod proces).

## Lead scoring

- **Explicit (fit):** firma, rola, branża, geo, tech stack.
- **Implicit (engagement):** pricing, demo, wielokrotne wizyty, eventy, email, usage (PLG).
- **Negatywne:** domeny konkurencji, personal/student, mismatch roli.

Ustal wagi, próg MQL, walidacja na historycznych won — **koryguj kwartalnie**.

**Błędy:** za dużo punktów za każdy download, brak negatywów, ten sam scoring dla blog i pricing.

## Routing

Round-robin (równy podział), terytoria, named accounts, umiejętności (język, produkt). Zawsze **fallback owner**. Uwzględnij capacity i PTO.

## Pipeline hygiene

Wymagane pola per stage, alerty na „stale deals”, wykrywanie skipów etapów, dyscyplina close date z powodem przy przesunięciu.

## Deal desk (gdy duże deal’e)

Niestandardowe warunki, wieloletnie, duże rabaty — poziomy akceptacji; dokumentuj wyjątki; jeśli wszyscy proszą o to samo, włącz do standardu.

## Metryki (orientacyjne benchmarki — weryfikuj w swojej kategorii)

Lead→MQL, MQL→SQL, SQL→Opp, velocity, coverage (pipeline/quota), CAC, LTV:CAC, speed-to-lead, win rate.

Dashboard: widok marketingu, salesu, executive (CAC, LTV:CAC, realizacja).

## Output

Dokument etapów + SLA, spec scoringu, drzewo routingu, konfiguracja pipeline + automaty, spec dashboardu.

## Powiązane

`cold-email`, `email-sequence-design`, `pricing-strategy`, `analytics-tracking`, `launch-strategy`, `sales-enablement`
