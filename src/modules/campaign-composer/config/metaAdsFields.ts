import type { PlatformFieldConfig, FieldOption } from "./types";

/** Konfiguracja pól wyłącznie dla Meta Ads (Facebook / Instagram). */
export const metaAdsFields: PlatformFieldConfig = {
  provider: "meta",
  campaignStructure: { campaign: "Kampania", group: "Zestaw reklam", ad: "Reklama" },
  steps: [
    { id: "account", label: "Konto i zasoby" },
    { id: "campaign", label: "Kampania" },
    { id: "adset", label: "Zestaw reklam" },
    { id: "targeting", label: "Targetowanie i budżet" },
    { id: "creative", label: "Kreacja" },
    { id: "tracking", label: "Śledzenie" },
    { id: "review", label: "Podgląd i publikacja" },
  ],
  campaignObjectives: [
    { value: "OUTCOME_SALES", label: "Sprzedaż" },
    { value: "OUTCOME_LEADS", label: "Pozyskanie leadów" },
    { value: "OUTCOME_ENGAGEMENT", label: "Zaangażowanie" },
    { value: "OUTCOME_TRAFFIC", label: "Ruch na stronie" },
    { value: "OUTCOME_AWARENESS", label: "Rozpoznawalność marki" },
    { value: "OUTCOME_APP_PROMOTION", label: "Promocja aplikacji" },
  ],
  budgetTypes: [
    { value: "daily", label: "Budżet dzienny" },
    { value: "lifetime", label: "Budżet całkowity" },
  ],
  bidStrategies: [
    { value: "LOWEST_COST_WITHOUT_CAP", label: "Najniższy koszt (automatycznie)" },
    { value: "COST_CAP", label: "Limit kosztu" },
    { value: "LOWEST_COST_WITH_BID_CAP", label: "Limit stawki" },
  ],
  placements: [
    { value: "ADVANTAGE_PLUS", label: "Advantage+ (automatyczne)" },
    { value: "FACEBOOK_FEED", label: "Facebook — kanał informacyjny" },
    { value: "INSTAGRAM_FEED", label: "Instagram — kanał informacyjny" },
    { value: "INSTAGRAM_STORIES", label: "Instagram — relacje" },
    { value: "INSTAGRAM_REELS", label: "Instagram — Reels" },
    { value: "FACEBOOK_STORIES", label: "Facebook — relacje" },
    { value: "FACEBOOK_MARKETPLACE", label: "Facebook Marketplace" },
    { value: "FACEBOOK_VIDEO_FEEDS", label: "Facebook — wideo" },
    { value: "MESSENGER_INBOX", label: "Messenger — skrzynka" },
    { value: "AUDIENCE_NETWORK", label: "Sieć reklamowa (Audience Network)" },
  ],
  creativeFormats: [
    { value: "single_image", label: "Pojedynczy obraz" },
    { value: "single_video", label: "Pojedyncze wideo" },
    { value: "carousel", label: "Karuzela" },
    { value: "collection", label: "Kolekcja" },
    { value: "existing_post", label: "Istniejący post" },
  ],
  ctaOptions: [
    { value: "LEARN_MORE", label: "Dowiedz się więcej" },
    { value: "SHOP_NOW", label: "Kup teraz" },
    { value: "SIGN_UP", label: "Zarejestruj się" },
    { value: "CONTACT_US", label: "Skontaktuj się" },
    { value: "BOOK_NOW", label: "Zarezerwuj" },
    { value: "APPLY_NOW", label: "Aplikuj teraz" },
    { value: "DOWNLOAD", label: "Pobierz" },
    { value: "SEND_MESSAGE", label: "Wyślij wiadomość" },
    { value: "GET_OFFER", label: "Odbierz ofertę" },
  ],
  optimizationGoals: [
    { value: "LINK_CLICKS", label: "Kliknięcia linku" },
    { value: "LANDING_PAGE_VIEWS", label: "Wyświetlenia strony docelowej" },
    { value: "IMPRESSIONS", label: "Wyświetlenia" },
    { value: "REACH", label: "Zasięg" },
    { value: "OFFSITE_CONVERSIONS", label: "Konwersje (offsite)" },
    { value: "LEAD_GENERATION", label: "Pozyskanie leadów" },
    { value: "VIDEO_VIEWS", label: "Wyświetlenia wideo" },
  ],
};

export const META_GENDER_OPTIONS: FieldOption[] = [
  { value: "all", label: "Wszyscy" },
  { value: "male", label: "Mężczyźni" },
  { value: "female", label: "Kobiety" },
];