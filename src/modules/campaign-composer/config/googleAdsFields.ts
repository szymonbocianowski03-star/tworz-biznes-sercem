import type { PlatformFieldConfig } from "./types";

export const googleAdsFields: PlatformFieldConfig = {
  provider: "google",
  campaignStructure: { campaign: "Kampania", group: "Grupa reklam / Asset group", ad: "Reklama / Assety" },
  steps: [
    { id: "account", label: "Konto" },
    { id: "campaign", label: "Kampania" },
    { id: "targeting", label: "Targetowanie i budżet" },
    { id: "creative", label: "Kreacja i media" },
    { id: "review", label: "Podgląd i publikacja" },
  ],
  campaignObjectives: [
    { value: "SEARCH", label: "Search" },
    { value: "PERFORMANCE_MAX", label: "Performance Max" },
    { value: "DISPLAY", label: "Display" },
    { value: "VIDEO", label: "Video (YouTube)" },
    { value: "DEMAND_GEN", label: "Demand Gen" },
    { value: "SHOPPING", label: "Shopping" },
    { value: "APP", label: "App" },
    { value: "LOCAL", label: "Local" },
    { value: "SMART", label: "Smart" },
  ],
  budgetTypes: [{ value: "daily", label: "Budżet dzienny" }],
  bidStrategies: [
    { value: "MAXIMIZE_CLICKS", label: "Maksymalizacja kliknięć" },
    { value: "MAXIMIZE_CONVERSIONS", label: "Maksymalizacja konwersji" },
    { value: "TARGET_CPA", label: "Docelowy CPA" },
    { value: "TARGET_ROAS", label: "Docelowy ROAS" },
  ],
  placements: [],
  creativeFormats: [{ value: "single_image", label: "Obrazy / wideo / RSA" }],
  ctaOptions: [
    { value: "LEARN_MORE", label: "Dowiedz się więcej" },
    { value: "SHOP_NOW", label: "Kup teraz" },
    { value: "SIGN_UP", label: "Zarejestruj się" },
    { value: "DOWNLOAD", label: "Pobierz" },
    { value: "GET_QUOTE", label: "Uzyskaj wycenę" },
  ],
  optimizationGoals: [
    { value: "CLICKS", label: "Kliknięcia" },
    { value: "CONVERSIONS", label: "Konwersje" },
    { value: "IMPRESSIONS", label: "Wyświetlenia" },
  ],
};

/** Wszystkie typy kampanii Google Ads dostępne w kreatorze. */
export const GOOGLE_CAMPAIGN_TYPE_OPTIONS = [
  { value: "SEARCH", label: "Search — wyszukiwarka (RSA)" },
  { value: "PERFORMANCE_MAX", label: "Performance Max — wszystkie kanały Google" },
  { value: "DISPLAY", label: "Display — sieć reklamowa" },
  { value: "VIDEO", label: "Video — YouTube" },
  { value: "DEMAND_GEN", label: "Demand Gen — Discover / YouTube / Gmail" },
  { value: "SHOPPING", label: "Shopping — produkty (Merchant Center)" },
  { value: "APP", label: "App — promocja aplikacji" },
  { value: "LOCAL", label: "Local — sklepy / lokalizacje" },
  { value: "SMART", label: "Smart — uproszczona kampania" },
] as const;

export type GoogleCampaignType = (typeof GOOGLE_CAMPAIGN_TYPE_OPTIONS)[number]["value"];

export const GOOGLE_CAMPAIGN_TYPE_HINTS: Record<GoogleCampaignType, string> = {
  SEARCH: "Reklamy tekstowe w wynikach wyszukiwania. Słowa kluczowe + nagłówki/opisy.",
  PERFORMANCE_MAX: "Jedna kampania na Search, Display, YouTube, Discover i Gmail. Wymaga zdjęć.",
  DISPLAY: "Banery i reklamy graficzne w sieci reklamowej. Zdjęcia + teksty.",
  VIDEO: "Reklamy na YouTube. Wklej linki do filmów YouTube.",
  DEMAND_GEN: "Popyt w Discover, YouTube i Gmail. Zdjęcia i/lub YouTube.",
  SHOPPING: "Karty produktów z Merchant Center. Podaj ID Merchant Center.",
  APP: "Instalacje / zaangażowanie w aplikacji. Podaj ID aplikacji (Android/iOS).",
  LOCAL: "Promocja lokalnych punktów / wizyt w sklepie.",
  SMART: "Uproszczona kampania z automatyzacją Google.",
};

export const GOOGLE_MIN_DAILY_BUDGET_MINOR = 1000;

export function googleNeedsImages(type: GoogleCampaignType): boolean {
  return type === "PERFORMANCE_MAX" || type === "DISPLAY" || type === "DEMAND_GEN" || type === "LOCAL";
}

export function googleNeedsYoutube(type: GoogleCampaignType): boolean {
  return type === "VIDEO";
}

export function googleNeedsKeywords(type: GoogleCampaignType): boolean {
  return type === "SEARCH";
}

export function googleNeedsMerchant(type: GoogleCampaignType): boolean {
  return type === "SHOPPING";
}

export function googleNeedsAppId(type: GoogleCampaignType): boolean {
  return type === "APP";
}
