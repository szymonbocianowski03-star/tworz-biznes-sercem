import { supabaseEdgeFunctionUrl } from "@/integrations/supabase/publicEnv";
import { supabaseFnHeaders } from "@/lib/supabaseFnHeaders";
import { scheduleCreditsRefresh } from "@/lib/creditsRefresh";
import { imageMayContainEmbeddedText, RETRY_NO_TEXT_SUFFIX } from "./validateImage";
import {
  type AdCreative,
  type AdFormat,
  type AdLayout,
  type CreativeType,
  defaultLayoutForType,
  defaultStyle,
  emptyCopy,
  FORMAT_DIMENSIONS,
  isAdLayout,
  NO_TEXT_RULE,
} from "./types";

const CREATIVE_URL = supabaseEdgeFunctionUrl("generate-ad-creative");
const IMAGE_URL = supabaseEdgeFunctionUrl("generate-image");

const MAX_BG_RETRIES = 2;

type ServerCreative = {
  creative_type: CreativeType;
  format: AdFormat;
  layout?: AdLayout;
  visual_prompt: string;
  accent_color?: string;
  copy: Partial<AdCreative["copy"]>;
};

function ensureNoTextPrompt(visualPrompt: string, extraSuffix = ""): string {
  const base = visualPrompt.trim();
  const withRule = base.includes("Do not generate final readable text") ? base : `${base}\n\n${NO_TEXT_RULE}`;
  return extraSuffix ? `${withRule}\n\n${extraSuffix}` : withRule;
}

async function fetchBackgroundImage(prompt: string, format: AdFormat): Promise<{ dataUrl: string } | { error: string }> {
  const headers = await supabaseFnHeaders();
  if (!headers) return { error: "Zaloguj się, aby generować grafiki." };

  const size = FORMAT_DIMENSIONS[format]?.imageSize ?? "1024x1536";
  const r = await fetch(IMAGE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt, size, quality: "high", n: 1 }),
  });
  const data = (await r.json().catch(() => ({}))) as { images?: string[]; error?: string; message?: string };
  scheduleCreditsRefresh();

  if (!r.ok) {
    if (r.status === 402) return { error: data.message ?? "Brak kredytów — otwórz Plan i kredyty." };
    if (r.status === 401) return { error: "Brak dostępu do generowania grafik." };
    if (r.status === 429) return { error: "Limit zapytań — spróbuj za chwilę." };
    return { error: data.error ?? "Nie udało się wygenerować tła." };
  }

  const src = Array.isArray(data.images) ? data.images[0] : null;
  if (!src) return { error: "Brak obrazu w odpowiedzi serwera." };
  return { dataUrl: src };
}

/** Krok 1: model tekstowy generuje copy + visual_prompt (layout). */
export async function generateAdCreative(input: {
  brief: string;
  creativeType: CreativeType;
  format: AdFormat;
  layout?: AdLayout;
  brandName?: string | null;
  brandRules?: string | null;
}): Promise<{ creative: AdCreative } | { error: string }> {
  const headers = await supabaseFnHeaders();
  if (!headers) return { error: "Zaloguj się, aby generować reklamy." };

  const r = await fetch(CREATIVE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      brief: input.brief,
      creativeType: input.creativeType,
      format: input.format,
      layout: input.layout ?? defaultLayoutForType(input.creativeType),
      brandName: input.brandName ?? "",
      brandRules: input.brandRules ?? "",
    }),
  });
  const data = (await r.json().catch(() => ({}))) as { creative?: ServerCreative; error?: string; message?: string };
  scheduleCreditsRefresh();

  if (!r.ok) {
    if (r.status === 402) return { error: data.message ?? "Brak kredytów — otwórz Plan i kredyty." };
    if (r.status === 401) return { error: "Zaloguj się, aby generować reklamy." };
    if (r.status === 429) return { error: "Limit zapytań — spróbuj za chwilę." };
    return { error: data.error ?? "Nie udało się wygenerować treści reklamy." };
  }

  const sc = data.creative;
  if (!sc) return { error: "Brak treści w odpowiedzi serwera." };

  const accent = sc.accent_color || "#8b5cf6";
  const layout = isAdLayout(sc.layout) ? sc.layout : input.layout ?? defaultLayoutForType(input.creativeType);
  const creative: AdCreative = {
    creative_type: sc.creative_type ?? input.creativeType,
    format: sc.format ?? input.format,
    layout,
    visual_prompt: sc.visual_prompt ?? "",
    copy: { ...emptyCopy(), ...sc.copy },
    style: defaultStyle(accent),
    backgroundUrl: null,
    suppressEmbeddedText: false,
  };
  return { creative };
}

export type BackgroundGenerationResult =
  | { dataUrl: string; retried: number; suppressEmbeddedText: boolean }
  | { error: string };

/**
 * Krok 2: Image API generuje TYLKO tło/mockup — bez napisów.
 * Waliduje wynik i ponawia generację, gdy wykryje osadzony tekst.
 */
export async function generateAdBackground(
  visualPrompt: string,
  format: AdFormat,
): Promise<BackgroundGenerationResult> {
  let retried = 0;
  let suppressEmbeddedText = false;

  for (let attempt = 0; attempt <= MAX_BG_RETRIES; attempt++) {
    const extra = attempt > 0 ? RETRY_NO_TEXT_SUFFIX : "";
    const prompt = ensureNoTextPrompt(visualPrompt, extra);
    const result = await fetchBackgroundImage(prompt, format);
    if ("error" in result) return result;

    const mayHaveText = await imageMayContainEmbeddedText(result.dataUrl);
    if (!mayHaveText) {
      return { dataUrl: result.dataUrl, retried, suppressEmbeddedText };
    }

    if (attempt < MAX_BG_RETRIES) {
      retried++;
      continue;
    }

    // Po wyczerpaniu prób — użyj obrazu, ale wzmocnij overlay i polegaj na warstwach tekstowych.
    suppressEmbeddedText = true;
    return { dataUrl: result.dataUrl, retried, suppressEmbeddedText };
  }

  return { error: "Nie udało się wygenerować tła." };
}
