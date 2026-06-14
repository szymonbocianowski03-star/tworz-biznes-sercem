import { COST_PER_IMAGE_USD, CREDITS_PER_IMAGE, VIDEO_CREDITS } from "@/lib/plans";

/** Zgodne z supabase/functions/_shared/featurePricing.ts */
export const CREDITS_PER_USD_CENT = 4;
export const COST_PER_VIDEO_USD = 1;
export const VIDEO_CREDITS = 400;

export type AiPriceRow = {
  id: string;
  label: string;
  credits: number;
  /** Krótki dopisek widoczny dla użytkownika (bez kosztów API). */
  note?: string;
};

/** Cennik w kredytach — tylko to widzi użytkownik. */
export const AI_PRICE_LIST: AiPriceRow[] = [
  { id: "suggest", label: "Sugestie pod czatem", credits: 4 },
  { id: "extract-skill", label: "Ekstrakcja skilla", credits: 8 },
  { id: "chat", label: "Czat z agentem (1 odpowiedź)", credits: 16, note: "zależy od długości" },
  { id: "competitor-scan", label: "Skan konkurencji", credits: 24, note: "do 100 kred." },
  { id: "llm-visibility", label: "Widoczność w LLM", credits: 100 },
  { id: "seo-audit", label: "Audyt SEO", credits: 80, note: "do 200 kred." },
  { id: "generate-image", label: "Generowanie obrazu", credits: CREDITS_PER_IMAGE },
  { id: "generate-video", label: "Generowanie wideo", credits: VIDEO_CREDITS },
];

export function creditsFromUsd(usd: number): number {
  return Math.max(1, Math.ceil(usd * 100 * CREDITS_PER_USD_CENT));
}

/** Limit planu Free w kredytach (równowartość $1,00 = 400 kred.). */
export const FREE_PLAN_CREDIT_BUDGET = 100 * CREDITS_PER_USD_CENT;
