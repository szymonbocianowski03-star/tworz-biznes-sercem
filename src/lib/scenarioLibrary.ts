import type { ComponentType } from "react";
import { Compass, Megaphone, Pencil, Mail, BarChart3, FolderOpen } from "lucide-react";

export type ScenarioCategory =
  | "Strategy"
  | "Ads"
  | "Content"
  | "Email"
  | "Analysis"
  | "Launch";

export type ScenarioRunKind = "chat" | "image" | "video-page" | "assets-page";

export type Scenario = {
  id: string;
  category: ScenarioCategory;
  title: string;
  goal: string;
  timeEstimate: string;
  requiredInputs: string[];
  starterPrompt: string;
  nextActions: string[];
  /** Domyślne zachowanie po kliknięciu kafelka */
  runKind?: ScenarioRunKind;
  /** Krótki opis do generatora grafiki (runKind: image) */
  imagePromptSeed?: string;
};

export const CATEGORY_META: Record<
  ScenarioCategory,
  { label: string; icon: ComponentType<{ className?: string; strokeWidth?: number }> }
> = {
  Strategy: { label: "Strategia", icon: Compass },
  Ads: { label: "Kampanie reklamowe", icon: Megaphone },
  Content: { label: "Treści i grafiki", icon: Pencil },
  Email: { label: "Wiadomości i mailing", icon: Mail },
  Analysis: { label: "Wyniki i raporty", icon: BarChart3 },
  Launch: { label: "Premiera", icon: FolderOpen },
};

function withInstructions(body: string) {
  return [
    body.trim(),
    "",
    "INSTRUKCJE DLA ASYSTENTA:",
    "- Najpierw sprawdź, czy mam wszystkie wymagane dane. Jeśli nie — zadaj maksymalnie 3 krótkie pytania (tylko o brakujące rzeczy).",
    "- Nie dopisuj założeń po cichu. Jeśli musisz założyć coś — wypisz ZAŁOŻENIA wprost i poproś o potwierdzenie.",
    "- Wynik zwróć w blokach: (1) Podsumowanie, (2) Materiały do wdrożenia, (3) Następne kroki.",
    "- Pisz po polsku, prostym językiem — bez angielskiego żargonu (np. zamiast „workflow” pisz „plan działań”).",
  ].join("\n");
}

function withPolishConsumerLlmReport(body: string) {
  return [
    body.trim(),
    "",
    "INSTRUKCJE DLA ASYSTENTA (ton: przedsiębiorca w Polsce):",
    "- Pisz pełnymi, naturalnymi zdaniami. Każda sekcja ma krótki wstęp: o co chodzi i dlaczego to ważne.",
    "- Gdy musisz użyć nazwy zagranicznego produktu, dodaj krótkie polskie wyjaśnienie.",
    "- Po tabelach dodaj 2–4 zdania komentarza: co z nich wynika dla mojej marki.",
  ].join("\n");
}

