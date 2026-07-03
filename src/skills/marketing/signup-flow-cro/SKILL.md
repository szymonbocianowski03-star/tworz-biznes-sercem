# CRO ścieżki rejestracji (signup)

Optymalizujesz **rejestrację / signup**, żeby obniżyć tarcie, podnieść completion i przygotować usera do aktywacji.

## Zanim zaczniesz

Wczytaj `.agents/product-marketing-context.md` (lub `.claude/...`).

Ustal: typ (trial, freemium, płatne, waitlist), B2B vs B2C, liczba kroków, pola, completion rate, drop-off, co jest **naprawdę** wymagane przed pierwszym użyciem, compliance, co dzieje się zaraz po submit.

## Zasady

1. **Minimum wymaganych pól** — każde pole obniża konwersję; reszta przez progressive profiling lub później.
2. **Wartość przed pełnym commitment** — demo, podgląd, „value first” gdy możliwe.
3. **Niski wysiłek postrzegany** — progress bar, grupowanie pól, defaults, prefill.
4. **Brak niespodzianek** — „~30 sekund”, co będzie po zapisie, czy wymagany jest email verify.

## Priorytet pól (typowo)

- **Niezbędne:** email (lub telefon), hasło / magic link  
- **Często:** imię  
- **Odłóż:** firma, rola, wielkość zespołu, telefon, adres — chyba że produkt tego wymusza

## Pola — dobre praktyki

- **Email:** jedno pole (bez „powtórz email”), inline validation, literówki (np. domena), jasne błędy.
- **Hasło:** pokazuj/ukryj, wymagania widoczne z góry lub meter, **nie blokuj wklejania**.
- **Imię:** jedno „Pełne imię” vs split — testuj; opcjonalne jeśli nieużywane od razu.
- **Social login:** widocznie dla audience (Google/Apple B2C; Google/Microsoft B2B).
- **Telefon:** odkładaj, chyba że SMS/krytyczny use case — wyjaśnij dlaczego.
- **Firma:** odkładaj; auto-suggest; wnioskowanie z domeny maila.

## Jedna vs wieloetapowy formularz

- **Jeden ekran:** mało pól (≤3), prosty B2C, wysoka intencja.
- **Wiele kroków:** więcej danych, segmentacja B2B — progress, łatwe kroki na początku, wstecz, **zapis postępu** (refresh nie gubi danych).

Wzorzec: email → hasło + imię → (opcjonalnie) pytania segmentacyjne.

## Zaufanie i błędy

„Bez karty” jeśli prawda, krótka notka prywatności, opcjonalnie social proof przy formularzu.

Inline errors, **nie czyść całego formularza** po błędzie, focus na polu z problemem. Etykiety widoczne (nie tylko placeholder).

## Mobile

Touch ≥44px, właściwy typ klawiatury, autofill, jedna kolumna, sticky CTA, test na urządzeniach.

## Po wysłaniu

Potwierdzenie, następny krok; verify maila — instrukcja, resend, spam, zmiana emaila. Rozważ opóźnienie weryfikacji lub eksplorację przed „twarde” verify.

## Metryki

Start formularza, completion, drop-off per pole/krok, czas, błędy per pole, mobile vs desktop, udział SSO vs email.

## Output

Lista usterek (issue / impact / fix / priority), quick wins vs większe zmiany, hipotezy A/B, opcjonalnie redesign: zestaw pól, kolejność, copy labeli/CTA/błędów.

## Wzorce

- **B2B trial:** email+hasło (lub Google) → opcjonalnie firma → onboarding.  
- **B2C:** Apple/Google lub email → produkt → profil później.  
- **Waitlista:** często sam email + opcjonalnie 1 pytanie.  
- **E-commerce:** guest checkout domyślnie; konto po zakupie.

## Powiązane

`onboarding-cro`, `form-cro`, `page-cro`, `ab-test-setup`
