import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { MarketingNowLogo } from "@/components/MarketingNowLogo";

type Search = { session_id?: string };

export const Route = createFileRoute("/billingsuccessful")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Dziękujemy za zakup — MarketingNow" },
      { name: "description", content: "Twoja płatność została przyjęta. Dziękujemy za zakup w MarketingNow." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingSuccessful,
});

function BillingSuccessful() {
  const { session_id } = useSearch({ from: "/billingsuccessful" });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border shrink-0">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-center">
          <MarketingNowLogo to="/" size="sm" className="text-foreground" />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center rounded-3xl border border-border bg-surface-elevated p-10 shadow-elevated">
          <CheckCircle2 className="h-14 w-14 text-accent mx-auto" />
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">
            Dziękujemy za zakup!
          </h1>
          <p className="mt-3 text-muted-foreground">
            Twoja płatność została przyjęta. Kredyty i plan zostaną doliczone do
            Twojego konta w ciągu kilku chwil, a potwierdzenie wyślemy e-mailem.
          </p>
          {session_id && (
            <p className="mt-2 text-xs text-muted-foreground break-all">
              ID sesji: {session_id}
            </p>
          )}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/agent"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-full bg-foreground text-background font-medium hover:opacity-90"
            >
              Przejdź do aplikacji
            </Link>
            <Link
              to="/billing"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 rounded-full border border-border font-medium hover:bg-muted/60"
            >
              Plan i kredyty
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}