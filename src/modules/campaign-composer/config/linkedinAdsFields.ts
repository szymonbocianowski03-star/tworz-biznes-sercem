import type { PlatformFieldConfig, FieldOption } from "./types";

/** Konfiguracja pól wyłącznie dla LinkedIn Ads (B2B). */
export const linkedinAdsFields: PlatformFieldConfig = {
  provider: "linkedin",
  campaignStructure: { campaign: "Campaign / Campaign Group", group: "Ad Set", ad: "Ad" },
  steps: [
    { id: "account", label: "Konto LinkedIn Ads" },
    { id: "campaign", label: "Campaign / Campaign Group" },
    { id: "adset", label: "Objective i Ad Set" },
    { id: "targeting", label: "Targetowanie B2B" },
    { id: "budget", label: "Budżet i harmonogram" },
    { id: "creative", label: "Format reklamy i kreacja" },
    { id: "tracking", label: "Tracking" },
    { id: "review", label: "Podgląd i publikacja" },
  ],
  campaignObjectives: [
    { value: "BRAND_AWARENESS", label: "Brand Awareness" },
    { value: "WEBSITE_TRAFFIC", label: "Website Visits" },
    { value: "ENGAGEMENT", label: "Engagement" },
    { value: "VIDEO_VIEW", label: "Video Views" },
    { value: "LEAD_GENERATION", label: "Lead Generation" },
    { value: "WEBSITE_CONVERSION", label: "Website Conversions" },
    { value: "JOB_APPLICANTS", label: "Job Applicants" },
  ],
  budgetTypes: [
    { value: "daily", label: "Budżet dzienny (Daily Budget)" },
    { value: "lifetime", label: "Budżet całkowity (Lifetime Budget)" },
  ],
  bidStrategies: [
    { value: "max_delivery", label: "Maximum Delivery" },
    { value: "cost_cap", label: "Cost Cap" },
    { value: "manual", label: "Manual Bidding" },
  ],
  placements: [
    { value: "LINKEDIN", label: "LinkedIn (feed)" },
    { value: "AUDIENCE_NETWORK", label: "LinkedIn Audience Network" },
  ],
  creativeFormats: [
    { value: "single_image", label: "Single Image Ad" },
    { value: "video", label: "Video Ad" },
    { value: "carousel", label: "Carousel Image Ad" },
    { value: "document", label: "Document Ad" },
    { value: "message", label: "Message Ad" },
    { value: "conversation", label: "Conversation Ad" },
    { value: "text", label: "Text Ad" },
    { value: "spotlight", label: "Spotlight Ad" },
    { value: "follower", label: "Follower Ad" },
    { value: "event", label: "Event Ad" },
    { value: "single_job", label: "Single Job Ad" },
  ],
  ctaOptions: [
    { value: "LEARN_MORE", label: "Learn More" },
    { value: "SIGN_UP", label: "Sign Up" },
    { value: "REGISTER", label: "Register" },
    { value: "DOWNLOAD", label: "Download" },
    { value: "APPLY", label: "Apply" },
    { value: "CONTACT_US", label: "Contact Us" },
    { value: "SUBSCRIBE", label: "Subscribe" },
    { value: "JOIN", label: "Join" },
    { value: "ATTEND", label: "Attend" },
    { value: "REQUEST_DEMO", label: "Request Demo" },
  ],
  optimizationGoals: [
    { value: "WEBSITE_VISITS", label: "Wizyty na stronie" },
    { value: "IMPRESSIONS", label: "Wyświetlenia" },
    { value: "ENGAGEMENT", label: "Zaangażowanie" },
    { value: "VIDEO_VIEWS", label: "Wyświetlenia wideo" },
    { value: "LEADS", label: "Leady" },
    { value: "WEBSITE_CONVERSIONS", label: "Konwersje" },
  ],
};

export const LINKEDIN_AD_SET_TYPES: FieldOption[] = [
  { value: "classic", label: "Classic" },
  { value: "accelerate", label: "Accelerate" },
];