/** Domyślny szablon reguł wizualnych (edytowalny przez użytkownika). */
export const DEFAULT_BRAND_VISUAL_RULES = `## Nastrój i atmosfera
**Słowa kluczowe:** dramatyczny, premium, minimalistyczny.

Ciemne, niemal czarne tło daje kinowy efekt „ujawnienia produktu” — pewny siebie, technologiczny. Produkt jest jedynym bohaterem: bez lifestyle’u, bez ludzi, bez rekwizytów. Światło subtelne i chłodne, delikatnie podświetla krawędzie urządzenia i ekran bez ostrych refleksów. Całość jest poważna, profesjonalna i w stylu SaaS — sophistykcja przez wstrzemięźliwość.

## Paleta i powierzchnie
- Tło: głęboka czerń lub bardzo ciemny grafit (spójnie w całej komunikacji).
- Akcent: jeden chłodny kolor (np. niebieski / cyan) tylko tam, gdzie potrzebny fokus — nigdy tęczowe gradienty dekoracyjne.
- Powierzchnie: dużo „oddechu”, szerokie marginesy, rytm wizualny jak w dobrym UI.

## Typografia (na kreacjach)
- Nagłówki: sans-serif geometryczny lub neogrotesk, wyraźna hierarchia (H1 krótki, H2 wspierający).
- Tekst pomocniczy mniejszy, wyższy kontrast niż „szary na szarym”.

## Zawsze stosuj
- Jedna główna idea na kadr.
- Czytelny CTA (jeden dominant).
- Spójność z produktem z UI / strony (kolory marki, jeśli są zdefiniowane).

## Tego nie rób
- Żadnych gradientów na tle „dla ozdoby”.
- Żadnych kolorowych plam i dekoracji poza produktem i niezbędnym UI.
- Żadnej fotografii lifestyle z ludźmi, jeśli nie jest to wyraźnie briefowane inaczej.
- Żadnych przeładowanych kompozycji — jeden produkt, jedna pustka wokół, jeden przekaz.
`;

export const BRAND_VISUAL_RULES_ALTERNATES: string[] = [
  DEFAULT_BRAND_VISUAL_RULES,
  `## Nastrój i atmosfera
**Słowa kluczowe:** świeży, naturalny, zaufany.

Jasne tło (off-white), miękkie cienie, dużo światła dziennego w kadrze. Produkt czytelny, „dotykalny”, z lekkim kontekstem natury lub codzienności — ale bez chaosu. Ton komunikacji: uczciwy, prosty, bliski człowiekowi.

## Tego nie rób
- Krzykliwych kolorów bez uzasadnienia marki.
- Stockowych uśmiechów „z katalogu” bez kontekstu produktu.
- Zagraconych ramek, wielu fontów i wielu CTA w jednym kadrze.

## Zawsze stosuj
- Kontrast i czytelność na mobile.
- Jedna dominująca myśl wizualna.
`,
  `## Nastrój i atmosfera
**Słowa kluczowe:** odważny, kontrastowy, youth-friendly.

Mocny kolor marki jako bryła, duże typy, dynamiczny kadr. Energia i ruch, ale kontrolowane — geometria i grid trzymają porządek.

## Tego nie rób
- Nudnych, szarych płaszczyzn bez akcentu marki.
- Mikroskopijnego tekstu na reklamach social.
- Losowych memów / trendów niezgodnych z marką.

## Zawsze stosuj
- Logo i claim w rozpoznawalnej strefie bezpieczeństwa.
- Spójny rytm odstępów między kolejnymi kreacjami w zestawie.
`,
];
