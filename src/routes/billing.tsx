import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Check, Sparkles, Coins, Zap } from "lucide-react";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useCredits } from "@/hooks/useCredits";
import { AppBackLink } from "@/components/AppBackLink";
import { supabase } from "@/integrations/supabase/client";
import { BillingPeriodToggle } from "@/components/SegmentedControl";
import {
  CREDIT_PACKS,
  formatPlanCreditsLabel,
  formatPlanImagesHint,
  planYearlyMonthlyEquivalentGrossPln,
  planYearlyTotalGrossPln,
  PLANS,
  PLAN_YEARLY_DISCOUNT_FRAC,
  type Plan,
} from "@/lib/plans";
import { FREE_AI_USAGE_BUDGET_CENTS, subscribeCreditsRefresh } from "@/lib/creditsRefresh";
import { formatCreditUsageRow, formatFreeUsageCredits, formatFreePlanBudgetCredits, AI_PRICE_LIST } from "@/lib/creditUsageDisplay";

type BillingSearch = { yearly: boolean };

export const Route = createFileRoute("/billing")({
  validateSearch: (raw: Record<string, unknown>): BillingSearch => {
    const y = raw.yearly;
    const yearly =
      y === true || y === "true" || y === "1" || y === 1 || y === "yes";
    return { yearly };
  },
  component: BillingPage,
});

type UsageRow = {
  id: string;
  source: string;
  usd_cents: number;
  credits_delta: number;
  created_at: string;
  detail: Record<string, unknown> | null;
};

