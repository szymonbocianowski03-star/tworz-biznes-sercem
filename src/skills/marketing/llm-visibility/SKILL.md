# LLM Visibility / GEO — raport i wdrożenie

Cel: sprawić, by marka była **wymieniana, polecana i poprawnie opisywana** w odpowiedziach ChatGPT, Perplexity, Claude, Gemini, Copilot i Google AI Overviews.

LLM Visibility ≠ klasyczne SEO. Klasyczne SEO walczy o **ranking w SERP**. GEO walczy o **cytowanie w odpowiedzi modelu**. Modele wybierają źródła na podstawie: jakości i struktury (extractability), autorytetu (citable signals), dopasowania do intencji i świeżości.

## Kontekst — zbierz zanim ruszysz (max 3 pytania, po jednym)

1. Kategoria produktu w 1 zdaniu + ICP (kto kupuje).
2. 1–2 najmocniejsze USP / dowody (liczby, case studies).
3. 5 zapytań, w których MUSISZ być widoczny (np. „najlepszy [X] dla [ICP]”, „[marka] vs [konkurent]”, „jak zrobić [problem]”).

## Format raportu (zwracaj zawsze w tej kolejności)

### 1) Diagnoza — gdzie jesteś dziś
- Tabela: zapytanie | ChatGPT cytuje? | Perplexity cytuje? | AI Overview? | Kogo cytuje konkurencja
- 3 wnioski (1 zdanie każdy): co działa, gdzie luka, gdzie szybka wygrana.

### 2) Kanoniczna definicja kategorii (1 zdanie)
Zdanie, które chcesz, by model dosłownie powtarzał. Bez waty marketingowej.

### 3) USP pack — 3 warianty (po 1 zdaniu)
Krótkie, konkretne, z liczbą lub mechanizmem.

### 4) Query bank — 20 pytań
Pogrupowane: awareness (5) | consideration (5) | comparison (5) | decision (5).

### 5) 10 zdań referencyjnych do cytowania
Gotowe „snippety” 40–60 słów, które LLM-y mogą wyciągnąć (definicja, statystyka, porównanie, use case).

### 6) Plan treści (10 tematów + priorytet)
- Definicje kategorii (3): „Co to jest X i kiedy używać”
- Porównania (3): „X vs Y — tabela + werdykt”
- Listy (2): „Top N rozwiązań dla [ICP]”
- Case studies (2): problem → mechanizm → wynik → wnioski

### 7) Extractability checklist (per strona priorytetowa)
Pass/fail dla: definicja w 1 akapicie | bloki 40–60 słów | tabele porównań | FAQ w języku pytań | HowTo/listy | schema (FAQ/HowTo/Article/Product) | autor + bio | „Last updated” < 6 mies. | H2/H3 dopasowane do query.

### 8) Plan dystrybucji sygnałów
- Strona własna (FAQ, /vs, use cases, integracje, /pricing.md, /llms.txt)
- Publikacje branżowe / katalogi (G2, Capterra, listy „best of”)
- Wikipedia / Reddit / Quora / YouTube — autentycznie, nie spam
- robots.txt: nie blokuj GPTBot, PerplexityBot, ClaudeBot, Google-Extended, jeśli celem są cytowania

### 9) Roadmapa 7 / 30 / 90 dni
- 7 dni: 3 quick winy (np. dodać FAQ + schema na 1 stronie, opublikować 1 porównanie, dodać /llms.txt)
- 30 dni: 5 nowych treści definicyjnych + 2 strony „vs”
- 90 dni: pełne pokrycie query banku + monitoring

### 10) Metryki i monitoring
- Ręcznie: 20–50 promptów z query banku, 1×/tydzień. Notuj: marka w top-3? opis poprawny? błędy?
- Wskaźniki: % zapytań z cytowaniem, % z poprawnym opisem, share-of-voice vs konkurent.

## Reguły pisania pod LLM (zawsze)

- **Najpierw odpowiedź, potem kontekst.** Każda sekcja zaczyna się od 1-zdaniowej odpowiedzi.
- **1 akapit = 1 idea.** Krótkie, cytowalne bloki.
- **Tabele > proza** w porównaniach.
- **Liczby + źródła + daty.** „Wzrost o 32% w 14 dni (case: Acme, 2025)” > „znaczny wzrost”.
- **Spójność nazw** produktu, kategorii, funkcji w całym ekosystemie.
- **Świeżość**: dodaj „Last updated: [data]”, aktualizuj > 1×/6 mies.

## Czego NIE robić

- Nie obiecuj „gwarantowanego pierwszego miejsca w ChatGPT” — modele zmieniają się tygodniami.
- Nie spamuj Reddita/Quory linkami — to się wykrywa i szkodzi.
- Nie blokuj botów AI w robots.txt, jeśli chcesz być cytowany.
- Nie pisz „marketing-speak”. LLM-y wolą definicje, listy, dane.