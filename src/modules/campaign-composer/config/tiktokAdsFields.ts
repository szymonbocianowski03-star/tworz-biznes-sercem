import type { PlatformFieldConfig, FieldOption } from "./types";

/** Konfiguracja pól wyłącznie dla TikTok Ads. */
export const tiktokAdsFields: PlatformFieldConfig = {
  provider: "tiktok",
  campaignStructure: { campaign: "Campaign", group: "Ad Group", ad: "Ad" },
  steps: [
    { id: "account", label: "Konto TikTok Ads" },
    { id: "campaign", label: "Campaign" },
    { id: "adgroup", label: "Ad Group" },
    { id: "targeting", label: "Targetowanie i budżet" },
    { id: "creative", label: "Video i kreacja" },
    { id: "tracking", label: "Tracking" },
    { id: "review", label: "Podgląd i publikacja" },
  ],
  campaignObjectives: [
    { value: "traffic", label: "Ruch (Traffic)" },
    { value: "website_conversion", label: "Konwersje (Conversions)" },
    { value: "website_form", label: "Pozyskiwanie leadów (Lead Generation)" },
    { value: "reach", label: "Zasięg (Reach)" },
    { value: "video_views", label: "Wyświetlenia wideo (Video Views)" },
    { value: "app_promotion", label: "Promocja aplikacji (App Promotion)" },
    { value: "tiktok_shop", label: "Sprzedaż produktów (Product Sales)" },
  ],
  budgetTypes: [
    { value: "no_limit", label: "Bez limitu (No Limit)" },
    { value: "daily", label: "Budżet dzienny (Daily Budget)" },
    { value: "lifetime", label: "Budżet całkowity (Lifetime Budget)" },
  ],
  bidStrategies: [
    { value: "BID_STRATEGY_LOWEST_COST", label: "Najniższy koszt (Lowest Cost)" },
    { value: "BID_STRATEGY_COST_CAP", label: "Limit kosztu (Cost Cap)" },
    { value: "BID_STRATEGY_BID_CAP", label: "Limit stawki (Bid Cap)" },
  ],
  placements: [
    { value: "automatic", label: "Automatic Placement" },
    { value: "PLACEMENT_TIKTOK", label: "TikTok" },
    { value: "PLACEMENT_PANGLE", label: "Pangle" },
    { value: "PLACEMENT_GLOBAL_APP_BUNDLE", label: "Global App Bundle" },
  ],
  creativeFormats: [
    { value: "video", label: "Uploaded Video" },
    { value: "existing", label: "Existing Media" },
    { value: "spark", label: "Spark Ad" },
  ],
  ctaOptions: [
    { value: "LEARN_MORE", label: "Learn More" },
    { value: "SHOP_NOW", label: "Shop Now" },
    { value: "SIGN_UP", label: "Sign Up" },
    { value: "DOWNLOAD", label: "Download" },
    { value: "CONTACT_US", label: "Contact Us" },
    { value: "APPLY_NOW", label: "Apply Now" },
    { value: "BOOK_NOW", label: "Book Now" },
    { value: "SUBSCRIBE", label: "Subscribe" },
    { value: "ORDER_NOW", label: "Order Now" },
    { value: "GET_QUOTE", label: "Get Quote" },
  ],
  optimizationGoals: [
    { value: "CLICK", label: "Kliknięcia (Clicks)" },
    { value: "CONVERT", label: "Konwersje (Conversions)" },
    { value: "REACH", label: "Zasięg (Reach)" },
    { value: "VIDEO_VIEW", label: "Wyświetlenia wideo" },
    { value: "LEAD_GENERATION", label: "Leady" },
    { value: "INSTALL", label: "Instalacje aplikacji" },
  ],
};

export const TIKTOK_GENDER_OPTIONS: FieldOption[] = [
  { value: "GENDER_UNLIMITED", label: "Wszyscy" },
  { value: "GENDER_MALE", label: "Mężczyźni" },
  { value: "GENDER_FEMALE", label: "Kobiety" },
];

export const TIKTOK_AGE_OPTIONS: FieldOption[] = [
  { value: "AGE_13_17", label: "13–17" },
  { value: "AGE_18_24", label: "18–24" },
  { value: "AGE_25_34", label: "25–34" },
  { value: "AGE_35_44", label: "35–44" },
  { value: "AGE_45_54", label: "45–54" },
  { value: "AGE_55_100", label: "55+" },
];