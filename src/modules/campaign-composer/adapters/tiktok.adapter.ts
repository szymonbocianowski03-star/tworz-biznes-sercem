import type { AdsPlatformAdapter, AdapterContext, ProviderResult, ProviderStepKind, ResolvedCampaignAsset } from "./types";
import type { CampaignComposerDraftPayload } from "../domain/draft-schema";
import { tiktokObjectiveMap } from "../domain/draft-schema";

const TT_API = "https://business-api.tiktok.com/open_api/v1.3";

function ttHeaders(token: string) {
  return {
    "Access-Token": token,
    "Content-Type": "application/json",
  };
}

type TTJson = {
  code?: number;
  message?: string;
  data?: Record<string, unknown>;
};

function extractResourceId(data: Record<string, unknown>): string | null {
  for (const key of ["video_id", "image_id", "campaign_id", "adgroup_id", "ad_id", "page_id", "creative_id"]) {
    const v = data[key];
    if (typeof v === "string" && v) return v;
  }
  const imageIds = data.image_ids;
  if (Array.isArray(imageIds) && typeof imageIds[0] === "string") return imageIds[0];
  return null;
}

async function ttPost(path: string, token: string, body: Record<string, unknown>): Promise<ProviderResult> {
  const res = await fetch(`${TT_API}/${path}`, {
    method: "POST",
    headers: ttHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: TTJson = {};
  try {
    json = JSON.parse(text) as TTJson;
  } catch {
    /* empty */
  }
  if (!res.ok || json.code !== 0) {
    return {
      ok: false as const,
      message: json.message ?? text.slice(0, 400) ?? res.statusText,
      code: String(json.code ?? res.status),
      retryable: res.status >= 500 || res.status === 429 || json.code === 40100,
      raw: json,
    };
  }
  const d = json.data ?? {};
  const id = extractResourceId(d);
  if (!id) {
    return { ok: false as const, message: "Brak identyfikatora zasobu TikTok w odpowiedzi", retryable: false, raw: json };
  }
  return { ok: true as const, externalId: String(id), raw: json };
}

function isVideoAsset(asset: ResolvedCampaignAsset): boolean {
  if (asset.source.includes("video")) return true;
  return /\.(mp4|webm|mov)(\?|$)/i.test(asset.publicUrl);
}

function resolveCreativeAssets(ctx: AdapterContext, draft: CampaignComposerDraftPayload) {
  const creative = draft.structure.adSets[0]?.creatives[0];
  if (!creative?.assetIds?.length) return [];
  return creative.assetIds
    .map((id) => {
      const a = ctx.resolvedAssets?.[id];
      return a ? { id, ...a } : null;
    })
    .filter((a): a is { id: string } & ResolvedCampaignAsset => Boolean(a));
}

async function uploadCreativeAsset(
  advertiserId: string,
  token: string,
  asset: ResolvedCampaignAsset,
): Promise<ProviderResult & { videoId?: string; imageId?: string }> {
  if (isVideoAsset(asset)) {
    const r = await ttPost("file/video/ad/upload/", token, {
      advertiser_id: advertiserId,
      upload_type: "UPLOAD_BY_URL",
      video_url: asset.publicUrl,
    });
    if (!r.ok) return r;
    const videoId = (r.raw as TTJson)?.data?.video_id;
    return { ...r, videoId: typeof videoId === "string" ? videoId : r.externalId };
  }
  const r = await ttPost("file/image/ad/upload/", token, {
    advertiser_id: advertiserId,
    upload_type: "UPLOAD_BY_URL",
    image_url: asset.publicUrl,
  });
  if (!r.ok) return r;
  const imageId = (r.raw as TTJson)?.data?.image_id ?? r.externalId;
  return { ...r, imageId: String(imageId) };
}

function promotionTypeForObjective(objective: string): string {
  if (objective === "APP_PROMOTION") return "APP";
  if (objective === "LEAD_GENERATION") return "LEAD_GENERATION";
  if (objective === "PRODUCT_SALES") return "WEBSITE";
  return "WEBSITE";
}

function billingEventForGoal(goal: string): string {
  switch (goal) {
    case "CONVERT":
    case "LEAD_GENERATION":
    case "INSTALL":
      return "OCPM";
    case "REACH":
      return "CPM";
    case "VIDEO_VIEW":
      return "CPV";
    default:
      return "CPC";
  }
}

function formatTikTokSchedule(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Adapter TikTok Ads (Marketing API v1.3).
 * Plan: Campaign → Ad Group → Ad Creative (z uploadem wideo/grafiki).
 */
export class TikTokAdsAdapter implements AdsPlatformAdapter {
  readonly provider = "tiktok" as const;

  buildLaunchPlan(draft: CampaignComposerDraftPayload) {
    const plan = [
      { order: 1, kind: "tiktok_campaign" as const, label: "Kampania TikTok" },
      { order: 2, kind: "tiktok_adgroup" as const, label: "Grupa reklam TikTok" },
      { order: 3, kind: "tiktok_creative" as const, label: "Kreacja reklamy TikTok" },
    ];
    if (draft.tiktok?.objective === "tiktok_instant_form") {
      plan.push({ order: 4, kind: "tiktok_lead_form" as unknown as "tiktok_creative", label: "Formularz leadowy" } as never);
    }
    return plan;
  }

  async executeStep(
    ctx: AdapterContext,
    draft: CampaignComposerDraftPayload,
    kind: ProviderStepKind,
    priorIds: Record<string, string>,
  ): Promise<ProviderResult> {
    if (ctx.dryRun) {
      return { ok: true, externalId: `dry_tt_${kind}_${Date.now()}`, raw: { dryRun: true } };
    }

    const advertiserId = ctx.adAccountId;
    if (!advertiserId) {
      return { ok: false, message: "Brak advertiser_id TikTok.", retryable: false };
    }
    const adSet0 = draft.structure.adSets[0];
    const tt = draft.tiktok;
    const ag = tt?.adGroup;
    const targeting = tt?.targeting;
    const ad = tt?.ad;
    const objective = tiktokObjectiveMap[draft.tiktok?.objective ?? "traffic"];
    const campaignBudgetMode =
      tt?.budgetMode === "lifetime" ? "BUDGET_MODE_TOTAL" : tt?.budgetMode === "no_limit" ? "BUDGET_MODE_INFINITE" : "BUDGET_MODE_DAY";
    const campaignBudget = (tt?.budgetAmountMinor ?? 5000) / 100;
    const adgroupBudgetMode = ag?.budgetMode === "lifetime" ? "BUDGET_MODE_TOTAL" : "BUDGET_MODE_DAY";
    const adgroupBudget = (ag?.budgetAmountMinor ?? 2000) / 100;
    const liveStatus = ctx.publishLive ? "ENABLE" : "DISABLE";
    const optimizationGoal = ag?.optimizationGoal || "CLICK";

    try {
      if (kind === "tiktok_campaign") {
        return await ttPost("campaign/create/", ctx.accessToken, {
          advertiser_id: advertiserId,
          campaign_name: draft.structure.campaignName,
          objective_type: objective,
          budget_mode: campaignBudgetMode,
          ...(campaignBudgetMode === "BUDGET_MODE_INFINITE" ? {} : { budget: campaignBudget }),
          operation_status: tt?.status === "active" ? "ENABLE" : liveStatus,
        });
      }

      if (kind === "tiktok_adgroup") {
        const campaignId = priorIds.tiktok_campaign;
        if (!campaignId) return { ok: false, message: "Brak kampanii TikTok.", retryable: false };

        const locationIds =
          targeting?.locations?.length
            ? targeting.locations
            : adSet0?.audience?.geoInclude?.length
              ? adSet0.audience.geoInclude
              : ["2616977"]; // Polska — domyślnie, gdy brak wyboru

        return await ttPost("adgroup/create/", ctx.accessToken, {
          advertiser_id: advertiserId,
          campaign_id: campaignId,
          adgroup_name: ag?.name || adSet0?.name || "Grupa reklam TikTok",
          promotion_type: promotionTypeForObjective(objective),
          placement_type: ag?.placementMode === "manual" ? "PLACEMENT_TYPE_NORMAL" : "PLACEMENT_TYPE_AUTOMATIC",
          ...(ag?.placementMode === "manual" && ag.placements?.length ? { placements: ag.placements } : {}),
          budget_mode: adgroupBudgetMode,
          budget: adgroupBudget,
          schedule_type: ag?.scheduleType === "specific_dates" ? "SCHEDULE_START_END" : "SCHEDULE_FROM_NOW",
          ...(formatTikTokSchedule(ag?.startAt) ? { schedule_start_time: formatTikTokSchedule(ag?.startAt) } : {}),
          ...(ag?.endAt && ag.scheduleType === "specific_dates" && formatTikTokSchedule(ag.endAt)
            ? { schedule_end_time: formatTikTokSchedule(ag.endAt) }
            : {}),
          ...(ag?.dayparting ? { dayparting: ag.dayparting } : {}),
          optimization_goal: optimizationGoal,
          billing_event: billingEventForGoal(optimizationGoal),
          bid_type: ag?.bidStrategy || "BID_TYPE_NO_BID",
          ...(ag?.bidAmountMinor ? { bid_price: ag.bidAmountMinor / 100 } : {}),
          ...(ag?.pixelId ? { pixel_id: ag.pixelId } : {}),
          ...(ag?.conversionEvent ? { optimization_event: ag.conversionEvent } : {}),
          location_ids: locationIds,
          ...(targeting?.ageGroups?.length ? { age_groups: targeting.ageGroups } : {}),
          ...(targeting?.genders?.length ? { gender: targeting.genders[0] } : {}),
          ...(targeting?.languages?.length ? { languages: targeting.languages } : {}),
          ...(targeting?.interests?.length ? { interest_category_ids: targeting.interests } : {}),
          ...(targeting?.behaviors?.length ? { action_category_ids: targeting.behaviors } : {}),
          ...(targeting?.devices?.length ? { device_model_ids: targeting.devices } : {}),
          ...(targeting?.customAudienceIds?.length ? { audience_ids: targeting.customAudienceIds } : {}),
          operation_status: liveStatus,
        });
      }

      if (kind === "tiktok_creative") {
        const adgroupId = priorIds.tiktok_adgroup;
        if (!adgroupId) return { ok: false, message: "Brak grupy reklam TikTok.", retryable: false };

        const creativePayload: Record<string, unknown> = {
          ad_name: ad?.name || draft.structure.campaignName,
          ad_text: ad?.adText || "",
          call_to_action: ad?.cta || "LEARN_MORE",
          ...(ad?.identityId ? { identity_id: ad.identityId, identity_type: "CUSTOMIZED_USER" } : {}),
          ...(ad?.displayName ? { display_name: ad.displayName } : {}),
          ...(ad?.utm ? { utm_params: ad.utm } : {}),
        };

        if (ad?.creativeType === "spark" && ad.sparkPostUrl) {
          creativePayload.ad_format = "SPARK_ADS";
          creativePayload.tiktok_item_id = ad.sparkPostUrl;
        } else {
          const assets = resolveCreativeAssets(ctx, draft);
          let videoId: string | undefined;
          let imageId: string | undefined;

          if (assets.length > 0) {
            const upload = await uploadCreativeAsset(advertiserId, ctx.accessToken, assets[0]);
            if (!upload.ok) return upload;
            videoId = upload.videoId;
            imageId = upload.imageId;
          } else if (ad?.thumbnailUrl) {
            const upload = await uploadCreativeAsset(advertiserId, ctx.accessToken, {
              publicUrl: ad.thumbnailUrl,
              source: "image",
            });
            if (!upload.ok) return upload;
            imageId = upload.imageId;
          } else {
            return {
              ok: false,
              message: "Dodaj wideo lub grafikę kreacji TikTok przed publikacją.",
              retryable: false,
            };
          }

          if (videoId) {
            creativePayload.ad_format = "SINGLE_VIDEO";
            creativePayload.video_id = videoId;
          } else if (imageId) {
            creativePayload.ad_format = "SINGLE_IMAGE";
            creativePayload.image_ids = [imageId];
          }

          const dest = ad?.destinationUrl?.trim();
          if (dest) creativePayload.landing_page_url = dest;
        }

        return await ttPost("ad/create/", ctx.accessToken, {
          advertiser_id: advertiserId,
          adgroup_id: adgroupId,
          creatives: [creativePayload],
        });
      }

      if (kind === "tiktok_lead_form") {
        return {
          ok: false,
          message:
            "Formularz Instant Form TikTok wymaga osobnej konfiguracji w Ads Manager. Użyj celu „Pozyskiwanie leadów” z docelowym URL zamiast Instant Form.",
          code: "TIKTOK_LEAD_FORM_UNSUPPORTED",
          retryable: false,
        };
      }

      return { ok: false, message: `Nieobsługiwany krok TikTok: ${kind}`, retryable: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Błąd sieci TikTok";
      return { ok: false, message: msg, retryable: true, raw: e };
    }
  }
}

export const tiktokAdsAdapter = new TikTokAdsAdapter();
