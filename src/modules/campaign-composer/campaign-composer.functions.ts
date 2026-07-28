import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { campaignComposerDraftPayloadSchema, defaultDraftPayload } from "./domain/draft-schema";
import { blockingCount, runPreflightValidation } from "./validation/preflight";
import { buildLocalPreview } from "./preview/engines";
import { loadIntegrationDefaults, mergeIntegrationDefaults, preflightContext } from "./integration-defaults";
import { isCampaignComposerDryRun, processLaunchJob } from "./launch/launch-engine";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";

const WorkspaceIn = z.object({ name: z.string().min(1).max(80).optional() });

export const ccEnsureWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => WorkspaceIn.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const name = data.name?.trim() || "Przestrzeń";
    const { data: existing, error: readErr } = await supabase.from("cc_workspace").select("id").eq("user_id", userId).eq("name", name).maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (existing?.id) return { workspaceId: existing.id };

    const { data: row, error: insertErr } = await supabase
      .from("cc_workspace")
      .insert({ user_id: userId, name })
      .select("id")
      .single();
    if (insertErr) {
      if (insertErr.code === "23505") {
        const { data: retry } = await supabase.from("cc_workspace").select("id").eq("user_id", userId).eq("name", name).maybeSingle();
        if (retry?.id) return { workspaceId: retry.id };
      }
      throw new Error(insertErr.message);
    }
    if (!row?.id) throw new Error("Nie udało się utworzyć przestrzeni roboczej kampanii.");
    return { workspaceId: row.id };
  });

export const ccListDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("cc_campaign_draft")
      .select("id,title,provider,lifecycle,updated_at,workspace_id")
      .eq("user_id", userId)
      .eq("workspace_id", data.workspaceId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { drafts: rows ?? [] };
  });

const SaveDraftIn = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  title: z.string().min(1),
  provider: z.enum(["meta", "linkedin", "tiktok", "google"]),
  composerMode: z.string().optional(),
  sourceDraftId: z.string().uuid().optional(),
  draftPayload: z.unknown(),
  syncPatch: z.record(z.string(), z.any()).optional(),
});

export const ccSaveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveDraftIn.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const parsed = campaignComposerDraftPayloadSchema.parse(data.draftPayload);
    let sync_state: Record<string, Json> = { ...(data.syncPatch ?? {}) } as Record<string, Json>;

    if (data.id) {
      const { data: prev } = await supabase
        .from("cc_campaign_draft")
        .select("sync_state")
        .eq("id", data.id)
        .eq("user_id", userId)
        .maybeSingle();
      sync_state = {
        ...((prev?.sync_state as Record<string, Json> | null) ?? {}),
        ...sync_state,
      };
    }

    if (data.id) {
      const updateRow: {
        title: string;
        draft_payload: Json;
        sync_state: Json;
        updated_at: string;
        composer_mode?: string;
        source_draft_id?: string | null;
      } = {
        title: data.title,
        draft_payload: parsed as unknown as Json,
        sync_state: sync_state as Json,
        updated_at: new Date().toISOString(),
      };
      if (data.composerMode !== undefined) updateRow.composer_mode = data.composerMode;
      if (data.sourceDraftId !== undefined) updateRow.source_draft_id = data.sourceDraftId;
      const { data: row, error } = await supabase
        .from("cc_campaign_draft")
        .update(updateRow)
        .eq("id", data.id)
        .eq("user_id", userId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }
    const { data: row, error } = await supabase
      .from("cc_campaign_draft")
      .insert({
        workspace_id: data.workspaceId,
        user_id: userId,
        title: data.title,
        provider: data.provider,
        composer_mode: data.composerMode ?? "create_new",
        source_draft_id: data.sourceDraftId ?? null,
        draft_payload: parsed as unknown as Json,
        sync_state: sync_state as Json,
        lifecycle: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const ccGetDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("cc_campaign_draft").select("*").eq("id", data.id).eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return { draft: row };
  });

const LaunchIn = z.object({
  draftId: z.string().uuid(),
  intent: z.enum(["draft_only", "go_live"]),
  idempotencyKey: z.string().min(8).max(200),
});

export const ccEnqueueLaunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LaunchIn.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: drow } = await supabase.from("cc_campaign_draft").select("*").eq("id", data.draftId).eq("user_id", userId).maybeSingle();
    if (!drow) throw new Error("Nie znaleziono draftu");
    const raw = campaignComposerDraftPayloadSchema.parse(drow.draft_payload);
    const defaults = await loadIntegrationDefaults(supabase, userId, raw);
    let payload = mergeIntegrationDefaults(raw, defaults);
    const syncPatch: Record<string, string | null> = {};
    if (payload.channel.provider === "tiktok" && defaults.tiktokConnectionId) {
      syncPatch.tiktok_connection_id = defaults.tiktokConnectionId;
    }
    if (payload.channel.provider === "google" && defaults.googleConnectionId) {
      syncPatch.google_connection_id = defaults.googleConnectionId;
    }
    if (payload.channel.provider === "meta" && payload.channel.metaConnectionId) {
      syncPatch.meta_connection_id = payload.channel.metaConnectionId;
    }
    if (payload.channel.provider === "linkedin" && payload.channel.linkedinConnectionId) {
      syncPatch.linkedin_connection_id = payload.channel.linkedinConnectionId;
    }
    if (payload.channel.provider === "google" && payload.channel.googleConnectionId) {
      syncPatch.google_connection_id = payload.channel.googleConnectionId;
    }
    if (payload !== raw || Object.keys(syncPatch).length > 0) {
      const prevSync = (drow.sync_state as Record<string, string | null> | null) ?? {};
      await supabase
        .from("cc_campaign_draft")
        .update({
          draft_payload: payload as unknown as Json,
          sync_state: { ...prevSync, ...syncPatch } as unknown as Json,
        })
        .eq("id", data.draftId)
        .eq("user_id", userId);
    }
    const issues = runPreflightValidation(payload, preflightContext(payload));
    if (blockingCount(issues) > 0 && data.intent === "go_live") {
      return { ok: false as const, issues };
    }
    const { data: job, error } = await supabase
      .from("cc_launch_job")
      .insert({
        draft_id: data.draftId,
        user_id: userId,
        idempotency_key: data.idempotencyKey,
        intent: data.intent,
        status: "queued",
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false as const, error: "duplicate_idempotency", issues: [] };
      throw new Error(error.message);
    }

    const launch = await processLaunchJob(supabaseAdmin, job.id);
    const dryRun = isCampaignComposerDryRun(data.intent);

    return { ok: true as const, jobId: job.id, issues, launch, dryRun };
  });

