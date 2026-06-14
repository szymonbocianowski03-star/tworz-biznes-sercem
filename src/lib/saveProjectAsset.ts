import { supabase } from "@/integrations/supabase/client";

/** sessionStorage — wstępny prompt na stronie generatora wideo */
export const VIDEO_PROMPT_SEED_KEY = "mn.assets.videoPromptSeed";

export type SaveImageAssetInput = {
  imageUrl: string;
  prompt: string;
  size?: string;
  productName?: string | null;
  campaignName?: string | null;
  /** Gdy true — wgrywa plik tylko do storage, bez wpisu w bibliotece (generated_images). */
  skipDbInsert?: boolean;
};

/** Zapisuje grafikę do biblioteki (storage + generated_images). */
export async function saveImageToProjectAssets(
  input: SaveImageAssetInput,
): Promise<{ url: string; id: string | null; error?: string }> {
  const { imageUrl, prompt, size, productName, campaignName, skipDbInsert } = input;
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { url: imageUrl, id: null, error: "Nie jesteś zalogowany." };

    let bytes: Uint8Array;
    let mime = "image/png";

    if (imageUrl.startsWith("data:")) {
      const m = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!m) return { url: imageUrl, id: null, error: "Nieprawidłowy format obrazu (data URL)." };
      mime = m[1];
      const bin = atob(m[2]);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      let res: Response;
      try {
        res = await fetch(imageUrl);
      } catch (e) {
        console.error("[saveImageToProjectAssets] fetch", e);
        return { url: imageUrl, id: null, error: "Nie udało się pobrać obrazu (możliwe ograniczenie CORS)." };
      }
      if (!res.ok) return { url: imageUrl, id: null, error: `Nie udało się pobrać obrazu (HTTP ${res.status}).` };
      const blob = await res.blob();
      mime = blob.type || "image/png";
      const buf = await blob.arrayBuffer();
      bytes = new Uint8Array(buf);
    }

    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const path = `${u.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("generations")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) {
      console.error("[saveImageToProjectAssets] upload", upErr);
      return { url: imageUrl, id: null, error: `Błąd zapisu pliku: ${upErr.message}` };
    }

    const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    // Tryb „tylko storage” — zwracamy URL bez zapisu w bibliotece (id: null),
    // żeby użytkownik mógł sam zdecydować o zapisaniu do zasobów.
    if (skipDbInsert) {
      return { url: publicUrl, id: null };
    }

    const baseRow: Record<string, unknown> = {
      user_id: u.user.id,
      prompt,
      image_url: publicUrl,
      storage_path: path,
      size: size ?? null,
    };
    const rowWithMeta: Record<string, unknown> = { ...baseRow };
    if (productName) rowWithMeta.product_name = productName;
    if (campaignName) rowWithMeta.campaign_name = campaignName;

    const insertRow = async (row: Record<string, unknown>) =>
      supabase.from("generated_images").insert(row as never).select("id").single();

    let { data: rowData, error: insErr } = await insertRow(rowWithMeta);

    // Fallback: zdalna baza może nie mieć jeszcze kolumn product_name/campaign_name
    // (niewdrożona migracja). Wtedy zapisujemy bez metadanych, żeby zapis się udał.
    if (insErr && rowWithMeta !== baseRow) {
      const msg = `${insErr.message} ${insErr.code ?? ""}`.toLowerCase();
      const missingMetaColumn =
        msg.includes("product_name") ||
        msg.includes("campaign_name") ||
        msg.includes("schema cache") ||
        insErr.code === "PGRST204";
      if (missingMetaColumn) {
        console.warn("[saveImageToProjectAssets] brak kolumn metadanych — zapis bez nich", insErr.message);
        ({ data: rowData, error: insErr } = await insertRow(baseRow));
      }
    }

    if (insErr) {
      console.error("[saveImageToProjectAssets] insert", insErr);
      return { url: publicUrl, id: null, error: `Błąd zapisu w bazie: ${insErr.message}` };
    }
    return { url: publicUrl, id: rowData?.id ?? null };
  } catch (e) {
    console.error("[saveImageToProjectAssets]", e);
    return { url: imageUrl, id: null, error: e instanceof Error ? e.message : "Nieznany błąd zapisu." };
  }
}
