export type CreativeType =
  | "phone-chat"
  | "tools-comparison"
  | "dashboard-hero"
  | "product-mockup"
  | "viral-social";

export type AdFormat = "9:16" | "1:1" | "4:5" | "16:9";

export type PhonePosition = "center" | "center-left" | "center-right";

/** Układ rozmieszczenia warstw tekstowych na grafice. */
export type AdLayout =
  | "headline-top-cta-bottom"
  | "text-left-visual-right"
  | "visual-left-text-right"
  | "center-mockup-bubbles"
  | "price-cta-focus"
  | "poster-headline";

export interface AdCopy {
  headline: string;
  subheadline: string;
  user_message: string;
  ai_response: string;
  brand_name: string;
  side_badges: string[];
  features: string[];
  cta: string;
  price: string;
  slogan: string;
  disclaimer: string;
}

export interface AdStyle {
  bgFrom: string;
  bgTo: string;
  accent: string;
  text: string;
  glow: boolean;
  phonePosition: PhonePosition;
}

export interface AdCreative {
  creative_type: CreativeType;
  format: AdFormat;
  layout: AdLayout;
  visual_prompt: string;
  copy: AdCopy;
  style: AdStyle;
  backgroundUrl: string | null;
  /** Mocniejsze przyciemnienie tła — gdy walidacja wykryła osadzony tekst. */
  suppressEmbeddedText?: boolean;
}

export const LAYOUT_OPTIONS: {
  layout: AdLayout;
  label: string;
  description: string;
}[] = [
  {
    layout: "headline-top-cta-bottom",
    label: "Nagłówek u góry, CTA na dole",
    description: "Klasyczny układ reklamy — headline na górze, grafika w środku, przycisk CTA na dole.",
  },
  {
    layout: "text-left-visual-right",
    label: "Tekst po lewej, grafika po prawej",
    description: "Kolumna tekstu z lewej, wizualna część reklamy po prawej.",
  },
  {
    layout: "visual-left-text-right",
    label: "Grafika po lewej, tekst po prawej",
    description: "Odwrotny split — produkt/mockup po lewej, copy po prawej.",
  },
  {
    layout: "center-mockup-bubbles",
    label: "Mockup w centrum + dymki",
    description: "Telefon lub mockup w centrum, teksty w dymkach rozmowy i badge'ach.",
  },
  {
    layout: "price-cta-focus",
    label: "Duża cena i CTA",
    description: "Mocny akcent na cenę i przycisk akcji — idealny pod promocje.",
  },
  {
    layout: "poster-headline",
    label: "Plakat z dużym hasłem",
    description: "Wielki headline jak na plakacie, minimalna grafika, mocny przekaz.",
  },
];

export const CREATIVE_TEMPLATES: {
  type: CreativeType;
  label: string;
  description: string;
  defaultFormat: AdFormat;
  defaultLayout: AdLayout;
}[] = [
  {
    type: "phone-chat",
    label: "Phone Chat Recommendation Ad",
    description: "Telefon w centrum, dymki rozmowy, rekomendacja AI, lista narzędzi z checkmarkami.",
    defaultFormat: "9:16",
    defaultLayout: "center-mockup-bubbles",
  },
  {
    type: "tools-comparison",
    label: "AI Tools Comparison Ad",
    description: "Pionowa lista narzędzi z checkmarkami, promowana marka wyróżniona.",
    defaultFormat: "4:5",
    defaultLayout: "text-left-visual-right",
  },
  {
    type: "dashboard-hero",
    label: "SaaS Dashboard Hero Ad",
    description: "Dashboard jako element wizualny (bez placeholderów), tekst renderowany osobno.",
    defaultFormat: "16:9",
    defaultLayout: "headline-top-cta-bottom",
  },
  {
    type: "product-mockup",
    label: "Premium Product Mockup Ad",
    description: "Produkt/mockup w centrum, mocny headline, CTA.",
    defaultFormat: "1:1",
    defaultLayout: "price-cta-focus",
  },
  {
    type: "viral-social",
    label: "Viral Social Proof Ad",
    description: "Pytanie użytkownika, odpowiedź AI, wyróżnienie marki jako najlepszego rozwiązania.",
    defaultFormat: "4:5",
    defaultLayout: "center-mockup-bubbles",
  },
];

export const FORMAT_DIMENSIONS: Record<AdFormat, { w: number; h: number; imageSize: "1024x1024" | "1024x1536" | "1536x1024" }> = {
  "9:16": { w: 432, h: 768, imageSize: "1024x1536" },
  "4:5": { w: 540, h: 675, imageSize: "1024x1536" },
  "1:1": { w: 640, h: 640, imageSize: "1024x1024" },
  "16:9": { w: 768, h: 432, imageSize: "1536x1024" },
};

const LAYOUT_SET = new Set<string>(LAYOUT_OPTIONS.map((l) => l.layout));

export function isAdLayout(v: unknown): v is AdLayout {
  return typeof v === "string" && LAYOUT_SET.has(v);
}

export function defaultLayoutForType(type: CreativeType): AdLayout {
  return CREATIVE_TEMPLATES.find((t) => t.type === type)?.defaultLayout ?? "headline-top-cta-bottom";
}

export function defaultStyle(accent = "#8b5cf6"): AdStyle {
  return {
    bgFrom: "#0b1020",
    bgTo: "#1a1033",
    accent,
    text: "#ffffff",
    glow: true,
    phonePosition: "center",
  };
}

export function emptyCopy(): AdCopy {
  return {
    headline: "",
    subheadline: "",
    user_message: "",
    ai_response: "",
    brand_name: "",
    side_badges: [],
    features: [],
    cta: "",
    price: "",
    slogan: "",
    disclaimer: "",
  };
}

/**
 * Reguła dopisywana do KAŻDEGO promptu obrazu — model nie może rysować finalnych napisów.
 */
export const NO_TEXT_RULE =
  "Create only the visual part of the advertisement: background, mockup, product, person, lighting, composition and empty space for text. " +
  "Do not generate final readable text, lorem ipsum, random letters, fake words or broken typography. " +
  "The final copy will be generated separately and placed on top as editable text layers.";

/**
 * Heurystyczne wykrywanie, czy prompt wizualny nie wymusza napisów.
 */
export function visualPromptLooksClean(prompt: string): boolean {
  const s = (prompt || "").toLowerCase();
  const bad = [
    "lorem ipsum",
    "with text saying",
    "headline text",
    "caption text",
    "write the words",
    "readable text",
    "typography on",
    "text overlay",
  ];
  return !bad.some((b) => s.includes(b));
}

/** Nazwy warstw składających finalną kreację (dokumentacja / UI). */
export const AD_LAYER_NAMES = [
  "background image",
  "main visual / product / phone mockup",
  "headline text",
  "subheadline text",
  "CTA text",
  "price text",
  "company name / logo",
  "badges / icons",
] as const;