export const ccCancelLaunchJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("cc_launch_job").update({ cancel_requested: true }).eq("id", data.jobId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ccRunPreflight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ draftId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: drow } = await supabase.from("cc_campaign_draft").select("*").eq("id", data.draftId).eq("user_id", userId).maybeSingle();
    if (!drow) return { issues: [] as const };
    const raw = campaignComposerDraftPayloadSchema.parse(drow.draft_payload);
    const defaults = await loadIntegrationDefaults(supabase, userId, raw);
    const payload = mergeIntegrationDefaults(raw, defaults);
    const issues = runPreflightValidation(payload, preflightContext(payload));
    return { issues, preview: buildLocalPreview(payload, issues) };
  });

export const ccProcessLaunchJobDev = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase.from("cc_launch_job").select("user_id").eq("id", data.jobId).maybeSingle();
    if (!job || job.user_id !== userId) throw new Error("Forbidden");
    const res = await processLaunchJob(supabaseAdmin, data.jobId);
    return res;
  });

const NewDraftIn = z.object({
  workspaceId: z.string().uuid(),
  provider: z.enum(["meta", "linkedin", "tiktok", "google"]),
  title: z.string().min(1),
  adAccountId: z.string().default(""),
  metaConnectionId: z.string().uuid().optional(),
  linkedinConnectionId: z.string().uuid().optional(),
  tiktokConnectionId: z.string().uuid().optional(),
  googleConnectionId: z.string().uuid().optional(),
  metaPageId: z.string().optional(),
  linkedinOrganizationUrn: z.string().optional(),
  mode: z.enum(["create_new", "from_previous", "use_existing", "duplicate_structure"]).optional(),
  sourceDraftId: z.string().uuid().optional(),
});

