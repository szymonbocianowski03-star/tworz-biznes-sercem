import { supabaseEdgeFunctionUrl } from "@/integrations/supabase/publicEnv";
import { supabaseFnHeaders } from "@/lib/supabaseFnHeaders";
import { scheduleCreditsRefresh } from "@/lib/creditsRefresh";
import {
  type AdCreative,
  type AdFormat,
  type CreativeType,
  defaultStyle,
  emptyCopy,
  FORMAT_DIMENSIONS,
  NO_TEXT_RULE,
} from "./types";

const CREATIVE_URL = supabaseEdgeFunctionUrl("generate-ad-creative");
const IMAGE_URL = supabaseEdgeFunctionUrl("generate-image");

type ServerCreative = {
  creative_type: CreativeType;
  format: AdFormat;
  visual_prompt: string;
  accent_color?: string;
  copy: Partial<AdCreative["copy"]>;
};

/** Krok 1: model tekstowy generuje copy + visual_prompt (layout). */
export async function generateAdCreative(input: {
  brief: string;
  creativeType: CreativeType;
  format: AdFormat;
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
  const creative: AdCreative = {
    creative_type: sc.creative_type ?? input.creativeType,
    format: sc.format ?? input.format,
    visual_prompt: sc.visual_prompt ?? "",
    copy: { ...emptyCopy(), ...sc.copy },
    style: defaultStyle(accent),
    backgroundUrl: null,
  };
  return { creative };
}

/** Krok 2: Image API generuje TYLKO tło/mockup — bez napisów. */
export async function generateAdBackground(
  visualPrompt: string,
  format: AdFormat,
): Promise<{ dataUrl: string } | { error: string }> {
  const headers = await supabaseFnHeaders();
  if (!headers) return { error: "Zaloguj się, aby generować grafiki." };

  const size = FORMAT_DIMENSIONS[format]?.imageSize ?? "1024x1536";
  // Gwarancja: reguła „bez napisów” zawsze obecna, nawet jeśli model jej nie dołączył.
  const prompt = visualPrompt.includes("Do not generate readable text")
    ? visualPrompt
    : `${visualPrompt}\n\n${NO_TEXT_RULE}`;

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