import { supabase } from "@/integrations/supabase/client";

/** sessionStorage — wstępny prompt na stronie generatora wideo */
export const VIDEO_PROMPT_SEED_KEY = "mn.assets.videoPromptSeed";

/**
 * Wgrywa surowy materiał edytora (obraz/wideo/audio) do storage i zwraca publiczny URL.
 * Dzięki temu wgrane pliki są trwałe (nie znikają po przeładowaniu szkicu jak blob:).
 */
export async function uploadEditorMedia(
  data: Blob,
  ext: string,
  contentType?: string,
): Promise<{ url: string; error?: string }> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { url: "", error: "Nie jesteś zalogowany." };
    const buf = new Uint8Array(await data.arrayBuffer());
    const safeExt = (ext || "bin").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
    const path = `${u.user.id}/editor/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const { error } = await supabase.storage
      .from("generations")
      .upload(path, buf, { contentType: contentType || data.type || undefined, upsert: false });
    if (error) return { url: "", error: error.message };
    const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);
    return { url: pub.publicUrl };
  } catch (e) {
    return { url: "", error: e instanceof Error ? e.message : "Błąd wgrywania pliku." };
  }
}

/** Wgrywa plik z dysku (File) do storage edytora. */
export async function uploadEditorFile(file: File): Promise<{ url: string; error?: string }> {
  const extFromName = file.name.includes(".") ? file.name.split(".").pop() ?? "" : "";
  const ext = extFromName || file.type.split("/")[1] || "bin";
  return uploadEditorMedia(file, ext, file.type);
}

export type SaveVideoAssetInput = {
  videoUrl: string;
  prompt: string;
  dbId?: string | null;
  productName?: string | null;
  campaignName?: string | null;
};

function isGenerationsPublicUrl(url: string): boolean {
  return /\/storage\/v1\/object\/public\/generations\//.test(url);
}

/** Zapisuje wideo do biblioteki (storage + generated_videos). */
export async function saveVideoToProjectAssets(
  input: SaveVideoAssetInput,
): Promise<{ url: string; id: string | null; alreadySaved?: boolean; error?: string }> {
  const { videoUrl, prompt, dbId, productName, campaignName } = input;
  const trimmedUrl = videoUrl?.trim();
  if (!trimmedUrl) {
    return { url: "", id: dbId ?? null, error: "Brak pliku wideo do zapisania." };
  }

  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { url: trimmedUrl, id: dbId ?? null, error: "Nie jesteś zalogowany." };

    if (dbId && isGenerationsPublicUrl(trimmedUrl)) {
      return { url: trimmedUrl, id: dbId, alreadySaved: true };
    }

    let res: Response;
    try {
      res = await fetch(trimmedUrl);
    } catch (e) {
      console.error("[saveVideoToProjectAssets] fetch", e);
      return { url: trimmedUrl, id: dbId ?? null, error: "Nie udało się pobrać wideo (możliwe ograniczenie CORS)." };
    }
    if (!res.ok) {
      return { url: trimmedUrl, id: dbId ?? null, error: `Nie udało się pobrać wideo (HTTP ${res.status}).` };
    }

    const blob = await res.blob();
    const mime = blob.type || "video/mp4";
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);

    const ext = mime.includes("webm") ? "webm" : "mp4";
    const path =
      dbId != null
        ? `${u.user.id}/videos/${dbId}.${ext}`
        : `${u.user.id}/videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("generations")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (upErr) {
      console.error("[saveVideoToProjectAssets] upload", upErr);
      return { url: trimmedUrl, id: dbId ?? null, error: `Błąd zapisu pliku: ${upErr.message}` };
    }

    const { data: pub } = supabase.storage.from("generations").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    const baseRow: Record<string, unknown> = {
      user_id: u.user.id,
      prompt: prompt || "Wideo reklamowe",
      video_url: publicUrl,
      storage_path: path,
      status: "succeeded",
      user_reaction: "none",
    };
    const rowWithMeta: Record<string, unknown> = { ...baseRow };
    if (productName) rowWithMeta.product_name = productName;
    if (campaignName) rowWithMeta.campaign_name = campaignName;

    if (dbId) {
      const updateRow = async (row: Record<string, unknown>) =>
        supabase.from("generated_videos").update(row as never).eq("id", dbId).select("id").single();

      let { data: rowData, error: updErr } = await updateRow(rowWithMeta);
      if (updErr && rowWithMeta !== baseRow) {
        const msg = `${updErr.message} ${updErr.code ?? ""}`.toLowerCase();
        const missingMetaColumn =
          msg.includes("product_name") ||
          msg.includes("campaign_name") ||
          msg.includes("schema cache") ||
          updErr.code === "PGRST204";
        if (missingMetaColumn) {
          console.warn("[saveVideoToProjectAssets] brak kolumn metadanych — zapis bez nich", updErr.message);
          ({ data: rowData, error: updErr } = await updateRow(baseRow));
        }
      }
      if (updErr) {
        console.error("[saveVideoToProjectAssets] update", updErr);
        return { url: publicUrl, id: dbId, error: `Błąd zapisu w bazie: ${updErr.message}` };
      }
      return { url: publicUrl, id: rowData?.id ?? dbId };
    }

    const insertRow = async (row: Record<string, unknown>) =>
      supabase.from("generated_videos").insert(row as never).select("id").single();

    let { data: rowData, error: insErr } = await insertRow(rowWithMeta);
    if (insErr && rowWithMeta !== baseRow) {
      const msg = `${insErr.message} ${insErr.code ?? ""}`.toLowerCase();
      const missingMetaColumn =
        msg.includes("product_name") ||
        msg.includes("campaign_name") ||
        msg.includes("schema cache") ||
        insErr.code === "PGRST204";
      if (missingMetaColumn) {
        console.warn("[saveVideoToProjectAssets] brak kolumn metadanych — zapis bez nich", insErr.message);
        ({ data: rowData, error: insErr } = await insertRow(baseRow));
      }
    }
    if (insErr) {
      console.error("[saveVideoToProjectAssets] insert", insErr);
      return { url: publicUrl, id: null, error: `Błąd zapisu w bazie: ${insErr.message}` };
    }
    return { url: publicUrl, id: rowData?.id ?? null };
  } catch (e) {
    console.error("[saveVideoToProjectAssets]", e);
    return { url: trimmedUrl, id: dbId ?? null, error: e instanceof Error ? e.message : "Nieznany błąd zapisu." };
  }
}

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
      user_reaction: "none",
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
