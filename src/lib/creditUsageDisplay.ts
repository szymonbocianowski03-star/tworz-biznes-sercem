import { CREDITS_PER_IMAGE, FREE_TIER_AI_USD_CAP_CENTS } from "@/lib/plans";
import { AI_PRICE_LIST, CREDITS_PER_USD_CENT, FREE_PLAN_CREDIT_BUDGET } from "@/lib/aiPricing";

export { AI_PRICE_LIST };

/** Etykiety PL dla źródeł z credit_usage_log.source */
const SOURCE_LABELS: Record<string, string> = {
  "seo-audit": "Audyt SEO",
  "llm-visibility": "Widoczność w LLM",
  "competitor-scan": "Skan konkurencji",
  "generate-image": "Generowanie obrazu",
  "generate-video": "Generowanie wideo",
  chat: "Czat z agentem",
  suggest: "Sugestie",
  ai: "AI",
};

export function creditUsageSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/-/g, " ");
}

/** Centy zużycia planu Free → kredyty do wyświetlenia. */
export function freeUsageCentsToCredits(cents: number): number {
  return Math.max(0, Math.round(Math.max(0, cents) * CREDITS_PER_USD_CENT));
}

export function formatFreeUsageCredits(cents: number): string {
  return `${freeUsageCentsToCredits(cents).toLocaleString("pl-PL")} kred.`;
}

export function formatFreePlanBudgetCredits(): string {
  return `${FREE_PLAN_CREDIT_BUDGET.toLocaleString("pl-PL")} kred.`;
}

/**
 * Wiersz historii zużycia — tylko nazwa funkcji i liczba kredytów (bez kosztów API).
 */
export function formatCreditUsageRow(opts: {
  source: string;
  usdCents: number;
  creditsDelta: number;
  isFreePlan: boolean;
}): { title: string; charge: string } {
  const title = creditUsageSourceLabel(opts.source);
  const charged = Math.abs(opts.creditsDelta);

  if (opts.isFreePlan || opts.creditsDelta === 0) {
    const used = freeUsageCentsToCredits(opts.usdCents);
    const budget = freeUsageCentsToCredits(FREE_TIER_AI_USD_CAP_CENTS);
    return {
      title,
      charge: `${used.toLocaleString("pl-PL")} / ${budget.toLocaleString("pl-PL")} kred. (Free)`,
    };
  }

  if (opts.source === "generate-image" && charged > 0) {
    const images = Math.max(1, Math.round(charged / CREDITS_PER_IMAGE));
    return {
      title,
      charge: images === 1 ? `−${charged} kred.` : `−${charged} kred. (${images} obrazy)`,
    };
  }

  return {
    title,
    charge: `−${charged} kred.`,
  };
}
