import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { AppBackLink } from "@/components/AppBackLink";
import { MarketingNowLogo } from "@/components/MarketingNowLogo";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

type Search = { priceId?: string };

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    priceId: typeof search.priceId === "string" ? search.priceId : undefined,
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { priceId } = useSearch({ from: "/checkout" });

  return (
    <div className="collins-root min-h-screen bg-background flex flex-col">
      <div className="w-full bg-foreground text-background text-center py-2 px-4 text-[11px] sm:text-xs shrink-0">
        <span className="font-semibold">Zacznij za darmo</span>
        {" — "}
        <span className="opacity-90">Konto Free było bez karty; tutaj finalizujesz płatność wybranego planu.</span>
      </div>
      <header className="border-b border-border shrink-0">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-center">
          <MarketingNowLogo to={null} size="sm" className="text-foreground" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 flex-1 w-full">
        <AppBackLink to="/billing" label="Wróć do planu i kredytów" className="mb-6" />
        {!priceId ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Brak wybranego planu.</p>
            <Link to="/billing" className="mt-4 inline-block text-sm underline">
              Otwórz cennik w aplikacji
            </Link>
          </div>
        ) : (
          <StripeEmbeddedCheckout priceId={priceId} />
        )}
      </main>

    </div>
  );
}