function BillingPage() {
  const { user } = useAuthSession();
  const credits = useCredits();
  const { openCheckout, checkoutElement, isOpen } = useStripeCheckout();
  const yFromUrl = Route.useSearch().yearly;
  const [yearly, setYearly] = useState(yFromUrl);
  const prevYUrl = useRef(yFromUrl);
  useEffect(() => {
    if (prevYUrl.current !== yFromUrl) {
      prevYUrl.current = yFromUrl;
      setYearly(yFromUrl);
    }
  }, [yFromUrl]);
  const [usageLog, setUsageLog] = useState<UsageRow[]>([]);

  const loadUsageLog = useCallback(async () => {
    if (!user) {
      setUsageLog([]);
      return;
    }
    const { data } = await (supabase as any)
      .from("credit_usage_log")
      .select("id,source,usd_cents,credits_delta,created_at,detail")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);
    if (data) setUsageLog(data as UsageRow[]);
  }, [user]);

  useEffect(() => {
    void loadUsageLog();
  }, [loadUsageLog]);

  useEffect(() => {
    return subscribeCreditsRefresh(() => {
      void loadUsageLog();
    });
  }, [loadUsageLog]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void loadUsageLog();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadUsageLog]);

  const buy = (priceId: string) => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    openCheckout({
      priceId,
      customerEmail: user.email,
      userId: user.id,
      returnUrl: `${window.location.origin}/billingsuccessful?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  if (isOpen) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="w-full bg-foreground text-background text-center py-2 px-4 text-[11px] sm:text-xs">
          <Link to="/billing" search={{ yearly: false }} className="font-semibold underline-offset-2 hover:underline">
            Zacznij za darmo
          </Link>
          {" — "}
          <span className="opacity-90">Konto Free bez karty — płatność przy upgrade.</span>
        </div>
        <div className="mx-auto max-w-3xl px-6 py-10 flex-1 w-full">
          <AppBackLink to="/billing" label="Wróć do planów" className="mb-6" />
          {checkoutElement}
        </div>
      </div>
    );
  }

  const isFreePlan = (credits.current_plan ?? "free") === "free";
  const freePlanMonthlyCredits = PLANS.find((p) => p.id === "free")?.credits ?? 400;
  const freeUsageCents = credits.free_ai_usage_usd_cents ?? 0;
  const displayBalance = credits.balance != null ? credits.balance : isFreePlan ? freePlanMonthlyCredits : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full bg-foreground text-background text-center py-2 px-4 text-[11px] sm:text-xs leading-snug">
        <span className="font-semibold">Zacznij za darmo</span>
        {" — "}
        <span className="opacity-90">Zacznij od konta Free — bez karty kredytowej; płatność dopiero przy wyborze płatnego planu.</span>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-12 flex-1 w-full">
        <AppBackLink className="mb-6" />
        <header className="text-center">
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">Wybierz plan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Te same ceny co na stronie głównej. Po upgrade kredyty doliczają się od razu, proporcjonalnie do różnicy.
          </p>

          <BillingPeriodToggle
            className="mt-6"
            yearly={yearly}
            onChange={setYearly}
            variant="app"
            discountPct={Math.round(PLAN_YEARLY_DISCOUNT_FRAC * 100)}
          />
        </header>

        <section className="mt-10 mx-auto max-w-2xl">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-center">Cennik AI (kredyty)</h2>
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface-elevated text-sm">
            {AI_PRICE_LIST.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium">{row.label}</span>
                <span className="tabular-nums font-semibold">
                  {row.credits} kred.{row.note ? ` · ${row.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {user && (
          <div className="mt-6 mx-auto max-w-lg rounded-2xl border border-border bg-surface-elevated p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Coins className="h-5 w-5 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">
                  {isFreePlan ? "Zużycie limitu AI (plan Free)" : "Saldo kredytów"}
                </div>
                <div className="font-semibold">
                  {credits.loading ? (
                    "…"
                  ) : isFreePlan ? (
                    <>
                      {formatFreeUsageCredits(freeUsageCents)} / {formatFreePlanBudgetCredits()} · zostało{" "}
                      {formatFreeUsageCredits(Math.max(0, FREE_AI_USAGE_BUDGET_CENTS - freeUsageCents))}
                    </>
                  ) : (
                    `${displayBalance} kredytów`
                  )}{" "}
                  · plan {credits.current_plan ?? "free"}
                </div>
                {isFreePlan && !credits.loading && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Limit Free to {formatFreePlanBudgetCredits()} równowartości. Po upgrade: {freePlanMonthlyCredits}+ kredytów miesięcznie.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {PLANS.map((p: Plan) => {
            const isCurrent = credits.current_plan === p.id;
            const priceId = yearly ? p.yearlyPriceId : p.monthlyPriceId;
            const monthlyEquivalent = yearly
              ? planYearlyMonthlyEquivalentGrossPln(p.monthly)
              : p.monthly;
            const displayPrice = p.monthly === 0 ? "0 zł" : `${monthlyEquivalent} zł`;
            return (
              <div
                key={p.id}
                className={`relative rounded-2xl border bg-surface-elevated p-6 flex flex-col ${
                  p.highlight ? "border-accent shadow-elevated" : "border-border"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground text-[11px] font-medium px-2.5 py-1">
                    <Sparkles className="h-3 w-3" /> Najpopularniejszy
                  </span>
                )}
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{displayPrice}</span>
                  {p.monthly > 0 && <span className="text-xs text-muted-foreground">/ mies.</span>}
                </div>
                {yearly && p.monthly > 0 && (
                  <p className="mt-0.5 text-[11px] text-emerald-600">
                    Płatne rocznie · {planYearlyTotalGrossPln(p.monthly)} zł
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{formatPlanCreditsLabel(p)}</p>
                {formatPlanImagesHint(p) ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{formatPlanImagesHint(p)}</p>
                ) : null}
                <ul className="mt-5 space-y-2 text-sm flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={!priceId || isCurrent}
                  onClick={() => priceId && buy(priceId)}
                  className={`mt-6 w-full rounded-full py-2.5 text-sm font-medium transition ${
                    isCurrent
                      ? "bg-muted text-muted-foreground cursor-default"
                      : priceId
                        ? "bg-foreground text-background hover:opacity-90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {isCurrent ? "Aktualny plan" : priceId ? "Wybierz" : "Plan domyślny"}
                </button>
              </div>
            );
          })}
        </div>

        <section className="mt-16">
          <header className="text-center">
            <h2 className="font-display text-2xl font-extrabold tracking-tight inline-flex items-center gap-2">
              <Zap className="h-6 w-6 text-accent" /> Dokup kredyty
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Skończyły się kredyty? Kup paczkę bez zmiany planu — kredyty są dodawane od razu.
            </p>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto">
              Paczki to jednorazowy dokup bez zmiany subskrypcji.
            </p>
          </header>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`rounded-2xl border bg-surface-elevated p-6 flex flex-col ${"highlight" in pack && pack.highlight ? "border-accent" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{pack.label}</h3>
                  {"highlight" in pack && pack.highlight && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-accent">Najlepsza wartość</span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{pack.price} zł</span>
                  <span className="text-xs text-muted-foreground">jednorazowo</span>
                </div>
                <button
                  type="button"
                  onClick={() => buy(pack.id)}
                  className="mt-6 w-full rounded-full py-2.5 text-sm font-medium bg-foreground text-background hover:opacity-90"
                >
                  Kup teraz
                </button>
              </div>
            ))}
          </div>
        </section>

        {user && usageLog.length > 0 && (
          <section className="mt-16 max-w-3xl mx-auto">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-center">Ślad zużycia AI</h2>
            <p className="mt-1 text-sm text-muted-foreground text-center max-w-xl mx-auto">
              {isFreePlan
                ? "Plan Free: zużycie wlicza się w limit powyżej. Kredyty z pakietu nie są odejmowane."
                : "Poniżej widać, ile kredytów odjęliśmy po każdym zadaniu AI."}
            </p>
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface-elevated text-sm">
              {usageLog.map((row) => {
                const formatted = formatCreditUsageRow({
                  source: row.source,
                  usdCents: row.usd_cents,
                  creditsDelta: row.credits_delta,
                  isFreePlan,
                });
                return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="font-medium">{formatted.title}</span>
                  <span className="font-semibold tabular-nums text-foreground">{formatted.charge}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("pl-PL")}
                  </span>
                </li>
              );
              })}
            </ul>
          </section>
        )}

        <footer className="mt-16 pt-8 pb-10 border-t border-border text-center text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link to="/program-partnerski" className="hover:text-foreground underline-offset-2 hover:underline">
              Program partnerski
            </Link>
            <Link to="/regulamin" className="hover:text-foreground underline-offset-2 hover:underline">
              Regulamin
            </Link>
            <Link to="/polityka-prywatnosci" className="hover:text-foreground underline-offset-2 hover:underline">
              Polityka prywatności
            </Link>
            <Link to="/" className="hover:text-foreground underline-offset-2 hover:underline">
              Strona główna
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
