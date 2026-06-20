export type CreativeType =
  | "phone-chat"
  | "tools-comparison"
  | "dashboard-hero"
  | "product-mockup"
  | "viral-social";

export type AdFormat = "9:16" | "1:1" | "4:5" | "16:9";

export type PhonePosition = "center" | "center-left" | "center-right";

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
  visual_prompt: string;
  copy: AdCopy;
  style: AdStyle;
  backgroundUrl: string | null;
}

export const CREATIVE_TEMPLATES: {
  type: CreativeType;
  label: string;
  description: string;
  defaultFormat: AdFormat;
}[] = [
  {
    type: "phone-chat",
    label: "Phone Chat Recommendation Ad",
    description: "Telefon w centrum, dymki rozmowy, rekomendacja AI, lista narzędzi z checkmarkami.",
    defaultFormat: "9:16",
  },
  {
    type: "tools-comparison",
    label: "AI Tools Comparison Ad",
    description: "Pionowa lista narzędzi z checkmarkami, promowana marka wyróżniona.",
    defaultFormat: "4:5",
  },
  {
    type: "dashboard-hero",
    label: "SaaS Dashboard Hero Ad",
    description: "Dashboard jako element wizualny (bez placeholderów), tekst renderowany osobno.",
    defaultFormat: "16:9",
  },
  {
    type: "product-mockup",
    label: "Premium Product Mockup Ad",
    description: "Produkt/mockup w centrum, mocny headline, CTA.",
    defaultFormat: "1:1",
  },
  {
    type: "viral-social",
    label: "Viral Social Proof Ad",
    description: "Pytanie użytkownika, odpowiedź AI, wyróżnienie marki jako najlepszego rozwiązania.",
    defaultFormat: "4:5",
  },
];

export const FORMAT_DIMENSIONS: Record<AdFormat, { w: number; h: number; imageSize: "1024x1024" | "1024x1536" | "1536x1024" }> = {
  "9:16": { w: 432, h: 768, imageSize: "1024x1536" },
  "4:5": { w: 540, h: 675, imageSize: "1024x1536" },
  "1:1": { w: 640, h: 640, imageSize: "1024x1024" },
  "16:9": { w: 768, h: 432, imageSize: "1536x1024" },
};

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
  "Generate only the visual background, phone mockup, product mockup, lighting, gradients, scene and composition. " +
  "Do not generate readable text, fake text, lorem ipsum, random letters, fake UI labels or distorted words. " +
  "The final text will be generated separately and rendered programmatically as editable typography.";

/**
 * Heurystyczne wykrywanie, czy prompt wizualny nie wymusza napisów.
 * Zwraca true gdy prompt wygląda na bezpieczny (bez próśb o tekst).
 */
export function visualPromptLooksClean(prompt: string): boolean {
  const s = (prompt || "").toLowerCase();
  const bad = ["lorem ipsum", "with text saying", "headline text", "caption text", "write the words"];
  return !bad.some((b) => s.includes(b));
}