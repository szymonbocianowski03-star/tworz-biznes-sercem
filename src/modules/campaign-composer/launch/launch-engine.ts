import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { maybeDispatchUserWebhook } from "@/lib/userNotificationWebhook";
import { campaignComposerDraftPayloadSchema } from "../domain/draft-schema";
import { metaMarketingAdapter } from "../adapters/meta.adapter";
import { linkedInAdsAdapter } from "../adapters/linkedin.adapter";
import { tiktokAdsAdapter } from "../adapters/tiktok.adapter";
import type { AdsPlatformAdapter, ProviderStepKind } from "../adapters/types";

type AdminClient = SupabaseClient<Database>;

function stepPriorKey(kind: ProviderStepKind): string {
  return kind;
}

async function audit(
  admin: AdminClient,
  row: { workspace_id: string; user_id: string },
  entityType: string,
  entityId: string | null,
  action: string,
  payload: Json,
) {
  await admin.from("cc_audit_event").insert({
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    entity_type: entityType,
    entity_id: entityId,
    action,
    payload,
  });
}

export type ProcessLaunchJobResult = {
  jobId: string;
  finalStatus: string;
  message?: string;
};

export function isCampaignComposerDryRun(): boolean {
  return (process.env.CAMPAIGN_COMPOSER_DRY_RUN ?? "true").toLowerCase() !== "false";
}

/**
 * Przetwarza pojedynczy LaunchJob: idempotencja po stronie bazy (UNIQUE idempotency_key),
 * retry z backoff przez next_run_at, partial success gdy część kroków providera się nie uda.
 * Anulowanie: cancel_requested=true przerywa przed kolejnym krokiem providera (kampania jeszcze nie „zamrożona” w pełni — patrz copy w UI).
 */
