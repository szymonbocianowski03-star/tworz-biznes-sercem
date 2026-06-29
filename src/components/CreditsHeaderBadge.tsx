import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { FREE_AI_USAGE_BUDGET_CENTS } from "@/lib/creditsRefresh";
import { freeUsageCentsToCredits } from "@/lib/creditUsageDisplay";
import { FREE_PLAN_CREDIT_BUDGET } from "@/lib/aiPricing";

type Props = {
  loading: boolean;
  isFreePlan: boolean;
  planId: string;
  freeUsageCents: number;
  balance: number | null;
  className?: string;
};

export function CreditsHeaderBadge({
  loading,
  isFreePlan,
  planId,
  freeUsageCents,
  balance,
  className,
}: Props) {
  const usedCredits = freeUsageCentsToCredits(freeUsageCents);
  const freeUsageLeftCredits = Math.max(0, FREE_PLAN_CREDIT_BUDGET - usedCredits);
  const usagePct = Math.min(100, Math.round((freeUsageCents / FREE_AI_USAGE_BUDGET_CENTS) * 100));

  const primaryLabel = loading
    ? "…"
    : isFreePlan
      ? `${usedCredits}/${FREE_PLAN_CREDIT_BUDGET} kred.`
      : `${balance ?? 0} kred.`;

  const secondaryLabel = loading
    ? null
    : isFreePlan
      ? `${freeUsageLeftCredits} kred. do końca limitu Free`
      : `Plan ${planId}`;

  return (
    <Link
      to="/billing"
      search={{ yearly: false }}
      className={cn(
        "hidden sm:flex flex-col gap-1.5 min-w-[148px] max-w-[200px] rounded-lg border border-foreground/10 bg-muted/30 px-2.5 py-2",
        "text-[10px] leading-tight text-muted-foreground hover:text-foreground hover:border-foreground/20 hover:bg-muted/50 transition-colors",
        className,
      )}
      title="Zużycie limitu / saldo kredytów — Plan i kredyty"
    >
      <span className="font-semibold text-foreground tabular-nums">{primaryLabel}</span>
      {isFreePlan && !loading && (
        <div
          className="relative h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden"
          role="progressbar"
          aria-valuenow={usagePct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Zużycie limitu planu Free"
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out",
              usagePct >= 90 ? "bg-amber-600" : usagePct >= 70 ? "bg-amber-500" : "bg-foreground",
            )}
            style={{ width: `${usagePct}%` }}
          />
        </div>
      )}
      {secondaryLabel ? <span className="text-muted-foreground">{secondaryLabel}</span> : null}
    </Link>
  );
}
