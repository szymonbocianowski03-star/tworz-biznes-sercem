import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNowLogo } from "@/components/MarketingNowLogo";

export const Route = createFileRoute("/polityka-prywatnosci")({
  head: () => ({
    meta: [
      { title: "Polityka prywatności — MarketingNow" },
      { name: "description", content: "Polityka prywatności i informacje o przetwarzaniu danych osobowych w serwisie MarketingNow zgodnie z RODO." },
      { property: "og:title", content: "Polityka prywatności — MarketingNow" },
      { property: "og:description", content: "Jak przetwarzamy Twoje dane osobowe — MarketingNow." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="collins-root min-h-screen bg-background text-foreground flex flex-col">
      <div className="sticky top-0 z-20 flex flex-col bg-background">
        <div className="w-full bg-foreground text-background text-center py-2 px-4 text-[11px] sm:text-xs leading-snug">
          <Link to="/billing" className="font-semibold underline-offset-2 hover:underline">
            Zacznij za darmo
          </Link>
          {" — "}
          <span className="opacity-90">Zacznij od konta Free — bez karty kredytowej.</span>
        </div>
        <header className="glass border-b border-border">
          <div className="mx-auto max-w-7xl flex items-center justify-between h-16 px-6 gap-4">
            <MarketingNowLogo className="text-foreground" />
            <Link to="/billing" className="text-sm font-medium hover:text-accent whitespace-nowrap">
              Zacznij za darmo
            </Link>
          </div>
        </header>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-16 flex-1 w-full prose prose-sm md:prose-base prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-4xl prose-h2:mt-12 prose-h2:text-2xl prose-h3:text-lg prose-p:leading-relaxed prose-strong:text-foreground">
        <p className="text-sm text-muted-foreground">Ostatnia aktualizacja: 25 kwietnia 2026 r.</p>
        <h1>Polityka prywatności</h1>

        <p>Niniejsza Polityka prywatności określa zasady przetwarzania danych osobowych Użytkowników serwisu MarketingNow zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (dalej: „RODO").</p>

        <h2>1. Administrator danych osobowych</h2>
        <p>Administratorem Twoich danych osobowych jest:</p>
        <p>
          <strong>Szymon Bocianowski</strong><br />
          Aleja Waszyngtona 57/18<br />
          Polska
        </p>
        <p>Kontakt w sprawach związanych z ochroną danych osobowych: poprzez formularz kontaktowy w Serwisie lub na adres korespondencyjny wskazany powyżej.</p>

        <h2>2. Zakres i cele przetwarzania danych</h2>
        <p>Administrator przetwarza dane osobowe Użytkowników w następujących celach i na następujących podstawach prawnych:</p>
        <table>
          <thead>
            <tr><th>Cel</th><th>Podstawa prawna (RODO)</th><th>Okres przechowywania</th></tr>
          </thead>
          <tbody>
            <tr><td>Świadczenie usług, prowadzenie konta</td><td>art. 6 ust. 1 lit. b — wykonanie umowy</td><td>Czas trwania umowy + 6 lat</td></tr>
            <tr><td>Obsługa płatności i wystawianie faktur</td><td>art. 6 ust. 1 lit. c — obowiązek prawny</td><td>5 lat (przepisy podatkowe)</td></tr>
            <tr><td>Obsługa reklamacji i zapytań</td><td>art. 6 ust. 1 lit. b i f</td><td>3 lata</td></tr>
            <tr><td>Marketing własnych usług</td><td>art. 6 ust. 1 lit. f — uzasadniony interes</td><td>Do wniesienia sprzeciwu</td></tr>
            <tr><td>Newsletter, komunikacja marketingowa</td><td>art. 6 ust. 1 lit. a — zgoda</td><td>Do cofnięcia zgody</td></tr>
            <tr><td>Analiza i poprawa Serwisu, statystyki</td><td>art. 6 ust. 1 lit. f — uzasadniony interes</td><td>Do 24 miesięcy</td></tr>
            <tr><td>Ustalenie, dochodzenie i obrona roszczeń</td><td>art. 6 ust. 1 lit. f</td><td>Okres przedawnienia</td></tr>
          </tbody>
        </table>

        <h2>3. Kategorie przetwarzanych danych</h2>
        <ul>
          <li><strong>Dane konta:</strong> imię, nazwisko, adres e-mail, hasło (zaszyfrowane).</li>
          <li><strong>Dane rozliczeniowe:</strong> dane do faktury, NIP, adres (jeśli wymagane).</li>
          <li><strong>Dane techniczne:</strong> adres IP, identyfikator urządzenia, informacje o przeglądarce, logi systemowe.</li>
          <li><strong>Dane o korzystaniu z Serwisu:</strong> historia konwersacji z agentem AI, wygenerowane treści, ustawienia konta.</li>
          <li><strong>Dane przekazane dobrowolnie:</strong> URL strony produktu, opis biznesu, materiały graficzne.</li>
        </ul>

        <h2>4. Odbiorcy danych</h2>
        <p>Twoje dane mogą być przekazywane następującym kategoriom odbiorców:</p>
        <ul>
          <li>Dostawcy usług hostingowych i infrastruktury chmurowej,</li>
          <li>Dostawcy usług AI (modele językowe i generatywne) — wyłącznie w zakresie niezbędnym do realizacji usługi,</li>
          <li>Operatorzy płatności,</li>
          <li>Dostawcy usług księgowych i prawnych,</li>
          <li>Organy publiczne — w przypadku wymogu prawnego.</li>
        </ul>
        <p>Wszyscy odbiorcy zobowiązani są do zachowania poufności i przetwarzania danych zgodnie z RODO na podstawie umów powierzenia przetwarzania.</p>

        <h2>5. Przekazywanie danych poza EOG</h2>
        <p>Część usług, z których korzysta Administrator (np. dostawcy modeli AI, infrastruktura chmurowa), może wiązać się z przekazywaniem danych do państw trzecich poza Europejskim Obszarem Gospodarczym. W takich przypadkach przekazanie odbywa się na podstawie:</p>
        <ul>
          <li>decyzji Komisji Europejskiej o odpowiednim stopniu ochrony, lub</li>
          <li>standardowych klauzul umownych zatwierdzonych przez Komisję Europejską.</li>
        </ul>

        <h2>6. Twoje prawa</h2>
        <p>W związku z przetwarzaniem Twoich danych osobowych przysługują Ci następujące prawa:</p>
        <ul>
          <li><strong>Prawo dostępu</strong> do danych (art. 15 RODO),</li>
          <li><strong>Prawo do sprostowania</strong> danych (art. 16 RODO),</li>
          <li><strong>Prawo do usunięcia</strong> („prawo do bycia zapomnianym", art. 17 RODO),</li>
          <li><strong>Prawo do ograniczenia</strong> przetwarzania (art. 18 RODO),</li>
          <li><strong>Prawo do przenoszenia</strong> danych (art. 20 RODO),</li>
          <li><strong>Prawo do sprzeciwu</strong> wobec przetwarzania (art. 21 RODO),</li>
          <li><strong>Prawo do cofnięcia zgody</strong> w dowolnym momencie (bez wpływu na zgodność z prawem przetwarzania przed cofnięciem),</li>
          <li><strong>Prawo wniesienia skargi</strong> do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).</li>
        </ul>

        <h2>7. Dobrowolność podania danych</h2>
        <p>Podanie danych osobowych jest dobrowolne, jednak niezbędne do zawarcia i wykonania umowy o świadczenie usług. Brak podania wymaganych danych uniemożliwia korzystanie z funkcjonalności Serwisu wymagających rejestracji.</p>

        <h2>8. Zautomatyzowane podejmowanie decyzji i profilowanie</h2>
        <p>Administrator nie podejmuje decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, w tym profilowaniu, które wywoływałyby skutki prawne wobec Użytkownika. Modele AI generują treści wyłącznie na żądanie Użytkownika i nie służą do oceny jego osoby.</p>

        <h2>9. Pliki cookies</h2>
        <ol>
          <li>Serwis wykorzystuje pliki cookies (małe pliki tekstowe zapisywane na urządzeniu Użytkownika) w celu:
            <ul>
              <li>zapewnienia prawidłowego działania Serwisu (cookies niezbędne),</li>
              <li>zapamiętywania preferencji Użytkownika (cookies funkcjonalne),</li>
              <li>analizy ruchu i poprawy działania Serwisu (cookies analityczne — za zgodą).</li>
            </ul>
          </li>
          <li>Użytkownik może w każdej chwili zarządzać plikami cookies poprzez ustawienia przeglądarki. Wyłączenie cookies niezbędnych może wpłynąć na funkcjonalność Serwisu.</li>
        </ol>

        <h2>10. Bezpieczeństwo danych</h2>
        <p>Administrator stosuje odpowiednie środki techniczne i organizacyjne zapewniające ochronę danych osobowych odpowiednią do zagrożeń, w tym szyfrowanie transmisji (HTTPS/TLS), szyfrowanie haseł, kontrolę dostępu oraz regularne kopie zapasowe.</p>

        <h2>11. Zmiany Polityki prywatności</h2>
        <p>Polityka może być aktualizowana w przypadku zmiany przepisów prawa lub funkcjonalności Serwisu. O istotnych zmianach Użytkownicy zostaną poinformowani drogą elektroniczną z 14-dniowym wyprzedzeniem.</p>

        <hr className="my-12" />
        <p className="text-sm text-muted-foreground">
          Zobacz również: <Link to="/regulamin" className="text-accent">Regulamin</Link>
        </p>
      </article>

    </div>
  );
}