export async function processLaunchJob(admin: AdminClient, jobId: string): Promise<ProcessLaunchJobResult> {
  const { data: job, error: jobErr } = await admin.from("cc_launch_job").select("*").eq("id", jobId).maybeSingle();
  if (jobErr || !job) return { jobId, finalStatus: "missing", message: jobErr?.message };

  if (job.cancel_requested) {
    const { data: d } = await admin.from("cc_campaign_draft").select("workspace_id").eq("id", job.draft_id).maybeSingle();
    await admin.from("cc_launch_job").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", jobId);
    if (d?.workspace_id) {
      await audit(admin, { workspace_id: d.workspace_id, user_id: job.user_id }, "cc_launch_job", jobId, "launch_cancelled", {
        reason: "user_abort_pre_submit",
      });
    }
    return { jobId, finalStatus: "cancelled" };
  }

  const { data: draft } = await admin.from("cc_campaign_draft").select("*").eq("id", job.draft_id).maybeSingle();
  if (!draft) {
    await admin.from("cc_launch_job").update({ status: "failed", last_error: { code: "NO_DRAFT" } }).eq("id", jobId);
    return { jobId, finalStatus: "failed", message: "Brak draftu" };
  }

  const parsed = campaignComposerDraftPayloadSchema.safeParse(draft.draft_payload);
  if (!parsed.success) {
    await admin
      .from("cc_launch_job")
      .update({ status: "failed", last_error: { issues: parsed.error.flatten() } as unknown as Json })
      .eq("id", jobId);
    return { jobId, finalStatus: "failed", message: "Niepoprawny payload draftu" };
  }
  const payload = parsed.data;

  const dryRun = isCampaignComposerDryRun();

  let accessToken = "";
  if (payload.channel.provider === "meta") {
    const mid = (draft.sync_state as Record<string, Json> | null)?.meta_connection_id ?? payload.channel.metaConnectionId;
    if (!mid || typeof mid !== "string") {
      await admin.from("cc_launch_job").update({ status: "failed", last_error: { code: "NO_META_CONNECTION" } as unknown as Json }).eq("id", jobId);
      return { jobId, finalStatus: "failed", message: "Brak powiązania meta_connection_id" };
    }
    const { data: conn } = await admin.from("meta_connections").select("access_token").eq("id", mid).maybeSingle();
    accessToken = conn?.access_token ?? "";
  } else if (payload.channel.provider === "tiktok") {
    const tid = (draft.sync_state as Record<string, Json> | null)?.tiktok_connection_id ?? payload.channel.tiktokConnectionId;
    if (!tid || typeof tid !== "string") {
      await admin.from("cc_launch_job").update({ status: "failed", last_error: { code: "NO_TIKTOK_CONNECTION" } as unknown as Json }).eq("id", jobId);
      return { jobId, finalStatus: "failed", message: "Brak powiązania tiktok_connection_id" };
    }
    const { data: conn } = await admin.from("tiktok_connections").select("access_token").eq("id", tid).maybeSingle();
    accessToken = conn?.access_token ?? "";
  } else {
    const lid = (draft.sync_state as Record<string, Json> | null)?.linkedin_connection_id ?? payload.channel.linkedinConnectionId;
    if (!lid || typeof lid !== "string") {
      await admin.from("cc_launch_job").update({ status: "failed", last_error: { code: "NO_LI_CONNECTION" } as unknown as Json }).eq("id", jobId);
      return { jobId, finalStatus: "failed", message: "Brak powiązania linkedin_connection_id" };
    }
    const { data: conn } = await admin.from("linkedin_connections").select("access_token").eq("id", lid).maybeSingle();
    accessToken = conn?.access_token ?? "";
  }

  if (!accessToken && !dryRun) {
    await admin.from("cc_launch_job").update({ status: "failed", last_error: { code: "NO_TOKEN" } as unknown as Json }).eq("id", jobId);
    return { jobId, finalStatus: "failed", message: "Brak access tokena providera" };
  }

  const adapter: AdsPlatformAdapter =
    payload.channel.provider === "meta"
      ? metaMarketingAdapter
      : payload.channel.provider === "tiktok"
        ? tiktokAdsAdapter
        : linkedInAdsAdapter;
  const plan = adapter.buildLaunchPlan(payload);
  const priorIds: Record<string, string> = { ...(draft.sync_state as Record<string, string> | undefined) };

  await admin.from("cc_launch_job").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", jobId);

  let hadFailure = false;
  let hadSuccess = false;

  for (const step of plan) {
    const { data: fresh } = await admin.from("cc_launch_job").select("cancel_requested").eq("id", jobId).maybeSingle();
    if (fresh?.cancel_requested) {
      await admin.from("cc_launch_job").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", jobId);
      await audit(
        admin,
        { workspace_id: draft.workspace_id, user_id: job.user_id },
        "cc_launch_job",
        jobId,
        "launch_interrupted",
        { atStep: step.kind },
      );
      return { jobId, finalStatus: "cancelled" };
    }

    const ctx = {
      dryRun: dryRun || !accessToken,
      accessToken: accessToken || "dry",
      adAccountId: payload.channel.adAccountId,
      publishLive: job.intent === "go_live" && !dryRun && Boolean(accessToken),
    };

    const result = await adapter.executeStep(ctx, payload, step.kind, priorIds);

    await admin.from("cc_launch_job_item").insert({
      job_id: jobId,
      step_order: step.order,
      step_kind: step.kind,
      provider: payload.channel.provider,
      external_id: result.ok ? result.externalId : null,
      status: result.ok ? "success" : "failed",
      provider_message: result.ok ? null : result.message,
      provider_payload: (result.ok ? result.raw : result.raw) as Json | null,
      retry_available: result.ok ? false : Boolean(result.retryable),
    });

    if (result.ok) {
      hadSuccess = true;
      priorIds[stepPriorKey(step.kind)] = result.externalId;
    } else {
      hadFailure = true;
      if (result.retryable && job.attempt < job.max_attempts) {
        const delayMin = Math.min(60, 2 ** Math.max(1, job.attempt));
        const next = new Date(Date.now() + delayMin * 60_000).toISOString();
        await admin
          .from("cc_launch_job")
          .update({
            status: "queued",
            attempt: job.attempt + 1,
            next_run_at: next,
            last_error: { message: result.message, code: result.code } as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        return { jobId, finalStatus: "queued", message: "Retry zaplanowany" };
      }
      /** Kontynuuj plan dla partial_success (np. kampania OK, kreacja LinkedIn wymaga ręcznej konfiguracji). */
      if (payload.channel.provider === "linkedin" && step.kind === "linkedin_creative") {
        continue;
      }
      break;
    }
  }

  const finalStatus = hadFailure && hadSuccess ? "partial_success" : hadFailure ? "failed" : "success";
  await admin
    .from("cc_launch_job")
    .update({
      status: finalStatus,
      updated_at: new Date().toISOString(),
      last_error: hadFailure ? ({ partial: hadSuccess } as unknown as Json) : null,
    })
    .eq("id", jobId);

  await admin
    .from("cc_campaign_draft")
    .update({
      sync_state: {
        ...((draft.sync_state as Record<string, Json> | null) ?? {}),
        ...priorIds,
        last_provider_sync_at: new Date().toISOString(),
      } as unknown as Json,
      lifecycle: finalStatus === "success" || finalStatus === "partial_success" ? "live" : draft.lifecycle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draft.id);

  await audit(admin, { workspace_id: draft.workspace_id, user_id: job.user_id }, "cc_campaign_draft", draft.id, "launch_processed", {
    jobId,
    finalStatus,
  });

  if (finalStatus === "success" || finalStatus === "partial_success") {
    await maybeDispatchUserWebhook(admin, job.user_id, "campaign_launched", {
      jobId,
      draftId: draft.id,
      draftTitle: draft.title,
      finalStatus,
      provider: payload.channel.provider,
      dryRun: dryRun || !accessToken,
    });
  }

  return { jobId, finalStatus };
}

export async function claimQueuedLaunchJobs(admin: AdminClient, limit: number): Promise<string[]> {
  const nowIso = new Date().toISOString();
  const { data: rows } = await admin
    .from("cc_launch_job")
    .select("id")
    .eq("status", "queued")
    .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (rows ?? []).map((r) => r.id);
}
