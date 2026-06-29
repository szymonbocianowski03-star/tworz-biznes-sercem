import { createFileRoute, Link } from "@tanstack/react-router";
import { AppBackLink } from "@/components/AppBackLink";
import { MarketingNowLogo } from "@/components/MarketingNowLogo";
import { partnerProgramMailto, SUPPORT_EMAIL } from "@/lib/siteContact";

export const Route = createFileRoute("/program-partnerski")({
  head: () => ({
    meta: [
      { title: "Program partnerski — MarketingNow" },
      {
        name: "description",
        content:
          "Partnerstwo z MarketingNow: prowizja za poleconych klientów i współpraca przy promocji platformy. Napisz po szczegóły.",
      },
      { property: "og:title", content: "Program partnerski — MarketingNow" },
      {
        property: "og:description",
        content:
          "Prowizja za polecenia i możliwość współpracy przy promocji narzędzia marketingowego AI.",
      },
    ],
  }),
  component: ProgramPartnerskiPage,
});

function ProgramPartnerskiPage() {
  return (
    <div className="collins-root min-h-screen bg-background text-foreground flex flex-col">
      <div className="sticky top-0 z-20 flex flex-col bg-background border-b border-border">
        <header className="glass">
          <div className="mx-auto max-w-7xl flex items-center justify-between h-16 px-6 gap-4">
            <MarketingNowLogo className="text-foreground" />
            <div className="flex items-center gap-3 text-sm">
              <Link
                to="/auth"
                className="text-muted-foreground hover:text-foreground whitespace-nowrap"
              >
                Zaloguj się
              </Link>
              <Link to="/billing" className="font-medium hover:text-accent whitespace-nowrap">
                Plany
              </Link>
            </div>
          </div>
        </header>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-14 flex-1 w-full space-y-8">
        <AppBackLink to="/" label="Wróć na stronę główną" className="mb-2" />
        <div>
          <p className="text-sm text-muted-foreground">
            Dla twórców, agencji i partnerów biznesowych
          </p>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-extrabold tracking-tight">
            Program partnerski
          </h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Szukamy partnerów, którzy chcą polecać MarketingNow swojej publiczności albo klientom. W
            zamian oferujemy uczciwą prowizję od poleconych kont oraz możliwość ustalenia
            indywidualnych warunków — także przy wspólnych działaniach reklamowych i contentowych.
          </p>
        </div>

        <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-6">
          <h2 className="text-lg font-semibold tracking-tight">Jak to działa w skrócie</h2>
          <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <li>Polecasz platformę (link, webinar, newsletter, social media — ustalamy formę).</li>
            <li>
              Za każdego klienta, który dołączy na podstawie Twojego polecenia, naliczana jest
              prowizja według umowy.
            </li>
            <li>
              Możliwa jest też współpraca przy promocji naszej marki — np. materiały, case’y,
              wspólne kampanie.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Kontakt po szczegóły</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nie publikujemy tutaj sztywnego cennika prowizji — każdą współpracę ustalamy
            indywidualnie (skala, kanał, rynek). Napisz kilka słów o sobie / swojej firmie i
            proponowanym modelu współpracy.
          </p>
          <p className="pt-2">
            <a
              href={partnerProgramMailto}
              className="inline-flex items-center justify-center rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              Napisz na {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="text-xs text-muted-foreground">
            W temacie wiadomości zostanie ustawiony skrót „Program partnerski”, żeby łatwiej nam to
            przekierować.
          </p>
        </section>

      </article>
    </div>
  );
}
