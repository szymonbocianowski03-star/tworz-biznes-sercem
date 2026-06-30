import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingNowLogo } from "@/components/MarketingNowLogo";
import { RegulaminMarketingNowContent } from "@/content/RegulaminMarketingNowContent";

export const Route = createFileRoute("/regulamin")({
  head: () => ({
    meta: [
      { title: "Regulamin — MarketingNow" },
      {
        name: "description",
        content:
          "Regulamin świadczenia usług drogą elektroniczną serwisu MarketingNow (marketingnow.site) — wersja profesjonalna.",
      },
      { property: "og:title", content: "Regulamin — MarketingNow" },
      {
        property: "og:description",
        content: "Regulamin serwisu MarketingNow — AI marketing workspace.",
      },
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

      <article className="mx-auto max-w-3xl px-6 py-16 flex-1 w-full prose prose-sm md:prose-base prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-4xl prose-h2:mt-12 prose-h2:text-2xl prose-h3:text-lg prose-p:leading-relaxed prose-strong:text-foreground prose-li:leading-relaxed">
        <RegulaminMarketingNowContent />

        <hr className="my-12" />
        <p className="text-sm text-muted-foreground">
          Zobacz również:{" "}
          <Link to="/polityka-prywatnosci" className="text-accent">
            Polityka prywatności
          </Link>
        </p>
      </article>
    </div>
  );
}
