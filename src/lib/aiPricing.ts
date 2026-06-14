import {
  COST_PER_IMAGE_USD,
  COST_PER_IMAGE_USD_CENTS,
  CREDITS_PER_IMAGE,
  FREE_TIER_AI_USD_CAP,
} from "@/lib/plans";

/** Zgodne z supabase/functions/_shared/featurePricing.ts */
export const CREDITS_PER_USD_CENT = 4;
export const COST_PER_VIDEO_USD = 1;
export const COST_PER_VIDEO_USD_CENTS = 100;
export const VIDEO_CREDITS = 400;

export type AiPriceRow = {
  id: string;
  label: string;
  credits: number;
  usd: number;
  note?: string;
};

/** Cennik domyślny (gdy brak tokenów z API) — tokeny mogą lekko zmienić kwotę w granicach limitu. */
export const AI_PRICE_LIST: AiPriceRow[] = [
  { id: "suggest", label: "Sugestie pod czatem", credits: 4, usd: 0.01 },
  { id: "extract-skill", label: "Ekstrakcja skilla", credits: 8, usd: 0.02 },
  { id: "chat", label: "Czat z agentem (1 odpowiedź)", credits: 16, usd: 0.04, note: "zależy od długości" },
  { id: "competitor-scan", label: "Skan konkurencji", credits: 24, usd: 0.06, note: "max ~100 kred." },
  { id: "llm-visibility", label: "Widoczność w LLM", credits: 32, usd: 0.08, note: "max ~100 kred." },
  { id: "seo-audit", label: "Audyt SEO", credits: 80, usd: 0.2, note: "max ~200 kred." },
  { id: "generate-image", label: "Generowanie obrazu", credits: CREDITS_PER_IMAGE, usd: COST_PER_IMAGE_USD },
  { id: "generate-video", label: "Generowanie wideo", credits: VIDEO_CREDITS, usd: COST_PER_VIDEO_USD },
];

export function creditsFromUsd(usd: number): number {
  return Math.max(1, Math.ceil(usd * 100 * CREDITS_PER_USD_CENT));
}

export const PRICING_FOOTNOTE =
  `100 kred. = $${COST_PER_IMAGE_USD.toFixed(2)} kosztu API. Inne funkcje: koszt API × 4 = kredyty. Plan Free: max $${FREE_TIER_AI_USD_CAP.toFixed(2)} łącznie (~${Math.floor(FREE_TIER_AI_USD_CAP / COST_PER_IMAGE_USD)} obrazy).`;