export const ccCreateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NewDraftIn.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const base = defaultDraftPayload({
      provider: data.provider,
      adAccountId: data.adAccountId,
      campaignName: data.title,
    });
    const merged = campaignComposerDraftPayloadSchema.parse({
      ...base,
      mode: data.mode ?? "create_new",
      channel: {
        ...base.channel,
        metaConnectionId: data.metaConnectionId,
        linkedinConnectionId: data.linkedinConnectionId,
        tiktokConnectionId: data.tiktokConnectionId,
        googleConnectionId: data.googleConnectionId,
        metaPageId: data.metaPageId,
        linkedinOrganizationUrn: data.linkedinOrganizationUrn,
      },
    });
    const sync_state: Json = {
      meta_connection_id: data.metaConnectionId ?? null,
      linkedin_connection_id: data.linkedinConnectionId ?? null,
      tiktok_connection_id: data.tiktokConnectionId ?? null,
      google_connection_id: data.googleConnectionId ?? null,
    } as unknown as Json;
    const { data: row, error } = await supabase
      .from("cc_campaign_draft")
      .insert({
        workspace_id: data.workspaceId,
        user_id: userId,
        title: data.title,
        provider: data.provider,
        composer_mode: data.mode ?? "create_new",
        source_draft_id: data.sourceDraftId ?? null,
        draft_payload: merged as unknown as Json,
        sync_state,
        lifecycle: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const ccDuplicateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sourceId: z.string().uuid(), workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src } = await supabase.from("cc_campaign_draft").select("*").eq("id", data.sourceId).eq("user_id", userId).maybeSingle();
    if (!src) throw new Error("Brak źródła");
    const payload = campaignComposerDraftPayloadSchema.parse(src.draft_payload);
    payload.mode = "duplicate_structure";
    const { data: row, error } = await supabase
      .from("cc_campaign_draft")
      .insert({
        workspace_id: data.workspaceId,
        user_id: userId,
        title: `${src.title} (kopia)`,
        provider: src.provider,
        composer_mode: "duplicate_structure",
        source_draft_id: src.id,
        draft_payload: payload as unknown as Json,
        sync_state: src.sync_state as Json,
        lifecycle: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const ccListAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase.from("cc_asset").select("*").eq("workspace_id", data.workspaceId).eq("user_id", userId);
    return { assets: rows ?? [] };
  });

const ImportIn = z.object({
  workspaceId: z.string().uuid(),
  generatedImageIds: z.array(z.string().uuid()).max(24),
});

export const ccImportGeneratedImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ImportIn.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: imgs } = await supabase
      .from("generated_images")
      .select("id,image_url,prompt")
      .in("id", data.generatedImageIds)
      .eq("user_id", userId);
    const created: string[] = [];
    for (const im of imgs ?? []) {
      const { data: existing } = await supabase
        .from("cc_asset")
        .select("id")
        .eq("workspace_id", data.workspaceId)
        .eq("user_id", userId)
        .eq("source_ref", im.id)
        .maybeSingle();
      if (existing?.id) {
        created.push(existing.id);
        continue;
      }
      const { data: row, error } = await supabase
        .from("cc_asset")
        .insert({
          workspace_id: data.workspaceId,
          user_id: userId,
          source: "generated_images",
          source_ref: im.id,
          display_name: im.prompt?.slice(0, 120) ?? "Asset",
          public_url: im.image_url,
          channels: [],
          provider_asset_map: {},
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (row) created.push(row.id);
    }
    if (data.generatedImageIds.length > 0 && created.length === 0) {
      throw new Error("Nie znaleziono grafik do importu — upewnij się, że są zapisane w Zasobach.");
    }
    return { importedIds: created };
  });

const ImportVideosIn = z.object({
  workspaceId: z.string().uuid(),
  generatedVideoIds: z.array(z.string().uuid()).max(24),
});

export const ccImportGeneratedVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ImportVideosIn.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: vids } = await supabase
      .from("generated_videos")
      .select("id,video_url,prompt,status")
      .in("id", data.generatedVideoIds)
      .eq("user_id", userId);
    const created: string[] = [];
    for (const v of vids ?? []) {
      if (!v.video_url || v.status !== "succeeded") continue;
      const { data: existing } = await supabase
        .from("cc_asset")
        .select("id")
        .eq("workspace_id", data.workspaceId)
        .eq("user_id", userId)
        .eq("source_ref", v.id)
        .maybeSingle();
      if (existing?.id) {
        created.push(existing.id);
        continue;
      }
      const { data: row } = await supabase
        .from("cc_asset")
        .insert({
          workspace_id: data.workspaceId,
          user_id: userId,
          source: "url",
          source_ref: v.id,
          display_name: v.prompt?.slice(0, 120) ?? "Wideo",
          public_url: v.video_url,
          channels: [],
          provider_asset_map: {},
        })
        .select("id")
        .single();
      if (row) created.push(row.id);
    }
    return { importedIds: created };
  });

const PatchAssetIn = z.object({
  id: z.string().uuid(),
  displayName: z.string().optional(),
  altText: z.string().optional(),
  channels: z.array(z.string()).optional(),
});

