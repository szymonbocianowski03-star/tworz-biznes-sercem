import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNowLogo } from "@/components/MarketingNowLogo";
import { SUPPORT_EMAIL } from "@/lib/siteContact";

export const Route = createFileRoute("/bezpieczenstwo")({
  head: () => ({
    meta: [
      { title: "Bezpieczeństwo i prywatność — MarketingNow" },
      {
        name: "description",
        content:
          "Jak MarketingNow chroni Twoje konto i dane: uwierzytelnianie, szyfrowanie transmisji, kontrola dostępu oraz kontakt w sprawach bezpieczeństwa.",
      },
      { property: "og:title", content: "Bezpieczeństwo i prywatność — MarketingNow" },
      {
        property: "og:description",
        content: "Przegląd praktyk bezpieczeństwa i prywatności w serwisie MarketingNow.",
      },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
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
        <p className="text-sm text-muted-foreground">Ostatnia aktualizacja: 22 czerwca 2026 r.</p>
        <h1>Bezpieczeństwo i prywatność</h1>

        <p>
          Ta strona jest utrzymywana przez zespół MarketingNow, aby odpowiedzieć na najczęstsze
          pytania dotyczące bezpieczeństwa i prywatności w serwisie MarketingNow. Opisuje praktyki
          aktualnie stosowane w aplikacji. Nie jest to certyfikat ani niezależny audyt — to
          przejrzysty opis wdrożonych mechanizmów.
        </p>

        <h2>1. Uwierzytelnianie i ochrona konta</h2>
        <ul>
          <li>Logowanie e-mailem i hasłem oraz logowanie przez Google.</li>
          <li>Hasła są przechowywane wyłącznie w postaci zaszyfrowanej (hash) — nigdy w postaci jawnej.</li>
          <li>
            Ochrona przed wyciekłymi hasłami: przy zakładaniu konta i zmianie hasła sprawdzamy je
            względem publicznych baz znanych naruszeń, aby uniemożliwić użycie skompromitowanych haseł.
          </li>
          <li>Sesje użytkowników są zarządzane po stronie dostawcy uwierzytelniania z odświeżaniem tokenów.</li>
        </ul>

        <h2>2. Hosting i infrastruktura</h2>
        <p>
          Aplikacja działa na zarządzanej infrastrukturze chmurowej wraz z
          jej dostawcami backendu). Dane są przechowywane w zarządzanej bazie danych z kontrolą
          dostępu na poziomie wierszy. To opis możliwości platformy, a nie potwierdzenie zgodności z
          jakąkolwiek normą czy certyfikatem.
        </p>

        <h2>3. Szyfrowanie i transmisja danych</h2>
        <p>
          Cały ruch pomiędzy przeglądarką a serwisem jest szyfrowany za pomocą HTTPS/TLS. Hasła
          przechowujemy w formie zaszyfrowanej, a dostęp do danych jest ograniczony zgodnie z
          przypisaniem do konta użytkownika.
        </p>

        <h2>4. Kontrola dostępu do danych</h2>
        <p>
          Dane konta są dostępne wyłącznie dla zalogowanego właściciela konta. Reguły dostępu są
          egzekwowane po stronie serwera, tak aby jeden użytkownik nie miał dostępu do danych innego
          użytkownika.
        </p>

        <h2>5. Dostawcy i integracje</h2>
        <p>
          Do realizacji usługi korzystamy z zaufanych dostawców (m.in. infrastruktura chmurowa,
          dostawcy modeli AI, operatorzy płatności oraz integracje reklamowe wybierane przez
          użytkownika). Przekazujemy im tylko dane niezbędne do działania danej funkcji. Pełny opis
          znajdziesz w{" "}
          <Link to="/polityka-prywatnosci" className="text-accent">
            Polityce prywatności
          </Link>
          .
        </p>

        <h2>6. Przechowywanie i usuwanie danych</h2>
        <p>
          Okresy przechowywania danych oraz przysługujące Ci prawa (dostęp, sprostowanie, usunięcie,
          ograniczenie, przenoszenie, sprzeciw) opisaliśmy szczegółowo w{" "}
          <Link to="/polityka-prywatnosci" className="text-accent">
            Polityce prywatności
          </Link>
          . Wniosek o usunięcie danych możesz złożyć na stronie{" "}
          <Link to="/usuwanie-danych" className="text-accent">
            Usuwanie danych
          </Link>
          .
        </p>

        <h2>7. Zgłaszanie problemów bezpieczeństwa</h2>
        <p>
          Jeśli zauważysz potencjalną podatność lub problem z bezpieczeństwem, napisz do nas na adres{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent">
            {SUPPORT_EMAIL}
          </a>
          . Prosimy o nieujawnianie problemu publicznie do czasu jego naprawy.
        </p>

        <h2>8. Odpowiedzialność współdzielona</h2>
        <p>
          Platforma hostingowa odpowiada za zabezpieczenie infrastruktury, MarketingNow za
          konfigurację aplikacji i ochronę danych konta, a użytkownik za bezpieczeństwo własnego
          hasła i urządzeń. Zachęcamy do używania silnych, unikalnych haseł.
        </p>

        <hr className="my-12" />
        <p className="text-sm text-muted-foreground">
          Zobacz również:{" "}
          <Link to="/polityka-prywatnosci" className="text-accent">
            Polityka prywatności
          </Link>{" "}
          ·{" "}
          <Link to="/regulamin" className="text-accent">
            Regulamin
          </Link>
        </p>
      </article>
    </div>
  );
}