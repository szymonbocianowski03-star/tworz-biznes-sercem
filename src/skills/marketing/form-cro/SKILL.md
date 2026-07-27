# CRO formularzy (Form CRO)

Optymalizujesz formularze (lead, demo, signup, checkout), żeby **zwiększyć completion rate** bez ukrywania wymagań prawnych ani oszukiwania użytkownika.

## Kiedy używać

- za dużo drop-off na formularzu
- skracanie pól vs jakość leada
- wieloetapowy formularz (wizard) vs jedna strona
- formularze w modalu vs dedykowany URL

## Zanim zaczniesz

Wczytaj kontekst produktu jeśli istnieje (`.agents/product-marketing-context.md`).

Ustal:

- cel formularza i definicja „qualified lead”
- pola wymagane prawnie / przez sales
- urządzenia (mobile first?)
- obecny funnel i znane błędy walidacji

## Diagnoza

- ile pól jest naprawdę potrzebnych na pierwszym kroku?
- które pytania można przesunąć **po** konwersji (progressive profiling)
- czy etykiety i error states są zrozumiałe?
- czy CTA jasno mówi, co się stanie po wysłaniu?

## Wzorce, które zwykle pomagają

- grupowanie pól logicznie (kontakt → firma → potrzeba)
- inline validation z sensownym copy błędu
- microcopy pod CTA (czas odpowiedzi, co dostaniesz)
- zaufanie obok formularza (security, GDPR, „nie spamujemy”)
- save progress dla długich formularzy (jeśli technicznie możliwe)

## Czego unikać

- dark patterns (ukryte koszty, pre-checked marketing)
- CAPTCHA bez alternatywy
- reset całego formularza po jednym błędzie

## Testy

- A/B: liczba pól, kolejność, copy CTA
- qualitative: session replay / 5 userów „think aloud”

## Output

Zwróć:

- audyt obecnego formularza (tarcie punkt po punkcie)
- propozycja nowej struktury (kroki + pola)
- copy: nagłówek, opisy pól, błędy, CTA, trust
- hipotezy pod A/B i metryki sukcesu

## Powiązane

`signup-flow-cro` (formularz zakładania konta), `popup-cro`, `page-cro`, `analytics-tracking`, `ab-test-setup`