export const ccPatchAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PatchAssetIn.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("cc_asset")
      .update({
        ...(data.displayName !== undefined ? { display_name: data.displayName } : {}),
        ...(data.altText !== undefined ? { alt_text: data.altText } : {}),
        ...(data.channels !== undefined ? { channels: data.channels } : {}),
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ccDeleteAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("cc_asset").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const BulkIn = z.object({
  workspaceId: z.string().uuid(),
  draftIds: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(["pause", "resume", "archive", "delete", "retry_launch", "duplicate"]),
});

export const ccBulkAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkIn.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const results: {
      objectName: string;
      provider: string;
      action: string;
      result: string;
      providerMessage: string;
      retryAvailable: "yes" | "no";
    }[] = [];

    const { data: drafts } = await supabase.from("cc_campaign_draft").select("id,title,provider,lifecycle").in("id", data.draftIds).eq("user_id", userId);

    for (const d of drafts ?? []) {
      let result = "noop";
      let msg = "";
      let retry: "yes" | "no" = "no";
      if (data.action === "duplicate") {
        const { data: full } = await supabase.from("cc_campaign_draft").select("draft_payload,sync_state").eq("id", d.id).single();
        const payload = campaignComposerDraftPayloadSchema.parse(full?.draft_payload);
        const { error } = await supabase.from("cc_campaign_draft").insert({
          workspace_id: data.workspaceId,
          user_id: userId,
          title: `${d.title} (zbiorcza kopia)`,
          provider: d.provider,
          composer_mode: "duplicate_structure",
          source_draft_id: d.id,
          draft_payload: payload as unknown as Json,
          sync_state: (full?.sync_state ?? {}) as Json,
          lifecycle: "draft",
        });
        result = error ? "error" : "ok";
        msg = error?.message ?? "";
        retry = error ? "yes" : "no";
      } else if (data.action === "pause") {
        const { error } = await supabase.from("cc_campaign_draft").update({ lifecycle: "paused" }).eq("id", d.id);
        result = error ? "error" : "ok";
        msg = error?.message ?? "lifecycle_local_only";
      } else if (data.action === "resume") {
        const { error } = await supabase.from("cc_campaign_draft").update({ lifecycle: "live" }).eq("id", d.id);
        result = error ? "error" : "ok";
        msg = error?.message ?? "";
      } else if (data.action === "archive") {
        const { error } = await supabase.from("cc_campaign_draft").update({ lifecycle: "archived" }).eq("id", d.id);
        result = error ? "error" : "ok";
        msg = error?.message ?? "";
      } else if (data.action === "delete") {
        const { error } = await supabase.from("cc_campaign_draft").delete().eq("id", d.id);
        result = error ? "error" : "ok";
        msg = error?.message ?? "";
      } else if (data.action === "retry_launch") {
        msg = "Użyj Centrum startu i ponów job z nowym idempotency key.";
        result = "skipped";
        retry = "yes";
      }
      results.push({
        objectName: d.title,
        provider: d.provider,
        action: data.action,
        result,
        providerMessage: msg,
        retryAvailable: retry,
      });
    }

    return { results };
  });

export const ccListCollections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase.from("cc_campaign_collection").select("*").eq("workspace_id", data.workspaceId).eq("user_id", userId);
    return { collections: rows ?? [] };
  });

const CollCreate = z.object({ workspaceId: z.string().uuid(), name: z.string().min(1), description: z.string().optional() });

export const ccCreateCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CollCreate.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("cc_campaign_collection")
      .insert({ workspace_id: data.workspaceId, user_id: userId, name: data.name, description: data.description ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const ccAddDraftToCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ collectionId: z.string().uuid(), draftId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: c } = await supabase.from("cc_campaign_collection").select("id").eq("id", data.collectionId).eq("user_id", userId).maybeSingle();
    if (!c) throw new Error("Brak kolekcji");
    const { error } = await supabase.from("cc_collection_member").insert({ collection_id: data.collectionId, draft_id: data.draftId });
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true };
  });

export const ccListJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ draftId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("cc_launch_job").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(40);
    if (data.draftId) q = q.eq("draft_id", data.draftId);
    const { data: rows } = await q;
    return { jobs: rows ?? [] };
  });

export const ccListJobItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase.from("cc_launch_job").select("id").eq("id", data.jobId).eq("user_id", userId).maybeSingle();
    if (!job) return { items: [] };
    const { data: items } = await supabase.from("cc_launch_job_item").select("*").eq("job_id", data.jobId).order("step_order", { ascending: true });
    return { items: items ?? [] };
  });

export const ccListAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("cc_audit_event")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { events: rows ?? [] };
  });

const GenerateAdCopyIn = z.object({
  kind: z.enum([
    "headline",
    "headlines",
    "longHeadlines",
    "descriptions",
    "primaryText",
    "adText",
    "campaignName",
    "businessName",
  ]),
  provider: z.enum(["meta", "linkedin", "tiktok", "google"]),
  campaignType: z.string().max(40).optional(),
  campaignName: z.string().max(120).optional(),
  finalUrl: z.string().max(500).optional(),
  businessName: z.string().max(80).optional(),
  language: z.string().max(16).optional(),
  count: z.number().int().min(1).max(15).optional(),
  maxChars: z.number().int().min(10).max(500).optional(),
  hint: z.string().max(500).optional(),
  existing: z.string().max(2000).optional(),
});

/** AI uzupełnianie tekstów kreacji (Anthropic / Claude). */
export const ccGenerateAdCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateAdCopyIn.parse(d))
  .handler(async ({ data }) => {
    const { generateAdCopyWithAnthropic } = await import("./server/generate-ad-copy");
    return generateAdCopyWithAnthropic(data);
  });
