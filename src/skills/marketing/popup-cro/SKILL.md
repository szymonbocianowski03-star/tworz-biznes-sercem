# Popup i modale (CRO)

Projektujesz popupy i modale, które **konwertują**, nie irytują i nie niszczą marki.

## Zanim zaczniesz

Wczytaj kontekst produktu (`.agents/product-marketing-context.md` lub `.claude/...`).

Ustal: cel (email, lead magnet, rabat, ogłoszenie, exit save, feature, ankieta), obecne wyniki i trigger’y, skargi, mobile vs desktop, źródła ruchu, nowy vs powracający, typ strony.

## Zasady

1. **Timing** — za wcześnie = irytacja; za późno = utracona szansa; właściwy moment = propozycja przy intencji.
2. **Wartość widoczna** — jasna korzyść, dopasowanie do kontekstu strony.
3. **Szanuj użytkownika** — łatwe zamknięcie, brak pułapek, zapamiętywanie odmowy (cookie/localStorage), nie psuj całej sesji.

## Triggery

| Typ | Kiedy |
|-----|--------|
| Czas | unikaj „5 s”; częściej **30–60 s** po wejściu; testuj |
| Scroll | zwykle **25–50%** głębokości — sygnał zaangażowania (blog, longform) |
| Exit intent | desktop (kursor do zamknięcia); mobile: back, scroll up, alternatywy |
| Klik | zero irytacji — „Pobierz PDF”, demo, magnes |
| Sesja / liczba stron | po X stronach — ścieżka researchu |
| Zachowanie | porzucony koszyk, powrót na pricing, powtarzalne wizyty |

## Typy

- **Email** — jedno pole, konkretna korzyść (nie samo „Subscribe”), opcjonalnie zachęta.
- **Lead magnet** — podgląd okładki / fragmentu, obietnica namacalna, minimum pól.
- **Rabat** — jasna wartość, termin (prawdziwy), jednorazowo na visitora, łatwy kod.
- **Exit** — inna oferta niż na wejściu, krótka odpowiedź na obiekcję, szanuj decyzję wyjścia.
- **Banner** — jedna wiadomość, dismiss, link, nie wiecznie na stronie.
- **Slide-in** — mniej inwazyjny; chat, drugorzędne CTA.

## Design

- hierarchia: headline → wartość → form/CTA → zamknięcie
- desktop często **400–600 px** szerokości; nie zasłaniaj całego ekranu bez potrzeby
- mobile: **nie** pełnoekranowe agresywne overlaye; bottom sheet często lepszy
- **X** widoczny (konwencja prawy górny), duży touch target; „Nie dziękuję” jako tekst
- klik poza modalem — jeśli nie blokuje krytycznego flow

## Copy

- headline: korzyść, pytanie, social proof („Dołącz do X…”)
- subhead: rozwinięcie, „bez spamu”, częstotliwość
- CTA: konkret („Wyślij mi przewodnik”), pierwsza osoba często działa
- odmowa: grzecznie — **unikaj** „Nie, nie chcę oszczędzać”

## Częstotliwość i targetowanie

- max **raz na sesję** typowego popupu; cooldown **7–30 dni** po dismiss
- inne komunikaty dla nowych vs powracających; message match do źródła (UTM)
- wyklucz: checkout, właśnie skonwertowanych, świeżo odrzuciłych
- nie pokazuj w środku kluczowej ścieżki

## Zgodność i dostępność

- RODO: zgoda, link do polityki, **nie** pre-check marketingu
- a11y: Tab, Enter, Esc, focus trap, kontrast, nie tylko kolor
- **Google:** inwazyjne interstitiale na mobile szkodzą SEO; unikaj pełnego ekranu przed treścią

## Metryki

impresje, CR (submit/impresja), close rate, czas do zamknięcia, interakcje przed zamknięciem. Orientacyjnie: email popup ~2–5%, exit ~3–10%, click-trigger wyżej.

## Output

typ, trigger, targetowanie, frequency cap, copy (H1, sub, CTA, odmowa), notatki layout/mobile, reguły konfliktów przy wielu popupach, hipotezy A/B.

## Powiązane

`lead-magnets`, `form-cro`, `page-cro`, `email-sequence-design`, `ab-test-setup`, `marketing-psychology`
