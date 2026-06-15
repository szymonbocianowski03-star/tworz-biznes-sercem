import { supabase } from "@/integrations/supabase/client";
import { supabaseEdgeFunctionUrl } from "@/integrations/supabase/publicEnv";
import { supabaseFnHeaders } from "@/lib/supabaseFnHeaders";
import { scheduleCreditsRefresh } from "@/lib/creditsRefresh";

const IMAGE_URL = supabaseEdgeFunctionUrl("generate-image");

export function chooseImageSizeFromPrompt(p: string): "1024x1024" | "1024x1536" | "1536x1024" {
  const s = (p || "").toLowerCase();
  if (s.includes("9:16") || s.includes("pion") || s.includes("vertical") || s.includes("story") || s.includes("reels")) {
    return "1024x1536";
  }
  if (s.includes("16:9") || s.includes("poziom") || s.includes("horizontal") || s.includes("banner") || s.includes("landscape")) {
    return "1536x1024";
  }
  return "1024x1024";
}

/** Buduje prompt do API obrazów. singleVariant=true przy ponownej generacji jednej kreacji. */
export function buildAdImagePrompt(
  userPrompt: string,
  brandVisualRules?: string | null,
  singleVariant = false,
): string {
  const clean = String(userPrompt ?? "").trim();
  const brand = brandVisualRules?.trim();
  const lines = [
    "Wygeneruj nowoczesną kreację reklamową o jakości studyjnej (fotorealizm, czyste światło, spójna kompozycja).",
    "Priorytet: czytelność i estetyka jak w kampaniach e-commerce premium.",
    "Zasady:",
    "- JĘZYK: cały tekst widoczny na obrazie (nagłówki, CTA, etykiety, ceny, znaczki, badge, opisy) MUSI być w języku polskim z poprawnymi polskimi znakami diakrytycznymi (ą, ć, ę, ł, ń, ó, ś, ź, ż). Nigdy nie używaj angielskiego ani innego języka w napisach na grafice;",
    "- zero losowego tekstu, znaków wodnych i logotypów; jeśli w prompt jest dokładny tekst CTA/cena, użyj tylko jego i nic więcej (po polsku);",
    "- unikaj zniekształceń (ręce/twarze/napisy), unikaj sztucznego 'AI look';",
    "- tło i rekwizyty minimalistyczne, dopasowane do produktu;",
    singleVariant
      ? "- jedna spójna kompozycja dopasowana do briefu."
      : "- 4 wyraźnie różne warianty (inny kadr/kompozycja/kolorystyka), ale ten sam przekaz.",
    "",
    `BRIEF (PL — wszystkie napisy na obrazie po polsku): ${clean}`,
  ];
  if (brand) {
    lines.push(
      "",
      "TOŻSAMOŚĆ WIZUALNA MARKI (pilnuj spójności — pierwszeństwo przed „domyślnym” stylem):",
      brand.slice(0, 3500),
    );
  }
  return lines.join("\n");
}

async function imageUrlToBytes(imageUrl: string): Promise<{ bytes: Uint8Array; mime: string } | { error: string }> {
  if (imageUrl.startsWith("data:")) {
    const m = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) return { error: "Nieprawidłowy format obrazu." };
    const mime = m[1];
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mime };
  }
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return { error: `Nie udało się pobrać obrazu (HTTP ${res.status}).` };
    const blob = await res.blob();
    const buf = await blob.arrayBuffer();
    return { bytes: new Uint8Array(buf), mime: blob.type || "image/png" };
  } catch {
    return { error: "Nie udało się pobrać wygenerowanego obrazu." };
  }
}

/** Generuje nową grafikę i podmienia istniejący wpis w generated_images (ten sam id). */
export async function replaceGeneratedImage(input: {
  dbId: string;
  prompt: string;
  productName?: string | null;
  oldStoragePath?: string | null;
  brandVisualRules?: string | null;
}): Promise<{ url: string; storagePath: string; prompt: string } | { error: string }> {
  const trimmed = input.prompt.trim();
  if (!trimmed) return { error: "Opis nie może być pusty." };

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Zaloguj się, aby generować grafiki." };

  const headers = await supabaseFnHeaders();
  if (!headers) return { error: "Zaloguj się, aby generować grafiki." };

  const size = chooseImageSizeFromPrompt(trimmed);
  const finalPrompt = buildAdImagePrompt(trimmed, input.brandVisualRules, true);

  const r = await fetch(IMAGE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt: finalPrompt, size, quality: "high", n: 1 }),
  });
  const data = (await r.json().catch(() => ({}))) as { images?: string[]; error?: string; message?: string };

  scheduleCreditsRefresh();

  if (!r.ok) {
    if (r.status === 402) return { error: data.message ?? "Brak kredytów — otwórz Plan i kredyty." };
    if (r.status === 401) return { error: "Brak dostępu do generowania obrazów." };
    if (r.status === 429) return { error: "Limit zapytań — spróbuj za chwilę." };
    return { error: data.error ?? "Nie udało się wygenerować nowej wersji grafiki." };
  }

  const src = Array.isArray(data.images) ? data.images[0] : null;
  if (!src) return { error: "Brak obrazu w odpowiedzi serwera." };

  const parsed = await imageUrlToBytes(src);
  if ("error" in parsed) return { error: parsed.error };

  const ext = parsed.mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const path = `${u.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("generations")
    .upload(path, parsed.bytes, { contentType: parsed.mime, upsert: false });
  if (upErr) return { error: `Błąd zapisu pliku: ${upErr.message}` };

  const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const patch: Record<string, unknown> = {
    prompt: trimmed,
    image_url: publicUrl,
    storage_path: path,
    size,
  };
  if (input.productName) patch.product_name = input.productName;

  const { error: updErr } = await (supabase as any).from("generated_images").update(patch).eq("id", input.dbId);
  if (updErr) {
    await supabase.storage.from("generations").remove([path]);
    return { error: updErr.message };
  }

  if (input.oldStoragePath && input.oldStoragePath !== path) {
    await supabase.storage.from("generations").remove([input.oldStoragePath]);
  }

  return { url: publicUrl, storagePath: path, prompt: trimmed };
}

/** Generuje pojedynczą grafikę (bez zapisu do bazy). */
export async function fetchGeneratedImageDataUrl(
  prompt: string,
  brandVisualRules?: string | null,
): Promise<{ dataUrl: string; size: string } | { error: string }> {
  const trimmed = prompt.trim();
  if (!trimmed) return { error: "Opis nie może być pusty." };

  const headers = await supabaseFnHeaders();
  if (!headers) return { error: "Zaloguj się, aby generować grafiki." };

  const size = chooseImageSizeFromPrompt(trimmed);
  const finalPrompt = buildAdImagePrompt(trimmed, brandVisualRules, true);

  const r = await fetch(IMAGE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt: finalPrompt, size, quality: "high", n: 1 }),
  });
  const data = (await r.json().catch(() => ({}))) as { images?: string[]; error?: string; message?: string };

  scheduleCreditsRefresh();

  if (!r.ok) {
    if (r.status === 402) return { error: data.message ?? "Brak kredytów." };
    return { error: data.error ?? "Błąd generowania obrazu." };
  }

  const src = Array.isArray(data.images) ? data.images[0] : null;
  if (!src) return { error: "Brak obrazu w odpowiedzi." };
  return { dataUrl: src, size };
}