export const SCENARIOS: Scenario[] = [
  // —— Strategia ——
  {
    id: "strategy-positioning-snapshot",
    category: "Strategy",
    title: "Szybkie pozycjonowanie",
    goal: "Ustal, jak marka ma być przedstawiana klientom i czym ma się wyróżniać.",
    timeEstimate: "8–10 min",
    requiredInputs: ["Produkt", "Klient idealny", "Problem klienta", "Przewaga"],
    nextActions: ["analysis-landing-page-teardown", "ads-paid-social-creative-sprint"],
    starterPrompt: withInstructions(`
Ułóż szybkie pozycjonowanie marki dla Marketing Now.

Produkt / usługa: [wpisz]
Klient idealny: [wpisz]
Największy problem klienta: [wpisz]
Alternatywy (co robi dziś): [konkurenci / arkusze / agencja / własny proces]
Dlaczego wygrywamy: [1–3 przewagi]
Dowody (opinie, liczby, realizacje): [wpisz]

Wynik:
- jedno zdanie o kategorii rynku,
- zdanie pozycjonowania,
- 3 filary komunikacji + przykładowe dowody,
- 5 typowych obiekcji + odpowiedzi,
- nagłówek i podtytuł na stronę główną,
- jedno zdanie „windykacyjne” do rozmowy sprzedażowej.
`),
  },
  {
    id: "strategy-icp-priority-matrix",
    category: "Strategy",
    title: "Profil idealnego klienta",
    goal: "Wybierz grupy klientów, do których warto kierować sprzedaż i reklamy w pierwszej kolejności.",
    timeEstimate: "10–12 min",
    requiredInputs: ["Grupy klientów", "Zastosowanie produktu", "Model sprzedaży", "Priorytety"],
    nextActions: ["ads-paid-search-message-builder", "content-editorial-calendar-builder"],
    starterPrompt: withInstructions(`
Zbuduj matrycę priorytetów grup docelowych dla Marketing Now.

Kandydackie segmenty: [lista]
Główne zastosowanie produktu: [wpisz]
Model sprzedaży: [samodzielny zakup / sprzedaż z konsultantem / mieszany]
Dowody z rynku: [klienci, rozmowy, pipeline, notatki]

Oceń segmenty w skali 1–5: pilność problemu, skłonność do zmiany, trudność wdrożenia, potencjał przychodu, możliwość rozwoju, łatwość dotarcia.
Na końcu: wskaż 1 główną grupę + 1 drugorzędną oraz kąt komunikacji dla każdej.
`),
  },
  {
    id: "strategy-north-star-metrics-tree",
    category: "Strategy",
    title: "Główna metryka wzrostu",
    goal: "Ustal najważniejszy wskaźnik sukcesu oraz metryki pomocnicze, które warto śledzić.",
    timeEstimate: "10–15 min",
    requiredInputs: ["Główny wskaźnik", "Zachowania klientów", "Dane do analizy", "Cele"],
    nextActions: ["analysis-funnel-drop-off-diagnosis", "email-welcome-activation-sequence"],
    starterPrompt: withInstructions(`
Zbuduj drzewo metryk wzrostu dla Marketing Now.

Moment, w którym klient odczuwa wartość: [wpisz]
Kluczowe zachowania (np. pierwsza kampania, pierwsza kreacja): [lista]
Co już mierzymy: [lista wskaźników / zdarzeń]
Model biznesowy: [okres próbny / subskrypcja / sprzedaż z konsultantem]

Wynik:
- jeden główny wskaźnik sukcesu (definicja + wzór),
- metryki wejściowe (drzewo zależności),
- granice bezpieczeństwa (czego nie psujemy przy optymalizacji),
- definicje zdarzeń do śledzenia,
- szkic raportu tygodniowego (sekcje + częstotliwość).
Unikaj „metryk dla metryk” — tylko to, co wpływa na przychód lub retencję.
`),
  },
  {
    id: "strategy-funnel-friction-map",
    category: "Strategy",
    title: "Mapa problemów w sprzedaży",
    goal: "Znajdź miejsca, w których klienci odpadają, i zaproponuj testy poprawiające wyniki.",
    timeEstimate: "12–15 min",
    requiredInputs: ["Etapy sprzedaży", "Konwersje", "Źródła ruchu", "Testy"],
    nextActions: ["analysis-landing-page-teardown", "ads-experiment-designer"],
    starterPrompt: withInstructions(`
Zrób mapę problemów na ścieżce sprzedaży dla Marketing Now.

Etapy: [wizyta → rejestracja → onboarding → aktywacja → płatność] (lub Twoje)
Dane konwersji: [liczby / % na etap]
Źródła ruchu: [kanały]
Notatki jakościowe: [rozmowy, support, obiekcje]

Wynik:
- największy spadek konwersji + co klient musi zrozumieć w tym kroku,
- 5 hipotez przyczyn (z oceną pewności),
- 3 sensowne testy lub poprawki (szybkie vs większe),
- jak mierzyć efekt (wskaźniki + horyzont czasu).
`),
  },

  // —— Kampanie reklamowe ——
  {
    id: "ads-paid-search-message-builder",
    category: "Ads",
    title: "Reklamy w wyszukiwarce",
    goal: "Przygotuj nagłówki i opisy do kampanii w Google i podobnych sieciach.",
    timeEstimate: "10–12 min",
    requiredInputs: ["Słowa kluczowe", "Oferta", "Dowody", "Strona docelowa"],
    nextActions: ["analysis-landing-page-teardown", "ads-experiment-designer"],
    starterPrompt: withInstructions(`
Zbuduj pakiet reklam w wyszukiwarce dla Marketing Now.

Grupy tematów / słowa kluczowe: [lista]
Intencja użytkownika: [co chce rozwiązać]
Oferta: [okres próbny / demo / konsultacja]
Dowody: [liczby, realizacje, opinie]
Strona docelowa: [adres lub opis]

Wynik:
- propozycja grup reklam,
- 12–15 nagłówków (różne),
- 4–6 opisów,
- propozycje rozszerzeń (linki, wyróżniki),
- checklista zgodności ze stroną docelową.
`),
  },
  {
    id: "ads-paid-social-creative-sprint",
    category: "Ads",
    title: "Kreacje do social media",
    goal: "Wymyśl kąty przekazu i briefy pod reklamy w Meta, TikTok lub LinkedIn.",
    timeEstimate: "10–15 min",
    requiredInputs: ["Odbiorcy", "Oferta", "Dowody", "Ton", "Format"],
    nextActions: ["ads-experiment-designer", "content-short-form-hook-lab"],
    starterPrompt: withInstructions(`
Zrób sprint kreacji reklamowych w social media dla Marketing Now.

Grupa docelowa: [segment]
Główny problem: [wpisz]
Oferta: [okres próbny / demo / premiera]
Dowody: [wynik, liczba, przykład]
Ton: [bezpośredni / ekspercki / spokojny]
Formaty: [grafika / wideo krótkie / karuzela]

Wynik:
- 3 kąty reklamowe,
- dla każdego: haczyk → treść → wezwanie do działania,
- wskazówki wizualne (statyczna grafika + krótki film),
- jeden sensowny test A/B (co zmieniamy i co mierzymy).
`),
  },
  {
    id: "ads-creative-bundle",
    category: "Ads",
    title: "Stwórz zestaw reklam",
    goal: "Wygeneruj kilka wariantów tekstów i grafik do jednej kampanii.",
    timeEstimate: "12–15 min",
    requiredInputs: ["Nagłówki", "Teksty reklam", "Grafiki", "Test A/B"],
    nextActions: ["content-generate-graphic", "ads-experiment-designer"],
    starterPrompt: withInstructions(`
Przygotuj zestaw reklam (teksty + briefy graficzne) do jednej kampanii Marketing Now.

Produkt / oferta: [wpisz]
Grupa docelowa: [wpisz]
Kanał: [Meta / Google / LinkedIn / TikTok]
Cel kampanii: [kliknięcia / rejestracje / sprzedaż]
Budżet orientacyjny: [opcjonalnie]

Wynik:
- 3 warianty nagłówka + tekstu głównego + wezwania do działania (po polsku),
- dla każdego wariantu: krótki brief graficzny (kadr, nastrój, tekst na obrazie),
- propozycja testu A/B (co porównujemy, jak długo, jaki wskaźnik),
- na końcu wstaw znaczniki [IMG: opis kreacji po polsku] dla 2–3 najlepszych koncepcji graficznych.
`),
  },
  {
    id: "ads-experiment-designer",
    category: "Ads",
    title: "Projekt testu A/B",
    goal: "Zamień pomysł na przejrzysty test z jasnymi zasadami decyzji.",
    timeEstimate: "10–12 min",
    requiredInputs: ["Wariant bazowy", "Jedna zmiana", "Odbiorcy", "Główny wskaźnik"],
    nextActions: ["analysis-campaign-readout-builder", "analysis-funnel-drop-off-diagnosis"],
    starterPrompt: withInstructions(`
Zaprojektuj test A/B kampanii płatnej dla Marketing Now.

Wariant obecny (kontrola): [wpisz]
Jedna zmiana do testu: [kąt / nagłówek / dowód / wezwanie / grupa / oferta]
Grupa docelowa: [segment]
Główny wskaźnik: [kliknięcia / koszt rejestracji / konwersja]
Ograniczenia: [budżet, jakość leadów, ton marki]
Czas testu: [dni] + budżet: [kwota]

Wynik:
- hipoteza,
- opis wariantów,
- checklista wdrożenia,
- szablon raportu,
- kiedy kończyć test i co robić przy remisie.
Jeśli proponuję więcej niż jedną zmianę naraz — zawęź test.
`),
  },
  {
    id: "ads-retargeting-recovery-sequence",
    category: "Ads",
    title: "Sekwencja remarketingu",
    goal: "Ułóż 3 kroki remarketingu z coraz mocniejszym przekazem.",
    timeEstimate: "12–15 min",
    requiredInputs: ["Zachowanie odbiorców", "Obiekcje", "Dowody", "Cel"],
    nextActions: ["email-demo-follow-up-sequence", "analysis-funnel-drop-off-diagnosis"],
    starterPrompt: withInstructions(`
Zbuduj sekwencję remarketingu (3 kroki) dla Marketing Now.

Zachowanie odbiorców: [oglądali cennik / porzucili koszyk / oglądali demo]
Główna obiekcja: [cena / brak zaufania / złożoność / timing]
Dowody: [opinia, wynik, zrzut ekranu]
Docelowa akcja: [rejestracja / demo / dokończenie konfiguracji]

Wynik:
- 3 reklamy: przekaz + wezwanie + notatki kreatywne,
- eskalacja: przypomnienie → dowód → wezwanie do działania,
- wykluczenia i okno czasowe,
- jak mierzyć skuteczność.
`),
  },

  // —— Treści i grafiki ——
  {
    id: "content-generate-graphic",
    category: "Content",
    title: "Wygeneruj grafikę",
    goal: "Stwórz obraz reklamowy, baner, miniaturę albo kreację do kampanii.",
    timeEstimate: "2–5 min",
    requiredInputs: ["Grafika reklamowa", "Baner", "Social media", "Zapisz do zasobów"],
    nextActions: ["ads-creative-bundle"],
    runKind: "image",
    imagePromptSeed:
      "Nowoczesna kreacja reklamowa na social media: czytelny nagłówek po polsku, produkt lub usługa w centrum, czyste tło, profesjonalne światło",
    starterPrompt: withInstructions(`
Pomóż mi doprecyzować brief grafiki reklamowej, a następnie przygotuj opis do generacji obrazu.

Typ: [baner / post / miniatura / story]
Produkt: [wpisz]
Grupa docelowa: [wpisz]
Ton: [spokojny / energiczny / premium]
Tekst na grafice (po polsku): [nagłówek + ewentualne CTA]
Format: [kwadrat / pion / poziom]

Na końcu podaj jeden gotowy opis sceny w jednym akapicie (do generatora grafiki) oraz znacznik [IMG: ten sam opis].
`),
  },
  {
    id: "content-generate-video",
    category: "Content",
    title: "Wygeneruj wideo",
    goal: "Przygotuj krótki film reklamowy, scenariusz lub materiał do publikacji.",
    timeEstimate: "5–15 min",
    requiredInputs: ["Wideo reklamowe", "Reels/TikTok", "Storyboard", "Zapisz do zasobów"],
    nextActions: ["content-short-form-hook-lab"],
    runKind: "video-page",
    starterPrompt: withInstructions(`
Przygotuj brief i scenariusz krótkiego wideo reklamowego (Reels / TikTok / Stories).

Produkt: [wpisz]
Grupa docelowa: [wpisz]
Długość: [np. 15 s / 30 s]
Styl: [UGC / produktowe / opinia klienta]
Haczyk na pierwsze 2 sekundy: [pomysł]
Główna obietnica: [wpisz]
Wezwanie do działania: [wpisz]

Wynik:
- storyboard (ujęcie po ujęciu),
- tekst lektora / napisy na ekranie (po polsku),
- gotowy opis sceny do pola „prompt” w generatorze wideo (jeden akapit).
`),
  },
  {
    id: "content-editorial-calendar-builder",
    category: "Content",
    title: "Kalendarz treści",
    goal: "Zamień cele marketingowe na konkretny plan publikacji.",
    timeEstimate: "12–15 min",
    requiredInputs: ["Cel", "Grupa docelowa", "Tematy", "Kanały", "Częstotliwość"],
    nextActions: ["content-hero-asset-repurposer", "content-founder-pov-studio"],
    starterPrompt: withInstructions(`
Zbuduj kalendarz treści na 4 tygodnie dla Marketing Now.

Główny cel: [leady / rejestracje / rozpoznawalność / edukacja]
Grupa docelowa: [wpisz]
Tematy (3–5): [lista]
Kanały: [blog / social / wideo / newsletter]
Częstotliwość: [tygodniowo / 2× w tyg.]
Ważne daty: [premiery, święta, eventy]

Wynik: tabela z tytułem, formatem, kanałem, wezwaniem do działania i szkicem treści dla 4 najważniejszych pozycji.
`),
  },
  {
    id: "content-hero-asset-repurposer",
    category: "Content",
    title: "Przeróbka głównego materiału",
    goal: "Rozbij jeden mocny materiał na wiele formatów i kanałów.",
    timeEstimate: "10–15 min",
    requiredInputs: ["Materiał źródłowy", "Grupa docelowa", "Kanały", "Cel"],
    nextActions: ["ads-paid-social-creative-sprint", "email-welcome-activation-sequence"],
    starterPrompt: withInstructions(`
Przerób główny materiał Marketing Now na zestaw formatów.

Źródło (tekst, URL, transkrypt): [wklej]
Grupa docelowa: [wpisz]
Kanały: [lista]
Cel: [aktywacja / pozyskanie popytu / premiera]

Wynik:
- mapa: z czego powstaje który format,
- 8–12 konkretnych pomysłów (tytuł + haczyk),
- szkic posta na LinkedIn i szkic maila,
- 3 haczyki do krótkiego wideo,
- kolejność publikacji z uzasadnieniem.
`),
  },
  {
    id: "content-short-form-hook-lab",
    category: "Content",
    title: "Haczyki do krótkich filmów",
    goal: "Przygotuj haczyki i scenariusze do Reels, TikToka i Shorts.",
    timeEstimate: "8–12 min",
    requiredInputs: ["Temat", "Problem", "Dowód", "Wezwanie", "Ton"],
    nextActions: ["ads-paid-social-creative-sprint", "content-generate-video"],
    starterPrompt: withInstructions(`
Zrób zestaw haczyków do krótkich filmów dla Marketing Now.

Temat: [wpisz]
Problem odbiorcy: [wpisz]
Dowód / kąt: [wynik, błąd, spostrzeżenie]
Wezwanie do działania: [rejestracja / strona / demo]
Ton: [bezpośredni / merytoryczny / spokojny]

Wynik:
- 10 haczyków na start,
- 3 scenariusze (haczyk → rozwinięcie → zakończenie),
- 5 podpisów pod post,
- proste wskazówki ujęć.
`),
  },
  {
    id: "content-founder-pov-studio",
    category: "Content",
    title: "Głos założyciela / eksperta",
    goal: "Zbuduj mocny post ekspercki i serię uzupełnień.",
    timeEstimate: "10–12 min",
    requiredInputs: ["Teza", "Dowody", "Grupa docelowa", "Wezwanie", "Ton"],
    nextActions: ["content-editorial-calendar-builder", "email-demo-follow-up-sequence"],
    starterPrompt: withInstructions(`
Zbuduj pakiet treści „głos założyciela” dla Marketing Now.

Teza / opinia: [wpisz]
Dlaczego wiarygodne: [doświadczenie, dane, przykłady]
Grupa docelowa: [wpisz]
Wezwanie: [komentarz / zapis / demo]
Ton: [profesjonalny, bez żartów]

Wynik:
- jeden główny post (LinkedIn),
- 3 tematy kontynuacji z haczykami,
- szkic karuzeli,
- 8 krótkich odpowiedzi na typowe komentarze i obiekcje.
`),
  },

  // —— Wiadomości i mailing ——
  {
    id: "email-welcome-activation-sequence",
    category: "Email",
    title: "Powitanie i aktywacja",
    goal: "Poprowadź nowego użytkownika do pierwszej realnej wartości z produktu.",
    timeEstimate: "12–15 min",
    requiredInputs: ["Źródło zapisu", "Cel aktywacji", "Okres próbny", "Pytania", "Ton"],
    nextActions: ["analysis-funnel-drop-off-diagnosis", "analysis-campaign-readout-builder"],
    starterPrompt: withInstructions(`
Ułóż sekwencję maili powitalnych i aktywacyjnych dla Marketing Now.

Skąd się zapisuje: [strona / lead magnet / demo]
Co oznacza „aktywacja”: [np. pierwsza kampania, pierwsza kreacja]
Okres próbny: [dni]
Najczęstsze pytania: [lista]
Ton: [jasny, konkretny]

Wynik:
- harmonogram wysyłek,
- temat + zajawka + treść 3–5 maili,
- cel każdego maila,
- 2 propozycje testów tematów.
`),
  },
  {
    id: "email-demo-follow-up-sequence",
    category: "Email",
    title: "Kontakt po prezentacji",
    goal: "Domknij następny krok po rozmowie sprzedażowej lub demo.",
    timeEstimate: "10–12 min",
    requiredInputs: ["Notatki", "Problemy", "Następny krok", "Dowody", "Obiekcje"],
    nextActions: ["strategy-positioning-snapshot", "analysis-landing-page-teardown"],
    starterPrompt: withInstructions(`
Zbuduj sekwencję maili po prezentacji produktu dla Marketing Now.

Typ klienta: [segment]
Problemy z rozmowy: [lista]
Co zainteresowało: [lista]
Następny krok: [okres próbny / wycena / decyzja zarządu]
Otwarte obiekcje: [lista]

Wynik: 3 maile (podsumowanie → dowód → domknięcie) z tematami i krótkimi przypomnieniami do odpowiedzi.
`),
  },
  {
    id: "email-feature-adoption-rescue",
    category: "Email",
    title: "Przypomnienie o funkcji",
    goal: "Odzyskaj użytkowników, którzy nie wykonali kluczowej akcji.",
    timeEstimate: "10–12 min",
    requiredInputs: ["Brakująca akcja", "Funkcja", "Korzyść", "Moment wysyłki"],
    nextActions: ["analysis-funnel-drop-off-diagnosis", "content-short-form-hook-lab"],
    starterPrompt: withInstructions(`
Zrób krótką sekwencję „ratunkową” dla Marketing Now.

Czego nie zrobili: [wpisz]
Co promujemy: [funkcja]
Jaka korzyść: [wpisz]
Kiedy wysłać: [np. 2 dni po rejestracji]
Przykład / liczba: [dowód]

Wynik: 1–3 krótkie maile, warunki wysyłki i proste kroki „jak to zrobić”.
`),
  },
  {
    id: "email-win-back-flow",
    category: "Email",
    title: "Reaktywacja nieaktywnych",
    goal: "Przywróć kontakt z użytkownikami lub klientami, którzy przestali korzystać.",
    timeEstimate: "12–15 min",
    requiredInputs: ["Definicja nieaktywności", "Segment", "Nowości", "Oferta powrotu"],
    nextActions: ["analysis-segment-comparison-brief", "strategy-icp-priority-matrix"],
    starterPrompt: withInstructions(`
Zbuduj sekwencję reaktywacyjną dla Marketing Now.

Nieaktywność: [np. 14 dni bez logowania]
Segment: [okres próbny / byli klienci / zespoły]
Co się zmieniło w produkcie: [lista]
Powód powrotu / oferta: [funkcja / szkolenie / bonus]

Wynik:
- 3 maile (harmonogram + tematy + treść),
- jasna opcja rezygnacji z maili,
- podział: kto dostaje którą wersję.
`),
  },

  // —— Wyniki i raporty ——
  {
    id: "analysis-landing-page-teardown",
    category: "Analysis",
    title: "Audyt strony docelowej",
    goal: "Znajdź bariery konwersji w przekazie i układzie strony.",
    timeEstimate: "12–15 min",
    requiredInputs: ["Adres lub treść", "Grupa docelowa", "Cel", "Źródło ruchu"],
    nextActions: ["strategy-funnel-friction-map", "ads-paid-search-message-builder"],
    starterPrompt: withInstructions(`
Zrób audyt strony docelowej Marketing Now.

Adres lub wklejona treść: [wpisz]
Grupa docelowa: [wpisz]
Cel: [rejestracja / demo / lista oczekujących]
Skąd ruch: [płatne / organiczne / bezpośredni]

Wynik:
- co działa / co szkodzi,
- 10 rekomendacji (priorytet + wpływ),
- propozycja nowego nagłówka, podtytułu i przycisku,
- checklista sekcji „nad foldem”.
`),
  },
  {
    id: "analysis-campaign-readout-builder",
    category: "Analysis",
    title: "Podsumowanie kampanii",
    goal: "Zamień liczby z kampanii na wnioski i konkretne decyzje.",
    timeEstimate: "10–12 min",
    requiredInputs: ["Okres", "Kanały", "Wydatki i wyniki", "Cel"],
    nextActions: ["ads-experiment-designer", "analysis-segment-comparison-brief"],
    starterPrompt: withInstructions(`
Zrób podsumowanie kampanii marketingowej dla Marketing Now.

Okres: [daty]
Kanały: [lista]
Wydatki i wyniki: [metryki]
Cel biznesowy: [rejestracje / demo / przychód / pipeline]
Kontekst: [zmiany kreacji, oferty, sezonu, śledzenia]

Wynik:
- podsumowanie w 6 punktach,
- co działało / co nie i dlaczego,
- największe ryzyka,
- 3 decyzje + 5 kolejnych kroków.
`),
  },
  {
    id: "analysis-funnel-drop-off-diagnosis",
    category: "Analysis",
    title: "Gdzie odpadają klienci",
    goal: "Wskaż krok, na którym użytkownicy rezygnują, i dlaczego.",
    timeEstimate: "12–15 min",
    requiredInputs: ["Kroki", "Dane", "Segmenty", "Notatki"],
    nextActions: ["strategy-funnel-friction-map", "email-feature-adoption-rescue"],
    starterPrompt: withInstructions(`
Zdiagnozuj spadki konwersji na ścieżce Marketing Now.

Kroki: [lista]
Okres: [daty]
Segmenty: [źródło / urządzenie / grupa]
Dane: [wskaźniki lub liczby]
Notatki: [zrzuty, feedback, rozmowy]

Wynik:
- największy spadek (liczbowo),
- hipotezy i co sprawdzić,
- 5 testów lub poprawek (priorytet),
- plan pomiaru.
`),
  },
  {
    id: "analysis-segment-comparison-brief",
    category: "Analysis",
    title: "Porównanie segmentów",
    goal: "Porównaj grupy klientów lub kanały i zasugeruj przesunięcie budżetu.",
    timeEstimate: "10–12 min",
    requiredInputs: ["Segmenty", "Wskaźniki", "Cel", "Okres"],
    nextActions: ["strategy-icp-priority-matrix", "ads-paid-social-creative-sprint"],
    starterPrompt: withInstructions(`
Porównaj segmenty marketingowe dla Marketing Now.

Segmenty: [lista]
Dostępne wskaźniki: [koszt pozyskania / konwersja / aktywacja / przychód]
Cel: [efektywność / wzrost / utrzymanie]
Okres: [daty]

Wynik:
- ranking segmentów,
- dlaczego lider wygrywa,
- kompromisy,
- gdzie przenieść budżet i jak zmienić przekaz.
`),
  },
  {
    id: "analysis-llm-visibility",
    category: "Analysis",
    title: "Widoczność w asystentach AI",
    goal: "Sprawdź, jak często marka pojawia się w odpowiedziach chatów AI i co poprawić.",
    timeEstimate: "12–18 min",
    requiredInputs: ["Produkt", "Grupa docelowa", "Konkurenci", "Priorytet działań"],
    nextActions: ["content-editorial-calendar-builder", "analysis-landing-page-teardown"],
    starterPrompt: withPolishConsumerLlmReport(`
Zrób raport widoczności mojej marki w odpowiedziach asystentów sztucznej inteligencji (np. ChatGPT, Perplexity, Gemini, Copilot, podpowiedzi Google).

Produkt / adres strony: [wpisz]
Grupa docelowa: [wpisz]
Konkurenci / alternatywy: [lista]
Priorytet: [SEO / PR / treści / wszystkie]

Wynik (pełnymi zdaniami po polsku):
- ok. 20 przykładowych pytań klientów w czacie AI (pogrupowane po etapie zakupu),
- jakie treści są dziś cytowane w kategorii i gdzie jest luka dla mojej marki,
- plan na 30 dni (priorytet, wysiłek, wpływ),
- rekomendacje FAQ, instrukcji krok po kroku, aktualności treści,
- ok. 10 tematów artykułów lub podstron zwiększających szansę wzmianki o marce.
`),
  },

  // —— Premiera ——
  {
    id: "launch-launch-readiness-command-sheet",
    category: "Launch",
    title: "Checklista przed premierą",
    goal: "Ułóż listę zadań, odpowiedzialnych i kryteriów „start / stop”.",
    timeEstimate: "12–15 min",
    requiredInputs: ["Typ premiery", "Data", "Grupa docelowa", "Kanały", "Ryzyka"],
    nextActions: ["launch-release-narrative-builder", "launch-launch-week-orchestrator"],
    starterPrompt: withInstructions(`
Zrób checklistę gotowości do premiery Marketing Now.

Typ: [funkcja / produkt / cennik / integracja]
Data: [data]
Grupa docelowa: [wpisz]
Kanały: [lista]
Odpowiedzialni: [role]
Ryzyka: [lista]

Wynik:
- checklista wg obszarów (produkt, marketing, sprzedaż, support),
- harmonogram T‑14…T+7,
- sygnały ostrzegawcze,
- kryteria decyzji start / odroczenie.
`),
  },
  {
    id: "launch-release-narrative-builder",
    category: "Launch",
    title: "Komunikat premiery",
    goal: "Przygotuj spójny przekaz na stronę, mail i social media.",
    timeEstimate: "10–12 min",
    requiredInputs: ["Nowość", "Grupa docelowa", "Problem", "Dlaczego teraz", "Dowody"],
    nextActions: ["content-hero-asset-repurposer", "ads-paid-search-message-builder"],
    starterPrompt: withInstructions(`
Zbuduj komunikat premiery dla Marketing Now.

Co wprowadzamy: [funkcja / oferta]
Grupa docelowa: [wpisz]
Problem: [wpisz]
Dlaczego teraz: [timing]
Dowody: [wpisz]
Wezwanie do działania: [rejestracja / upgrade / demo]

Wynik:
- nagłówek + podtytuł,
- 3 argumenty z dowodami,
- 5 obiekcji + odpowiedzi,
- FAQ (5 pytań),
- 2–3 warianty przycisku / CTA.
`),
  },
  {
    id: "launch-launch-week-orchestrator",
    category: "Launch",
    title: "Plan tygodnia premiery",
    goal: "Rozpisz dzień po dniu publikacje i działania w tygodniu startu.",
    timeEstimate: "12–15 min",
    requiredInputs: ["Data", "Kanały", "Materiały", "Odpowiedzialni", "Cel"],
    nextActions: ["analysis-campaign-readout-builder", "launch-week-one-momentum-planner"],
    starterPrompt: withInstructions(`
Ułóż plan tygodnia premiery Marketing Now.

Data startu: [data]
Główne wezwanie: [akcja]
Kanały: [mail / social / płatne / strona / sprzedaż]
Materiały: [lista]
Odpowiedzialni: [role]

Wynik:
- plan D‑1…D+6 (co wychodzi kiedy),
- zależności między kanałami,
- plan B przy słabych / mocnych wynikach,
- wskaźniki do codziennego sprawdzenia.
`),
  },
  {
    id: "launch-week-one-momentum-planner",
    category: "Launch",
    title: "Plan na pierwszy tydzień po starcie",
    goal: "Wykorzystaj sygnały z pierwszych dni i zaplanuj kolejne ruchy.",
    timeEstimate: "10–12 min",
    requiredInputs: ["Wyniki", "Sygnały pozytywne", "Obiekcje", "Cel tygodnia"],
    nextActions: ["analysis-funnel-drop-off-diagnosis", "email-win-back-flow"],
    starterPrompt: withInstructions(`
Zrób plan działań na pierwszy tydzień po premierze Marketing Now.

Wczesne wyniki: [ruch, rejestracje, aktywacja, odpowiedzi]
Co działa najlepiej: [lista]
Główne obiekcje: [lista]
Cel na tydzień: [więcej rejestracji / lepsza aktywacja / więcej sprzedaży]

Wynik:
- plan 5 dni (treści + mail + płatne + sprzedaż),
- priorytety pomiaru,
- 3 rzeczy do wzmocnienia i 3 do naprawy od razu.
`),
  },
];
