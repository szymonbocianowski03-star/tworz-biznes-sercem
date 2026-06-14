// Jak liczymy kredyty po płatności — te same założenia co w src/lib/plans.ts:
// 1 obraz = $0,25 kosztu API = 100 kredytów (×4 za cent USD).
export const COST_PER_IMAGE_USD = 0.25;
export const COST_PER_IMAGE_USD_CENTS = 25;
export const COST_PER_VIDEO_USD = 1;
export const COST_PER_VIDEO_USD_CENTS = 100;
export const VIDEO_CREDITS = 400;
export const FREE_TIER_AI_USD_CAP = 1;
export const FREE_TIER_AI_USD_CAP_CENTS = 100;
export const COST_PER_IMAGE_PLN = 1;
export const CREDITS_PER_IMAGE = 100;
export const CREDIT_MARGIN_FRAC = 0.5;

/** Ile obrazów finansuje kwota w zł przy 50% marży (reszta to koszt 1 zł/obraz). */
function imagesForPln(pln: number): number {
  if (pln <= 0) return 0;
  return Math.floor((pln * (1 - CREDIT_MARGIN_FRAC)) / COST_PER_IMAGE_PLN);
}

/** Jednorazowa paczka kredytów: marża 50%, ×100 kredytów za obraz. */
export function creditsForRetailPln(pln: number): number {
  return imagesForPln(pln) * CREDITS_PER_IMAGE;
}

/** 1 obraz = 100 kredytów (stała jednostka rozliczeniowa). */
export function creditsPerImageRetail(): number {
  return CREDITS_PER_IMAGE;
}

/** Ile kredytów za 1 cent USD kosztu API (100 kred. ≈ 25 ¢). */
export const CREDITS_PER_USD_CENT = 4;

/** Subskrypcja miesięczna: X zł → floor(X·0,5) obrazów → ×100 kredytów. */
export function creditsForSubscriptionMonthlyPln(pln: number): number {
  return imagesForPln(pln) * CREDITS_PER_IMAGE;
}
