import { COST_PER_IMAGE_USD, CREDITS_PER_IMAGE, FREE_TIER_AI_USD_CAP } from "@/lib/plans";
import { AI_PRICE_LIST, PRICING_FOOTNOTE } from "@/lib/aiPricing";

export { AI_PRICE_LIST, PRICING_FOOTNOTE };

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

/** Zgodne z supabase/functions/_shared/creditEconomy.ts */
export const CREDITS_PER_USD_CENT = 4;

export function creditUsageSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/-/g, " ");
}

function formatUsd(cents: number): string {
  const usd = cents / 100;
  if (usd < 0.01) return "< $0.01";
  return `$${usd.toFixed(2)}`;
}

/**
 * usd_cents w bazie = koszt API w centach USD.
 * Kredyty (plan płatny) = centy × 4 (100 kred. = $0,25).
 */
export function formatCreditUsageRow(opts: {
  source: string;
  usdCents: number;
  creditsDelta: number;
  isFreePlan: boolean;
}): { title: string; charge: string; detail: string } {
  const title = creditUsageSourceLabel(opts.source);
  const costCents = Math.max(0, opts.usdCents);
  const charged = Math.abs(opts.creditsDelta);
  const freeCapLabel = `$${FREE_TIER_AI_USD_CAP.toFixed(2)}`;

  if (opts.isFreePlan || opts.creditsDelta === 0) {
    return {
      title,
      charge: `${formatUsd(costCents)} / ${freeCapLabel} limitu Free`,
      detail: "Koszt API sumuje się w limicie planu Free. Z puli kredytów nic nie odejmujemy.",
    };
  }

  if (opts.source === "generate-image" && charged > 0) {
    const images = Math.max(1, Math.round(charged / CREDITS_PER_IMAGE));
    return {
      title,
      charge: `−${charged} kred.`,
      detail:
        images === 1
          ? `Stałe: $${COST_PER_IMAGE_USD.toFixed(2)} → ${CREDITS_PER_IMAGE} kred.`
          : `${images}× obraz ($${COST_PER_IMAGE_USD.toFixed(2)}) → ${charged} kred.`,
    };
  }

  if (opts.source === "generate-video" && charged > 0) {
    return {
      title,
      charge: `−${charged} kred.`,
      detail: `Stałe: $1,00 kosztu API → 400 kred.`,
    };
  }

  const expected = Math.max(1, Math.ceil(costCents * CREDITS_PER_USD_CENT));

  return {
    title,
    charge: `−${charged} kred.`,
    detail:
      charged === expected
        ? `Koszt API ${formatUsd(costCents)} × 4 = ${charged} kred.`
        : `Koszt API ${formatUsd(costCents)} → ${charged} kred. (maks. z salda).`,
  };
}

export function formatFreeUsageUsd(cents: number): string {
  return formatUsd(cents);
}

export const CREDIT_USAGE_HELP = PRICING_FOOTNOTE;
