import { useEffect, useRef, useState } from "react";
import { Lightbulb, RefreshCw, X } from "lucide-react";

type Quote = { text: string; author: string; role: string };

const QUOTES: Quote[] = [
  { text: "Reklama jest dźwignią handlu.", author: "Bolesław Prus", role: "Pisarz, publicysta" },
  { text: "Najlepsza reklama to zadowolony klient.", author: "Roman Kluska", role: "Założyciel Optimusa" },
  { text: "Małe firmy wygrywają sercem, nie budżetem.", author: "Rafał Brzoska", role: "InPost" },
  { text: "Marka to obietnica, którą codziennie musisz dotrzymać.", author: "Solange Olszewska", role: "Solaris Bus & Coach" },
  { text: "Klient nie kupuje produktu — kupuje rozwiązanie swojego problemu.", author: "Jan Kulczyk", role: "Przedsiębiorca" },
  { text: "Pomysł bez egzekucji jest wart tyle, co plotka.", author: "Michał Sadowski", role: "Brand24" },
  { text: "Najpierw zbuduj coś, czego ludzie chcą. Potem o tym mów.", author: "Piotr Smoleń", role: "Symmetrical.ai" },
  { text: "Sprzedaż zaczyna się tam, gdzie kończy się przekonywanie.", author: "Mateusz Grzesiak", role: "Trener biznesu" },
  { text: "W marketingu wygrywa ten, kto zna klienta lepiej niż konkurencja.", author: "Jacek Santorski", role: "Psycholog biznesu" },
  { text: "Buduj firmę, której sam chciałbyś być klientem.", author: "Marek Zmysłowski", role: "Przedsiębiorca, autor" },
  { text: "Nie sprzedawaj cech — sprzedawaj korzyści.", author: "Mariusz Szuba", role: "Trener sprzedaży" },
  { text: "Polska marka też może być globalna. Wystarczy odwaga.", author: "Dariusz Miłek", role: "CCC" },
  { text: "Najpierw opowieść, potem oferta.", author: "Paweł Tkaczyk", role: "MIDEA, ekspert marek" },
  { text: "Treść, która nie pomaga, nie sprzedaje.", author: "Artur Jabłoński", role: "Marketer, autor" },
  { text: "Reklama bez strategii to tylko ładny obrazek.", author: "Maciej Tesławski", role: "Strateg marketingowy" },
  { text: "Klient pamięta emocję, nie cenę.", author: "Jacek Kotarbiński", role: "Marketingowiec, autor" },
  { text: "Marketing to wojna w głowie konsumenta.", author: "Andrzej Falkowski", role: "Psycholog marketingu" },
  { text: "Lepiej być pierwszym w niszy niż drugim w kategorii.", author: "Paweł Tkaczyk", role: "Strateg marek" },
  { text: "Marka to nie logo. Marka to to, co czujesz, gdy o niej myślisz.", author: "Marek Staniszewski", role: "Strateg marek" },
  { text: "Słuchaj klienta, zanim zaczniesz mu sprzedawać.", author: "Brian Tracy", role: "Trener sprzedaży", },
  { text: "Pieniądze idą tam, gdzie idzie uwaga.", author: "Michał Szafrański", role: "Jak Oszczędzać Pieniądze" },
  { text: "Najpierw zaufanie, potem sprzedaż. Nigdy odwrotnie.", author: "Mateusz Kusznierewicz", role: "Sportowiec, przedsiębiorca" },
  { text: "Marketing zaczyna się od pytania: komu naprawdę pomagam?", author: "Marcin Iwuć", role: "Finansowy Ninja" },
  { text: "Konsekwencja w komunikacji jest ważniejsza niż perfekcja.", author: "Kamil Cebulski", role: "Trener biznesu" },
  { text: "Marka rośnie tam, gdzie jej właściciel mówi szczerze.", author: "Dorota Wellman", role: "Dziennikarka" },
  { text: "Sprzedaje ten, kto rozumie, a nie ten, kto mówi najgłośniej.", author: "Wojciech Herra", role: "Trener sprzedaży" },
  { text: "Marketing to nie koszt — to inwestycja w pamięć klienta.", author: "Jacek Kotarbiński", role: "Marketingowiec, autor" },
  { text: "Polacy lubią marki, które potrafią się śmiać z siebie.", author: "Maciej Stuhr", role: "Aktor, twarz kampanii" },
  { text: "Najlepszy produkt to taki, o którym klient sam chce opowiadać.", author: "Adam Bielecki", role: "Himalaista, mówca" },
  { text: "Marketing nie jest dla każdego. Jest dla tych, którzy mają coś do powiedzenia.", author: "Paweł Tkaczyk", role: "Strateg marek" },
  { text: "Twoja przewaga to nie cena — to relacja.", author: "Marcin Osman", role: "OSMPower" },
  { text: "Mała firma z dużym sercem zawsze wygra z dużą firmą bez serca.", author: "Sebastian Kulczyk", role: "Kulczyk Investments" },
  { text: "Reklama, która nie sprzedaje, jest za droga.", author: "Maciej Tesławski", role: "Strateg marketingowy" },
  { text: "Najpierw bądź użyteczny, potem widoczny.", author: "Artur Jabłoński", role: "Marketer, autor" },
  { text: "Klient kupuje od tych, którym ufa, nie od tych, którzy krzyczą najgłośniej.", author: "Iwona Guzowska", role: "Mistrzyni świata, przedsiębiorca" },
  { text: "Marka silna w środku jest silna na zewnątrz.", author: "Jacek Walkiewicz", role: "Mówca, autor" },
  { text: "Każda firma jest firmą medialną. Pytanie tylko, jaką historię opowiada.", author: "Paweł Tkaczyk", role: "Strateg marek" },
  { text: "Cena przyciąga klientów raz. Wartość zatrzymuje na zawsze.", author: "Jakub B. Bączek", role: "Trener mentalny" },
  { text: "Dobre treści budują markę szybciej niż dobre reklamy.", author: "Michał Sadowski", role: "Brand24" },
  { text: "Polska kreatywność jest naszą walutą eksportową.", author: "Tomasz Karolak", role: "Aktor, twórca" },
  { text: "Marketing zaczyna się w momencie, gdy przestajesz mówić o sobie.", author: "Marek Jankowski", role: "Mała Wielka Firma" },
  { text: "Klient nie chce być częścią Twojej kampanii. Chce być bohaterem swojej historii.", author: "Paweł Tkaczyk", role: "Strateg marek" },
  { text: "Najlepszy marketing wygląda jak pomoc, nie jak sprzedaż.", author: "Marcin Iwuć", role: "Finansowy Ninja" },
  { text: "Buduj produkt, który sam poleciłbyś przyjacielowi.", author: "Mariusz Gralewski", role: "DocPlanner" },
  { text: "W reklamie wygrywa prostota, nie spryt.", author: "Maciej Tesławski", role: "Strateg marketingowy" },
  { text: "Polski klient kupuje sercem, ale myśli portfelem.", author: "Roman Karkosik", role: "Przedsiębiorca" },
  { text: "Sprzedaż to transfer entuzjazmu.", author: "Mateusz Grzesiak", role: "Trener biznesu" },
  { text: "Marka to suma wszystkich obietnic, które dotrzymałeś.", author: "Solange Olszewska", role: "Solaris Bus & Coach" },
  { text: "Najlepsza strategia? Robić jedną rzecz lepiej niż wszyscy inni.", author: "Rafał Brzoska", role: "InPost" },
  { text: "Marketing bez analizy to wróżenie z fusów.", author: "Michał Sadowski", role: "Brand24" },
  { text: "Słowo 'za drogo' oznacza tylko jedno: klient nie widzi wartości.", author: "Wojciech Herra", role: "Trener sprzedaży" },
];

function pick(prev: number) {
  if (QUOTES.length <= 1) return 0;
  let n = prev;
  while (n === prev) n = Math.floor(Math.random() * QUOTES.length);
  return n;
}

export function MotivatorButton() {
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setIdx((i) => pick(i)), 7000);
    return () => clearInterval(id);
  }, [open]);

  const q = QUOTES[idx];

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Motywator marketingowy"
        className="h-9 w-9 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-500/10 transition-colors"
      >
        <Lightbulb className="h-4.5 w-4.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-border bg-surface-elevated shadow-elevated p-4 z-30 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 text-[11px] font-semibold uppercase tracking-wider">
              <Lightbulb className="h-3 w-3" /> Motywator
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIdx((i) => pick(i))}
                className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
                title="Następny cytat"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[15px] leading-relaxed font-medium text-foreground">
            <span className="text-amber-500/70 font-serif text-2xl leading-none mr-0.5">“</span>
            {q.text}
            <span className="text-amber-500/70 font-serif text-2xl leading-none ml-0.5">”</span>
          </p>
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-accent-gradient text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              {q.author.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{q.author}</p>
              <p className="text-[11px] text-muted-foreground truncate">{q.role}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}