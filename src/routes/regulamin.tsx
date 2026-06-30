import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNowLogo } from "@/components/MarketingNowLogo";

export const Route = createFileRoute("/regulamin")({
  head: () => ({
    meta: [
      { title: "Regulamin — MarketingNow" },
      { name: "description", content: "Regulamin świadczenia usług drogą elektroniczną serwisu MarketingNow." },
      { property: "og:title", content: "Regulamin — MarketingNow" },
      { property: "og:description", content: "Regulamin świadczenia usług MarketingNow." },
    ],
  }),
  component: RegulaminPage,
});

function RegulaminPage() {
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
        <h1>Regulamin serwisu MarketingNow</h1>

        <h2>§ 1. Postanowienia ogólne</h2>
        <ol>
          <li>Niniejszy Regulamin określa zasady świadczenia usług drogą elektroniczną w ramach serwisu internetowego MarketingNow, dostępnego pod adresem internetowym Usługodawcy (dalej: „Serwis").</li>
          <li>Usługodawcą jest <strong>Szymon Bocianowski</strong>, prowadzący działalność pod adresem: <strong>Aleja Waszyngtona 57/18</strong>, dalej zwany „Usługodawcą".</li>
          <li>Kontakt z Usługodawcą możliwy jest za pośrednictwem poczty elektronicznej oraz korespondencyjnie na adres wskazany w ust. 2.</li>
          <li>Regulamin jest udostępniany nieodpłatnie przed zawarciem umowy w sposób umożliwiający jego pobranie, utrwalenie i wydrukowanie.</li>
        </ol>

        <h2>§ 2. Definicje</h2>
        <ul>
          <li><strong>Użytkownik</strong> — osoba fizyczna posiadająca pełną zdolność do czynności prawnych, osoba prawna lub jednostka organizacyjna nieposiadająca osobowości prawnej, korzystająca z Serwisu.</li>
          <li><strong>Konsument</strong> — Użytkownik będący osobą fizyczną dokonujący czynności prawnej niezwiązanej bezpośrednio z jego działalnością gospodarczą lub zawodową.</li>
          <li><strong>Konto</strong> — indywidualny zbiór danych Użytkownika utworzony w Serwisie po rejestracji.</li>
          <li><strong>Usługa</strong> — usługi świadczone drogą elektroniczną przez Usługodawcę, w tym dostęp do agenta AI, generowanie treści marketingowych, obrazów i innych materiałów reklamowych.</li>
          <li><strong>Treści AI</strong> — materiały (tekstowe, graficzne, audiowizualne) wygenerowane automatycznie przez modele sztucznej inteligencji wykorzystywane w Serwisie.</li>
        </ul>

        <h2>§ 3. Wymagania techniczne</h2>
        <ol>
          <li>Do prawidłowego korzystania z Serwisu wymagane jest urządzenie z dostępem do sieci Internet, aktualna przeglądarka internetowa (Chrome, Firefox, Safari, Edge) z włączoną obsługą JavaScript oraz aktywne konto poczty elektronicznej.</li>
          <li>Usługodawca nie ponosi odpowiedzialności za przerwy w działaniu Serwisu wynikające z awarii sprzętu lub oprogramowania po stronie Użytkownika.</li>
        </ol>

        <h2>§ 4. Rejestracja i zawarcie umowy</h2>
        <ol>
          <li>Korzystanie z pełnej funkcjonalności Serwisu wymaga utworzenia Konta poprzez podanie wymaganych danych oraz akceptację Regulaminu i Polityki prywatności.</li>
          <li>Umowa o świadczenie usług drogą elektroniczną zostaje zawarta z chwilą utworzenia Konta i jest zawierana na czas nieoznaczony.</li>
          <li>Użytkownik zobowiązuje się do podania danych zgodnych ze stanem faktycznym oraz ich aktualizacji.</li>
          <li>Zakazane jest udostępnianie Konta osobom trzecim oraz tworzenie więcej niż jednego Konta przez tę samą osobę bez zgody Usługodawcy.</li>
        </ol>

        <h2>§ 5. Zasady korzystania z Serwisu</h2>
        <ol>
          <li>Użytkownik zobowiązany jest do korzystania z Serwisu zgodnie z prawem, dobrymi obyczajami oraz Regulaminem.</li>
          <li>Zabronione jest dostarczanie treści o charakterze bezprawnym, w szczególności:
            <ul>
              <li>naruszających prawa osób trzecich, w tym prawa autorskie, prawa do znaków towarowych i dobra osobiste,</li>
              <li>zawierających treści dyskryminacyjne, nawołujące do nienawiści, propagujące przemoc lub nielegalne,</li>
              <li>wprowadzających w błąd lub stanowiących nieuczciwą reklamę,</li>
              <li>zawierających szkodliwe oprogramowanie.</li>
            </ul>
          </li>
          <li>Zabronione jest podejmowanie działań zakłócających funkcjonowanie Serwisu, w tym automatyzacja zapytań w sposób nieuzgodniony z Usługodawcą, próby uzyskania nieautoryzowanego dostępu oraz inżynieria wsteczna modeli AI.</li>
        </ol>

        <h2>§ 6. Plany abonamentowe i płatności</h2>
        <ol>
          <li>Serwis udostępniany jest w modelu freemium — z bezpłatnym pakietem startowym oraz płatnymi planami rozszerzonymi.</li>
          <li>Aktualne ceny planów oraz limity zużycia podane są w Serwisie i mogą podlegać zmianom. Zmiana cen nie wpływa na umowy już zawarte do końca opłaconego okresu rozliczeniowego.</li>
          <li>Płatności obsługiwane są przez zewnętrznych operatorów płatności. Usługodawca nie przechowuje danych kart płatniczych.</li>
          <li>Faktura VAT lub rachunek wystawiane są na żądanie Użytkownika na podstawie podanych przez niego danych.</li>
        </ol>

        <h2>§ 7. Treści generowane przez AI</h2>
        <ol>
          <li>Serwis wykorzystuje modele sztucznej inteligencji do generowania treści marketingowych. Treści AI mogą zawierać błędy, nieścisłości lub elementy wymagające weryfikacji przed komercyjnym wykorzystaniem.</li>
          <li>Użytkownik ponosi pełną odpowiedzialność za sposób wykorzystania Treści AI, w tym za zgodność z prawem reklamy, prawem prasowym oraz prawami osób trzecich.</li>
          <li>Usługodawca nie gwarantuje, że Treści AI będą wolne od podobieństw do treści osób trzecich. Użytkownik powinien zweryfikować unikalność treści przed publikacją.</li>
          <li>W zakresie dopuszczonym przez prawo Użytkownik nabywa prawo do komercyjnego wykorzystania wygenerowanych Treści AI z chwilą ich utworzenia w ramach aktywnego planu.</li>
        </ol>

        <h2>§ 8. Odpowiedzialność</h2>
        <ol>
          <li>Usługodawca dokłada należytej staranności w zapewnieniu prawidłowego działania Serwisu, jednak nie gwarantuje jego nieprzerwanej dostępności.</li>
          <li>Usługodawca nie ponosi odpowiedzialności za skutki decyzji marketingowych podjętych przez Użytkownika na podstawie Treści AI.</li>
          <li>Odpowiedzialność Usługodawcy wobec Użytkowników niebędących Konsumentami ograniczona jest do wysokości opłat uiszczonych przez Użytkownika w okresie 12 miesięcy poprzedzających zdarzenie i nie obejmuje utraconych korzyści.</li>
          <li>Powyższe ograniczenia nie wyłączają odpowiedzialności za szkody wyrządzone umyślnie ani odpowiedzialności wobec Konsumentów w zakresie wynikającym z bezwzględnie obowiązujących przepisów prawa.</li>
        </ol>

        <h2>§ 9. Prawo odstąpienia (Konsumenci)</h2>
        <ol>
          <li>Konsumentowi przysługuje prawo odstąpienia od umowy zawartej na odległość w terminie 14 dni od jej zawarcia, bez podania przyczyny.</li>
          <li>Prawo odstąpienia nie przysługuje w odniesieniu do treści cyfrowych dostarczonych za wyraźną zgodą Konsumenta przed upływem terminu odstąpienia, po poinformowaniu go o utracie tego prawa.</li>
          <li>Oświadczenie o odstąpieniu należy przesłać na dane kontaktowe Usługodawcy wskazane w § 1.</li>
        </ol>

        <h2>§ 10. Reklamacje</h2>
        <ol>
          <li>Reklamacje dotyczące Usług można składać drogą elektroniczną na adres kontaktowy Usługodawcy.</li>
          <li>Reklamacja powinna zawierać dane Użytkownika, opis zastrzeżeń oraz oczekiwany sposób rozstrzygnięcia.</li>
          <li>Usługodawca rozpatrzy reklamację w terminie 14 dni od jej otrzymania i poinformuje Użytkownika o sposobie rozstrzygnięcia.</li>
        </ol>

        <h2>§ 11. Rozwiązanie umowy</h2>
        <ol>
          <li>Użytkownik może w każdej chwili rozwiązać umowę poprzez usunięcie Konta w panelu Serwisu.</li>
          <li>Usługodawca może rozwiązać umowę z zachowaniem 14-dniowego okresu wypowiedzenia z ważnych przyczyn, w szczególności w przypadku rażącego naruszenia Regulaminu.</li>
        </ol>

        <h2>§ 12. Pozasądowe rozstrzyganie sporów</h2>
        <p>Konsument ma możliwość skorzystania z pozasądowych sposobów rozpatrywania sporów, w tym za pośrednictwem platformy ODR Komisji Europejskiej (ec.europa.eu/consumers/odr) oraz Wojewódzkich Inspektoratów Inspekcji Handlowej.</p>

        <h2>§ 13. Postanowienia końcowe</h2>
        <ol>
          <li>Regulamin może być zmieniony z ważnych przyczyn — Użytkownicy zostaną poinformowani o zmianach z 14-dniowym wyprzedzeniem drogą elektroniczną.</li>
          <li>W sprawach nieuregulowanych Regulaminem zastosowanie mają przepisy prawa polskiego, w szczególności Kodeksu cywilnego, ustawy o świadczeniu usług drogą elektroniczną oraz ustawy o prawach konsumenta.</li>
          <li>Sądem właściwym do rozstrzygania sporów z Użytkownikami niebędącymi Konsumentami jest sąd właściwy dla siedziby Usługodawcy.</li>
        </ol>

        <hr className="my-12" />
        <p className="text-sm text-muted-foreground">
          Zobacz również: <Link to="/polityka-prywatnosci" className="text-accent">Polityka prywatności</Link>
        </p>
      </article>

    </div>
  );
}
