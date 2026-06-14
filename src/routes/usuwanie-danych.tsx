import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/usuwanie-danych")({
  component: DataDeletionPage,
  head: () => ({
    meta: [
      { title: "Usuwanie danych użytkownika — MarketingNow" },
      {
        name: "description",
        content:
          "Instrukcja usuwania danych użytkownika z MarketingNow, w tym danych pobranych z konta Meta (Facebook / Instagram).",
      },
    ],
  }),
});

function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <p className="editorial-eyebrow text-blue-600">Prywatność</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl font-extrabold tracking-tighter text-foreground">
          Usuwanie danych użytkownika
        </h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Poniżej znajdziesz instrukcję, jak usunąć swoje dane z MarketingNow,
          w tym dane pobrane z Twojego konta Meta (Facebook / Instagram /
          Meta Ads) za pośrednictwem integracji w aplikacji.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            1. Odłączenie konta Meta
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Aby odłączyć swoje konto Meta i usunąć powiązane tokeny dostępu
            oraz dane konta reklamowego z MarketingNow:
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground/90">
            <li>
              Zaloguj się na swoje konto w{" "}
              <a className="text-blue-600 underline" href="https://www.marketingnow.site">
                marketingnow.site
              </a>
              .
            </li>
            <li>
              Przejdź do <span className="font-semibold">Agent → Personalizacja</span>.
            </li>
            <li>
              W sekcji <span className="font-semibold">Integracja Meta</span>{" "}
              kliknij <span className="font-semibold">„Odłącz konto"</span>.
            </li>
            <li>
              Tokeny dostępu, identyfikatory kont reklamowych, Pixela oraz
              fanpage'y zostaną natychmiast usunięte z naszej bazy danych.
            </li>
          </ol>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            2. Pełne usunięcie konta MarketingNow
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Jeśli chcesz usunąć całe swoje konto wraz ze wszystkimi danymi
            (profil, produkty, rozmowy z agentem, integracje, wygenerowane
            kreacje), wyślij wiadomość na adres:
          </p>
          <p className="text-base font-semibold">
            <a className="text-blue-600 underline" href="mailto:kontakt@marketingnow.site">
              kontakt@marketingnow.site
            </a>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            W tytule wpisz <span className="font-semibold">„Usunięcie danych"</span>{" "}
            oraz podaj adres e-mail, na który zarejestrowane jest konto.
            Dane usuniemy w terminie do 30 dni od otrzymania zgłoszenia i
            potwierdzimy usunięcie zwrotnym mailem.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            3. Jakie dane Meta przechowujemy
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-foreground/90">
            <li>Token dostępu (długoterminowy, do 60 dni) wystawiony przez Meta.</li>
            <li>Identyfikator użytkownika Meta oraz imię i nazwisko z profilu.</li>
            <li>Listę kont reklamowych i fanpage'y, do których przyznałeś dostęp.</li>
            <li>Wybrane ID konta reklamowego, ID Pixela oraz ID strony.</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nie przechowujemy Twojego hasła do Facebooka — autoryzacja odbywa
            się wyłącznie przez OAuth Meta.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            4. Kontakt
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Pytania dotyczące prywatności i usuwania danych:{" "}
            <a className="text-blue-600 underline" href="mailto:kontakt@marketingnow.site">
              kontakt@marketingnow.site
            </a>
            .
          </p>
          <p className="text-sm text-muted-foreground">
            Zobacz też:{" "}
            <Link to="/polityka-prywatnosci" className="text-blue-600 underline">
              Polityka prywatności
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}