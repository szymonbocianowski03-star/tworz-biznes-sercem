/** Etykiety po polsku — bez kodów API w UI. */

export const META_OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_AWARENESS: "Rozpoznawalność marki",
  OUTCOME_TRAFFIC: "Ruch na stronie",
  OUTCOME_ENGAGEMENT: "Zaangażowanie",
  OUTCOME_LEADS: "Pozyskanie leadów",
  OUTCOME_SALES: "Sprzedaż",
  OUTCOME_APP_PROMOTION: "Promocja aplikacji",
};

export const META_SPECIAL_AD_LABELS: Record<string, string> = {
  NONE: "Brak (zwykła reklama)",
  EMPLOYMENT: "Oferty pracy",
  HOUSING: "Nieruchomości",
  CREDIT: "Kredyt / finanse",
  ISSUES_ELECTIONS_POLITICS: "Sprawy społeczne / polityka",
};

export const PROVIDER_LABELS: Record<string, string> = {
  meta: "Meta (Facebook / Instagram)",
  linkedin: "LinkedIn",
  tiktok: "TikTok Ads",
  google: "Google Ads",
};

export const LIFECYCLE_LABELS: Record<string, string> = {
  draft: "Szkic",
  ready: "Gotowy do publikacji",
  launching: "Publikowanie…",
  live: "Aktywna",
  paused: "Wstrzymana",
  archived: "Zarchiwizowana",
  failed: "Błąd publikacji",
};

export const PUBLISH_STATUS_LABELS: Record<string, string> = {
  queued: "W kolejce",
  running: "W trakcie",
  succeeded: "Opublikowano",
  failed: "Nie powiodło się",
  partial_success: "Częściowo opublikowano",
  cancelled: "Anulowano",
};

export const PUBLISH_STEP_LABELS: Record<string, string> = {
  meta_campaign: "Utworzenie kampanii",
  meta_adset: "Zestaw reklam",
  meta_ad_creative: "Kreacja reklamy",
  meta_ad: "Reklama",
  linkedin_campaign_group: "Grupa kampanii",
  linkedin_campaign: "Kampania",
  linkedin_creative: "Kreacja",
  tiktok_campaign: "Utworzenie kampanii",
  tiktok_adgroup: "Grupa reklam",
  tiktok_creative: "Kreacja reklamy",
  tiktok_lead_form: "Formularz leadowy",
  google_budget: "Budżet Google Ads",
  google_campaign: "Kampania Google Ads",
  google_ad_group: "Grupa reklam",
  google_rsa: "Reklama RSA / słowa kluczowe",
  google_assets: "Assety (zdjęcia / YouTube)",
  google_asset_group: "Asset group (Performance Max)",
  google_display_ad: "Reklama Display (RDA)",
  google_video_ad: "Reklama Video (YouTube)",
  google_demand_gen_ad: "Reklama Demand Gen",
  google_shopping_adgroup: "Grupa produktowa Shopping",
  google_app_campaign: "Kampania App",
};

export function labelPublishStatus(status: string): string {
  return PUBLISH_STATUS_LABELS[status] ?? "Nieznany status";
}

export function labelPublishStep(step: string): string {
  return PUBLISH_STEP_LABELS[step] ?? "Krok publikacji";
}

export function labelLifecycle(lifecycle: string): string {
  return LIFECYCLE_LABELS[lifecycle] ?? lifecycle;
}

export function labelProvider(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

/* ──────────────────────────────────────────────────────────────────────────
   TikTok Ads — etykiety i stałe (po polsku)
   ────────────────────────────────────────────────────────────────────────── */

export const TIKTOK_OBJECTIVE_LABELS: Record<string, string> = {
  traffic: "Ruch (Traffic)",
  website_conversion: "Konwersje (Conversions)",
  website_form: "Pozyskiwanie leadów (Lead Generation)",
  tiktok_instant_form: "Lead Gen — formularz natywny",
  reach: "Zasięg (Reach)",
  video_views: "Wyświetlenia wideo (Video Views)",
  app_promotion: "Promocja aplikacji (App Promotion)",
  tiktok_shop: "Sprzedaż produktów (Product Sales)",
  community_interaction: "Interakcje społeczności",
  direct_messages: "Wiadomości",
};

/** Cele dostępne w UI kreatora TikTok (kolejność wyświetlania). */
export const TIKTOK_OBJECTIVE_OPTIONS = [
  "traffic",
  "website_conversion",
  "website_form",
  "reach",
  "video_views",
  "app_promotion",
  "tiktok_shop",
] as const;

export const TIKTOK_CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "Dowiedz się więcej",
  SHOP_NOW: "Kup teraz",
  SIGN_UP: "Zarejestruj się",
  DOWNLOAD: "Pobierz",
  CONTACT_US: "Skontaktuj się",
  APPLY_NOW: "Aplikuj teraz",
  BOOK_NOW: "Zarezerwuj",
};

export const TIKTOK_OPTIMIZATION_GOAL_LABELS: Record<string, string> = {
  CLICK: "Kliknięcia (Clicks)",
  CONVERT: "Konwersje (Conversions)",
  REACH: "Zasięg",
  VIDEO_VIEW: "Wyświetlenia wideo",
  LEAD_GENERATION: "Leady",
  INSTALL: "Instalacje aplikacji",
};

export const TIKTOK_BID_STRATEGY_LABELS: Record<string, string> = {
  BID_STRATEGY_LOWEST_COST: "Najniższy koszt (auto)",
  BID_STRATEGY_COST_CAP: "Limit kosztu (cost cap)",
  BID_STRATEGY_MAX_CONVERSION: "Maks. konwersje",
};

export const TIKTOK_BUDGET_MODE_LABELS: Record<string, string> = {
  no_limit: "Bez limitu",
  daily: "Budżet dzienny",
  lifetime: "Budżet całkowity",
};

export const TIKTOK_STATUS_LABELS: Record<string, string> = {
  draft: "Szkic",
  active: "Aktywna",
  paused: "Wstrzymana",
};

export const TIKTOK_PLACEMENT_LABELS: Record<string, string> = {
  automatic: "Automatyczne (zalecane)",
  manual: "Ręczne",
};

/** Minimalne budżety TikTok (jednostki podrzędne waluty, np. grosze). Wartości orientacyjne wg TikTok Ads API. */
export const TIKTOK_MIN_CAMPAIGN_DAILY_MINOR = 5000; // ~50 jedn. waluty / dzień
export const TIKTOK_MIN_ADGROUP_DAILY_MINOR = 2000; // ~20 jedn. waluty / dzień

export function labelTikTokObjective(o: string): string {
  return TIKTOK_OBJECTIVE_LABELS[o] ?? o;
}

/** Buduje link do TikTok Ads Manager dla danej kampanii. */
export function tiktokAdsManagerUrl(advertiserId: string, campaignId?: string): string {
  const base = `https://ads.tiktok.com/i18n/perf/creation?aadvid=${encodeURIComponent(advertiserId)}`;
  return campaignId ? `${base}#campaign=${encodeURIComponent(campaignId)}` : base;
}
