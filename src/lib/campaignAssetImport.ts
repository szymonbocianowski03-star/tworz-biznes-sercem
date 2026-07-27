import { supabase } from "@/integrations/supabase/client";
import { isSupabaseSchemaMissingError } from "@/lib/supabaseSchemaHint";
import { uploadEditorFile } from "@/lib/saveProjectAsset";

export type ImportCampaignAssetResult =
  | { ok: true; assetId: string; publicUrl: string }
  | { ok: false; error: string; schemaMissing?: boolean };

/** Importuje wygenerowany obraz do biblioteki mediów kampanii (cc_asset). */
export async function importGeneratedImageToCampaignAsset(input: {
  workspaceId: string;
  generatedImageId: string;
  imageUrl: string;
  prompt?: string | null;
}): Promise<ImportCampaignAssetResult> {
  const { workspaceId, generatedImageId, imageUrl, prompt } = input;
  if (!workspaceId) {
    return { ok: false, error: "Brak przestrzeni roboczej kampanii — odśwież stronę szkicu." };
  }

  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u.user) {
    return { ok: false, error: "Zaloguj się, aby dodać grafikę do kampanii." };
  }

  const { data: existing, error: findErr } = await supabase
    .from("cc_asset")
    .select("id,public_url")
    .eq("workspace_id", workspaceId)
    .eq("user_id", u.user.id)
    .eq("source_ref", generatedImageId)
    .maybeSingle();

  if (findErr) {
    const schemaMissing = isSupabaseSchemaMissingError(findErr.message);
    return {
      ok: false,
      error: schemaMissing
        ? "Brak tabeli biblioteki kampanii w Supabase — uruchom migracje (supabase/migrations/*campaign_composer*.sql)."
        : findErr.message,
      schemaMissing,
    };
  }
  if (existing?.id) return { ok: true, assetId: existing.id, publicUrl: existing.public_url };

  const { data: row, error: insErr } = await supabase
    .from("cc_asset")
    .insert({
      workspace_id: workspaceId,
      user_id: u.user.id,
      source: "generated_images",
      source_ref: generatedImageId,
      display_name: prompt?.slice(0, 120) ?? "Kreacja reklamowa",
      public_url: imageUrl,
      channels: [],
      provider_asset_map: {},
    })
    .select("id,public_url")
    .single();

  if (insErr || !row?.id) {
    const msg = insErr?.message ?? "Nie udało się zapisać materiału.";
    return {
      ok: false,
      error: isSupabaseSchemaMissingError(msg)
        ? "Brak tabeli biblioteki kampanii w Supabase — uruchom migracje (supabase/migrations/*campaign_composer*.sql)."
        : msg,
      schemaMissing: isSupabaseSchemaMissingError(msg),
    };
  }

  return { ok: true, assetId: row.id, publicUrl: row.public_url };
}

/** Importuje wygenerowane wideo do biblioteki mediów kampanii (cc_asset). */
export async function importGeneratedVideoToCampaignAsset(input: {
  workspaceId: string;
  generatedVideoId: string;
  videoUrl: string;
  prompt?: string | null;
}): Promise<ImportCampaignAssetResult> {
  const { workspaceId, generatedVideoId, videoUrl, prompt } = input;
  if (!workspaceId) {
    return { ok: false, error: "Brak przestrzeni roboczej kampanii — odśwież stronę szkicu." };
  }

  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u.user) {
    return { ok: false, error: "Zaloguj się, aby dodać wideo do kampanii." };
  }

  const { data: existing, error: findErr } = await supabase
    .from("cc_asset")
    .select("id,public_url")
    .eq("workspace_id", workspaceId)
    .eq("user_id", u.user.id)
    .eq("source_ref", generatedVideoId)
    .maybeSingle();

  if (findErr) {
    const schemaMissing = isSupabaseSchemaMissingError(findErr.message);
    return {
      ok: false,
      error: schemaMissing
        ? "Brak tabeli biblioteki kampanii w Supabase — uruchom migracje (supabase/migrations/*campaign_composer*.sql)."
        : findErr.message,
      schemaMissing,
    };
  }
  if (existing?.id) return { ok: true, assetId: existing.id, publicUrl: existing.public_url };

  const { data: row, error: insErr } = await supabase
    .from("cc_asset")
    .insert({
      workspace_id: workspaceId,
      user_id: u.user.id,
      source: "url",
      source_ref: generatedVideoId,
      display_name: prompt?.slice(0, 120) ?? "Wideo reklamowe",
      public_url: videoUrl,
      channels: [],
      provider_asset_map: {},
    })
    .select("id,public_url")
    .single();

  if (insErr || !row?.id) {
    const msg = insErr?.message ?? "Nie udało się zapisać materiału.";
    return {
      ok: false,
      error: isSupabaseSchemaMissingError(msg)
        ? "Brak tabeli biblioteki kampanii w Supabase — uruchom migracje (supabase/migrations/*campaign_composer*.sql)."
        : msg,
      schemaMissing: isSupabaseSchemaMissingError(msg),
    };
  }

  return { ok: true, assetId: row.id, publicUrl: row.public_url };
}

const IMAGE_MIME = /^image\/(jpeg|jpg|png|gif|webp)$/i;
const VIDEO_MIME = /^video\/(mp4|webm|quicktime|x-m4v)$/i;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Wgrywa plik z dysku (obraz/wideo) do storage i zapisuje jako cc_asset (source=upload). */
export async function uploadLocalFileToCampaignAsset(input: {
  workspaceId: string;
  file: File;
}): Promise<ImportCampaignAssetResult & { kind?: "image" | "video" }> {
  const { workspaceId, file } = input;
  if (!workspaceId) {
    return { ok: false, error: "Brak przestrzeni roboczej kampanii — odśwież stronę szkicu." };
  }

  const isImage = IMAGE_MIME.test(file.type) || /\.(jpe?g|png|gif|webp)$/i.test(file.name);
  const isVideo = VIDEO_MIME.test(file.type) || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
  if (!isImage && !isVideo) {
    return { ok: false, error: "Dozwolone formaty: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV." };
  }
  if (isImage && file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Obraz jest za duży (max 10 MB)." };
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return { ok: false, error: "Wideo jest za duże (max 100 MB)." };
  }

  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u.user) {
    return { ok: false, error: "Zaloguj się, aby wgrać plik." };
  }

  const up = await uploadEditorFile(file);
  if (up.error || !up.url) {
    return { ok: false, error: up.error || "Nie udało się wgrać pliku do storage." };
  }

  const { data: row, error: insErr } = await supabase
    .from("cc_asset")
    .insert({
      workspace_id: workspaceId,
      user_id: u.user.id,
      source: "upload",
      source_ref: `upload:${Date.now()}-${file.name.slice(0, 40)}`,
      display_name: file.name.slice(0, 120),
      public_url: up.url,
      channels: [],
      provider_asset_map: {},
    })
    .select("id,public_url")
    .single();

  if (insErr || !row?.id) {
    const msg = insErr?.message ?? "Nie udało się zapisać materiału w bibliotece kampanii.";
    return {
      ok: false,
      error: isSupabaseSchemaMissingError(msg)
        ? "Brak tabeli biblioteki kampanii w Supabase — uruchom migracje."
        : msg,
      schemaMissing: isSupabaseSchemaMissingError(msg),
    };
  }

  return {
    ok: true,
    assetId: row.id,
    publicUrl: row.public_url,
    kind: isVideo ? "video" : "image",
  };
}
