import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

type Search = { session_id?: string };

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = useSearch({ from: "/checkout/return" });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center rounded-3xl border border-border bg-surface-elevated p-10 shadow-elevated">
          <CheckCircle2 className="h-12 w-12 text-accent mx-auto" />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Dziękujemy!</h1>
          <p className="mt-3 text-muted-foreground">
            {session_id
              ? "Twoja płatność została odebrana. Za chwilę otrzymasz potwierdzenie e-mailem."
              : "Brak informacji o sesji płatności."}
          </p>
          {session_id && (
            <p className="mt-2 text-xs text-muted-foreground break-all">ID sesji: {session_id}</p>
          )}
          <Link
            to="/"
            className="mt-8 inline-flex items-center justify-center px-6 py-3 rounded-full bg-foreground text-background font-medium hover:opacity-90"
          >
            Wróć na stronę główną
          </Link>
        </div>
      </main>
    </div>
  );
}