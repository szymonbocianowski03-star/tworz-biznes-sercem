import type { AdsPlatformAdapter, AdapterContext, ProviderResult, ProviderStepKind } from "./types";
import type { CampaignComposerDraftPayload } from "../domain/draft-schema";
import { tiktokObjectiveMap } from "../domain/draft-schema";

const TT_API = "https://business-api.tiktok.com/open_api/v1.3";

function ttHeaders(token: string) {
  return {
    "Access-Token": token,
    "Content-Type": "application/json",
  };
}

async function ttPost(path: string, token: string, body: Record<string, unknown>): Promise<ProviderResult> {
  const res = await fetch(`${TT_API}/${path}`, {
    method: "POST",
    headers: ttHeaders(token),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: { code?: number; message?: string; data?: Record<string, unknown> } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    /* empty */
  }
  // TikTok Ads API zwraca HTTP 200 + code===0 dla sukcesu.
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
  const id =
    (d.campaign_id as string) ??
    (d.adgroup_id as string) ??
    (d.ad_id as string) ??
    (d.page_id as string) ??
    (d.creative_id as string);
  if (!id) {
    return { ok: false as const, message: "Brak identyfikatora zasobu TikTok w odpowiedzi", retryable: false, raw: json };
  }
  return { ok: true as const, externalId: String(id), raw: json };
}

/**
 * Adapter TikTok Ads (Marketing API v1.3).
 * Plan kroków: Campaign → Ad Group → Ad Creative → (opcjonalnie) Lead Form.
 * Wartości pól zgodne ze strukturą TikTok Ads API; tam gdzie dokumentacja wymaga
 * doprecyzowania, zostawiono komentarze TODO. Tryb dry-run nie wykonuje wywołań sieciowych.
 */
export class TikTokAdsAdapter implements AdsPlatformAdapter {
  readonly provider = "tiktok" as const;

  buildLaunchPlan(draft: CampaignComposerDraftPayload) {
    const plan = [
      { order: 1, kind: "tiktok_campaign" as const, label: "Kampania" },
      { order: 2, kind: "tiktok_adgroup" as const, label: "Grupa reklam" },
      { order: 3, kind: "tiktok_creative" as const, label: "Kreacja reklamy" },
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

    try {
      if (kind === "tiktok_campaign") {
        return await ttPost("campaign/create/", ctx.accessToken, {
          advertiser_id: advertiserId,
          campaign_name: draft.structure.campaignName,
          objective_type: objective,
          budget_mode: campaignBudgetMode,
          ...(campaignBudgetMode === "BUDGET_MODE_INFINITE" ? {} : { budget: campaignBudget }),
          operation_status: tt?.status === "active" ? "ENABLE" : "DISABLE", // domyślnie wstrzymana
        });
      }
      if (kind === "tiktok_adgroup") {
        const campaignId = priorIds.tiktok_campaign;
        if (!campaignId) return { ok: false, message: "Brak kampanii TikTok.", retryable: false };
        const locationIds = targeting?.locations?.length ? targeting.locations : adSet0?.audience?.geoInclude?.length ? adSet0.audience.geoInclude : undefined;
        return await ttPost("adgroup/create/", ctx.accessToken, {
          advertiser_id: advertiserId,
          campaign_id: campaignId,
          adgroup_name: ag?.name || adSet0?.name || "Grupa reklam TikTok",
          placement_type: ag?.placementMode === "manual" ? "PLACEMENT_TYPE_NORMAL" : "PLACEMENT_TYPE_AUTOMATIC",
          ...(ag?.placementMode === "manual" && ag.placements?.length ? { placements: ag.placements } : {}),
          budget_mode: adgroupBudgetMode,
          budget: adgroupBudget,
          schedule_type: ag?.scheduleType === "specific_dates" ? "SCHEDULE_START_END" : "SCHEDULE_FROM_NOW",
          ...(ag?.startAt ? { schedule_start_time: ag.startAt } : {}),
          ...(ag?.endAt && ag.scheduleType === "specific_dates" ? { schedule_end_time: ag.endAt } : {}),
          ...(ag?.dayparting ? { dayparting: ag.dayparting } : {}),
          optimization_goal: ag?.optimizationGoal || "CLICK",
          ...(ag?.bidStrategy ? { bid_type: ag.bidStrategy } : {}),
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
          ...(targeting?.lookalikeAudienceIds?.length ? { excluded_audience_ids: [] } : {}),
        });
      }
      if (kind === "tiktok_creative") {
        const adgroupId = priorIds.tiktok_adgroup;
        if (!adgroupId) return { ok: false, message: "Brak grupy reklam TikTok.", retryable: false };
        return await ttPost("ad/create/", ctx.accessToken, {
          advertiser_id: advertiserId,
          adgroup_id: adgroupId,
          creatives: [
            {
              ad_name: ad?.name || draft.structure.campaignName,
              ad_text: ad?.adText || "",
              call_to_action: ad?.cta || "LEARN_MORE",
              landing_page_url: ad?.destinationUrl || undefined,
              ...(ad?.identityId ? { identity_id: ad.identityId } : {}),
              ...(ad?.displayName ? { display_name: ad.displayName } : {}),
              ...(ad?.thumbnailUrl ? { image_url: ad.thumbnailUrl } : {}),
              ...(ad?.creativeType === "spark" && ad.sparkPostUrl ? { tiktok_item_id: ad.sparkPostUrl } : {}),
              ...(ad?.utm ? { utm_params: ad.utm } : {}),
              // TODO: po uploadzie wideo (uploadCreative) podstaw video_id.
            },
          ],
        });
      }
      if (kind === "tiktok_lead_form") {
        const lf = draft.tiktok?.leadForm;
        if (!lf?.privacyPolicyUrl) {
          return { ok: false, message: "Formularz leadowy TikTok wymaga URL polityki prywatności.", retryable: false };
        }
        // TODO: właściwy endpoint Instant/Lead Form zależny od konfiguracji konta TikTok.
        return {
          ok: false,
          message:
            "Krok formularza leadowego TikTok: skonfiguruj Instant Form w TikTok i powiąż z reklamą (do uzupełnienia po stronie API).",
          code: "TIKTOK_LEAD_FORM_TODO",
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