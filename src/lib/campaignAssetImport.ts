import { supabase } from "@/integrations/supabase/client";
import { isSupabaseSchemaMissingError } from "@/lib/supabaseSchemaHint";

export type ImportCampaignAssetResult =
  | { ok: true; assetId: string }
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
    .select("id")
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
  if (existing?.id) return { ok: true, assetId: existing.id };

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
    .select("id")
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

  return { ok: true, assetId: row.id };
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
    .select("id")
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
  if (existing?.id) return { ok: true, assetId: existing.id };

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
    .select("id")
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

  return { ok: true, assetId: row.id };
}
