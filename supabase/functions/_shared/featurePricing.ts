import {
  CREDITS_PER_USD_CENT,
  IMAGE_USD_CENTS,
  type TokenUsage,
  usdCentsFromTokenUsage,
} from "./aiCost.ts";
import {
  AUDIO_CREDITS,
  COST_PER_AUDIO_USD_CENTS,
  COST_PER_VIDEO_USD_CENTS,
  CREDITS_PER_IMAGE,
  VIDEO_CREDITS,
} from "./creditEconomy.ts";

/** Domyślny koszt API (¢) gdy brak tokenów z odpowiedzi — nie liczymy od znaków. */
export const FEATURE_USD_CENTS_DEFAULT: Record<string, number> = {
  suggest: 1,
  "extract-skill": 2,
  chat: 4,
  "campaign-ad-copy": 2,
  "seo-audit": 20,
  "llm-visibility": 8,
  "competitor-scan": 6,
  "generate-image": IMAGE_USD_CENTS,
  "generate-video": COST_PER_VIDEO_USD_CENTS,
  "generate-audio": COST_PER_AUDIO_USD_CENTS,
};

/** Górny limit kosztu API (¢) na jedno wywołanie — ochrona przed skrajnymi raportami. */
export const FEATURE_USD_CENTS_CAP: Record<string, number> = {
  suggest: 3,
  "extract-skill": 6,
  chat: 50,
  "campaign-ad-copy": 6,
  "seo-audit": 50,
  "llm-visibility": 25,
  "competitor-scan": 25,
  "generate-image": IMAGE_USD_CENTS,
  "generate-video": COST_PER_VIDEO_USD_CENTS,
  "generate-audio": COST_PER_AUDIO_USD_CENTS,
};

export type BillingSource =
  | "suggest"
  | "extract-skill"
  | "chat"
  | "seo-audit"
  | "llm-visibility"
  | "competitor-scan"
  | "generate-image"
  | "generate-video"
  | "generate-audio"
  | string;

export function creditsFromUsdCents(usdCents: number): number {
  return Math.max(1, Math.ceil(Math.max(0, usdCents) * CREDITS_PER_USD_CENT));
}

/** Stałe kredyty (obraz / wideo) — null = licz od centów × 4. */
export function fixedCreditsForSource(source: string, billingMultiplier = 1): number | null {
  const mult = Math.max(1, Math.min(4, billingMultiplier));
  if (source === "generate-image") return CREDITS_PER_IMAGE * mult;
  if (source === "generate-video") return VIDEO_CREDITS;
  if (source === "generate-audio") return AUDIO_CREDITS;
  return null;
}

export function resolveBillingUsdCents(opts: {
  source: string;
  actualUsdCents?: number;
  tokenUsage?: { model: string; usage: TokenUsage };
  billingMultiplier?: number;
}): number {
  const source = opts.source;
  const mult = Math.max(1, Math.min(4, Number(opts.billingMultiplier) || 1));

  if (source === "generate-image") {
    return IMAGE_USD_CENTS * mult;
  }
  if (source === "generate-video") {
    return COST_PER_VIDEO_USD_CENTS;
  }
  if (source === "generate-audio") {
    return COST_PER_AUDIO_USD_CENTS;
  }

  let usd: number;
  if (opts.actualUsdCents != null && opts.actualUsdCents > 0) {
    usd = opts.actualUsdCents;
  } else if (opts.tokenUsage) {
    usd = usdCentsFromTokenUsage(opts.tokenUsage.model, opts.tokenUsage.usage);
  } else {
    usd = FEATURE_USD_CENTS_DEFAULT[source] ?? 4;
  }

  const cap = FEATURE_USD_CENTS_CAP[source];
  if (cap != null) usd = Math.min(usd, cap);

  return Math.max(1, Math.round(usd));
}
