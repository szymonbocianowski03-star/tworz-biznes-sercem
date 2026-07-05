// Ten sam cennik na stronie głównej i w /billing.
export const FREE_TIER_AI_USD_CAP = 1;
export const FREE_TIER_AI_USD_CAP_CENTS = 100;
export const COST_PER_IMAGE_USD = 0.25;
export const COST_PER_IMAGE_USD_CENTS = 25;
// Dźwięk (ElevenLabs TTS): $0,10 kosztu API = 40 kredytów.
export const COST_PER_AUDIO_USD = 0.1;
export const COST_PER_AUDIO_USD_CENTS = 10;

// Model kredytów (zgodny z supabase/functions/_shared/creditEconomy.ts):
// 1 obraz = $0,25 kosztu API = 100 kredytów (×4 za cent USD).
export const COST_PER_IMAGE_PLN = 1;
export const CREDITS_PER_IMAGE = 100;
/** Limit AI planu Free w kredytach (100¢ × 4 = 400 kred., ~4 obrazy). */
export const FREE_PLAN_AI_CREDITS = FREE_TIER_AI_USD_CAP_CENTS * 4;
// Prowizja właściciela = 50%: połowa ceny to marża, druga połowa pokrywa koszt generacji.
export const CREDIT_MARGIN_FRAC = 0.5;
/** Ułamek ceny paczki jednorazowej na generacje (subskrypcja = 50%, paczka = 25% → drożej za kredyt). */
export const RETAIL_POOL_FRAC = 0.25;

/** Ile kredytów zużywa jeden obraz (stała jednostka rozliczeniowa). */
export function creditsPerImage(): number {
  return CREDITS_PER_IMAGE;
}

/** Ile obrazów finansuje kwota w zł przy 50% marży (reszta to koszt 1 zł/obraz). */
export function imagesForPln(pln: number): number {
  if (pln <= 0) return 0;
  return Math.floor((pln * (1 - CREDIT_MARGIN_FRAC)) / COST_PER_IMAGE_PLN);
}

/** Miesięczna pula subskrypcji: X zł → floor(X·0,5) obrazów → ×100 kredytów. */
export function creditsForSubscriptionMonthly(pln: number): number {
  return imagesForPln(pln) * CREDITS_PER_IMAGE;
}

/** Jednorazowa paczka kredytów — drożej za kredyt niż subskrypcja (25% ceny → generacje). */
export function creditsForPaidRetailPln(pln: number): number {
  if (pln <= 0) return 0;
  const images = Math.floor((pln * RETAIL_POOL_FRAC) / COST_PER_IMAGE_PLN);
  return images * CREDITS_PER_IMAGE;
}

export type Plan = {
  id: string;
  name: string;
  monthly: number;
  credits: number;
  monthlyPriceId: string | null;
  yearlyPriceId: string | null;
  features: string[];
  highlight?: boolean;
};

// Nie pokazujemy limitów typu „konta reklamowe” ani „liczba produktów” — checkout ma mówić tylko o planie i kredytach.
const PLAN_FEATURES_SHARED: string[] = [
  "Kredyty AI zgodnie z wybranym planem",
  "Generowanie treści i materiałów AI",
  "Panel zużycia kredytów",
  "Dostęp do narzędzi MarketingNow",
];

// Płatność za rok z góry = ta sama zniżka tu i na landingzie (10%).
export const PLAN_YEARLY_DISCOUNT_FRAC = 0.1;

const PLAN_CREDITS = {
  starter: 2400,
  pro: 7400,
  growth: 19900,
  business: 24900,
  enterprise: 74900,
} as const;

const CREDIT_PACK_CREDITS = {
  credits_200: 400,
  credits_1000: 1900,
  credits_5000: 7400,
} as const;

// Ile zapłacisz za cały rok brutto (12 miesięcy z rabatem).
export function planYearlyTotalGrossPln(monthlyGrossPln: number): number {
  return Math.round(monthlyGrossPln * 12 * (1 - PLAN_YEARLY_DISCOUNT_FRAC));
}

// „Ile to wychodzi miesięcznie”, gdy rozłożysz roczną fakturę.
export function planYearlyMonthlyEquivalentGrossPln(monthlyGrossPln: number): number {
  return Math.round(monthlyGrossPln * (1 - PLAN_YEARLY_DISCOUNT_FRAC));
}

// Tekst pod ceną: Free — pula na start, płatne — miesięczna pula.
export function formatPlanCreditsLabel(p: Plan): string {
  if (p.id === "free") {
    return `${p.credits.toLocaleString("pl-PL")} kred. limit AI`;
  }
  return `${p.credits.toLocaleString("pl-PL")} kredytów / mies.`;
}

/** Liczba obrazów z puli przy założeniu ~1 zł / obraz. */
export function estimateImagesFromCredits(credits: number): number {
  const per = creditsPerImage();
  if (credits <= 0 || per <= 0) return 0;
  return Math.max(0, Math.floor(credits / per));
}

export function formatPlanImagesHint(_p: Plan): string | null {
  // Świadomie nie pokazujemy szacunku „~X obrazów / mies." — mylił użytkowników.
  return null;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    credits: FREE_PLAN_AI_CREDITS,
    monthlyPriceId: null,
    yearlyPriceId: null,
    features: [...PLAN_FEATURES_SHARED],
  },
  {
    id: "starter",
    name: "Starter",
    monthly: 49,
    credits: PLAN_CREDITS.starter,
    monthlyPriceId: "starter_monthly",
    yearlyPriceId: "starter_yearly",
    features: [...PLAN_FEATURES_SHARED],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 149,
    credits: PLAN_CREDITS.pro,
    monthlyPriceId: "pro_monthly",
    yearlyPriceId: "pro_yearly",
    features: [...PLAN_FEATURES_SHARED],
  },
  {
    id: "growth",
    name: "Growth",
    monthly: 399,
    credits: PLAN_CREDITS.growth,
    monthlyPriceId: "growth_monthly",
    yearlyPriceId: "growth_yearly",
    features: [...PLAN_FEATURES_SHARED],
    highlight: true,
  },
  {
    id: "business",
    name: "Business",
    monthly: 499,
    credits: PLAN_CREDITS.business,
    monthlyPriceId: "business_monthly",
    yearlyPriceId: "business_yearly",
    features: [...PLAN_FEATURES_SHARED],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: 1499,
    credits: PLAN_CREDITS.enterprise,
    monthlyPriceId: "enterprise_monthly",
    yearlyPriceId: "enterprise_yearly",
    features: [...PLAN_FEATURES_SHARED],
  },
];

function packLabel(credits: number): string {
  const n = credits.toLocaleString("pl-PL");
  return `${n} kredytów`;
}

export const CREDIT_PACKS = [
  { id: "credits_200", credits: CREDIT_PACK_CREDITS.credits_200, price: 19, label: packLabel(CREDIT_PACK_CREDITS.credits_200) },
  { id: "credits_1000", credits: CREDIT_PACK_CREDITS.credits_1000, price: 79, label: packLabel(CREDIT_PACK_CREDITS.credits_1000), highlight: true },
  { id: "credits_5000", credits: CREDIT_PACK_CREDITS.credits_5000, price: 299, label: packLabel(CREDIT_PACK_CREDITS.credits_5000) },
] as const;
