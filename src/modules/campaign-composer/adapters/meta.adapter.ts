import type { AdsPlatformAdapter, AdapterContext, ProviderResult, ProviderStepKind } from "./types";
import type { CampaignComposerDraftPayload } from "../domain/draft-schema";

const GRAPH = "https://graph.facebook.com/v21.0";

function formBody(params: Record<string, string | number | boolean | undefined | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    u.set(k, String(v));
  }
  return u.toString();
}

async function graphPost(actPath: string, token: string, body: Record<string, string | number | boolean | undefined | null>) {
  const url = `${GRAPH}/${actPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `${formBody(body)}&access_token=${encodeURIComponent(token)}`,
  });
  const json = (await res.json()) as { id?: string; error?: { message: string; code?: number; error_subcode?: number } };
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? res.statusText;
    const retryable = res.status === 429 || res.status >= 500;
    return { ok: false as const, message: msg, code: String(json.error?.code ?? res.status), retryable, raw: json };
  }
  if (!json.id) return { ok: false as const, message: "Brak id w odpowiedzi Meta", retryable: false, raw: json };
  return { ok: true as const, externalId: json.id, raw: json };
}

export class MetaMarketingAdapter implements AdsPlatformAdapter {
  readonly provider = "meta" as const;

  buildLaunchPlan(_draft: CampaignComposerDraftPayload) {
    return [
      { order: 1, kind: "meta_campaign" as const, label: "Kampania (Meta)" },
      { order: 2, kind: "meta_adset" as const, label: "Zestaw reklam" },
      { order: 3, kind: "meta_ad_creative" as const, label: "Reklama / kreacja" },
    ];
  }

  async executeStep(
    ctx: AdapterContext,
    draft: CampaignComposerDraftPayload,
    kind: ProviderStepKind,
    priorIds: Record<string, string>,
  ): Promise<ProviderResult> {
    if (ctx.dryRun) {
      const fake = `dry_meta_${kind}_${Date.now()}`;
      return { ok: true, externalId: fake, raw: { dryRun: true } };
    }

    const act = ctx.adAccountId.startsWith("act_") ? ctx.adAccountId : `act_${ctx.adAccountId}`;
    const liveStatus = ctx.publishLive ? "ACTIVE" : "PAUSED";

    try {
      if (kind === "meta_campaign") {
        const objective = draft.meta?.objective ?? "OUTCOME_TRAFFIC";
        const special = draft.meta?.specialAdCategory ?? "NONE";
        const params: Record<string, string | number | boolean | undefined> = {
          name: draft.structure.campaignName,
          objective,
          status: liveStatus,
          is_adset_budget_sharing_enabled: false,
          special_ad_categories: JSON.stringify(special === "NONE" ? [] : [special]),
        };
        if (special !== "NONE" && draft.meta?.specialAdCategoryCountry?.length) {
          params.special_ad_category_country = JSON.stringify(draft.meta.specialAdCategoryCountry);
        }
        const r = await graphPost(`${act}/campaigns`, ctx.accessToken, params);
        return r.ok ? { ok: true, externalId: r.externalId, raw: r.raw } : r;
      }
      if (kind === "meta_adset") {
        const campaignId = priorIds.meta_campaign;
        if (!campaignId) return { ok: false, message: "Brak utworzonej kampanii Meta (krok poprzedni).", retryable: false };
        const adset = draft.structure.adSets[0];
        const daily = adset?.budget?.dailyBudgetMinorUnits ?? 500;
        const r = await graphPost(`${act}/adsets`, ctx.accessToken, {
          name: adset?.name ?? "Ad set",
          campaign_id: campaignId,
          billing_event: "IMPRESSIONS",
          optimization_goal: adset?.optimizationGoal ?? "LINK_CLICKS",
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
          daily_budget: Math.max(daily, 100),
          targeting: JSON.stringify({ geo_locations: { countries: adset?.audience?.geoInclude?.length ? adset.audience.geoInclude : ["PL"] } }),
          status: liveStatus,
          start_time: adset?.schedule?.startAt,
          end_time: adset?.schedule?.endAt,
        });
        return r.ok ? { ok: true, externalId: r.externalId, raw: r.raw } : r;
      }
      if (kind === "meta_ad_creative") {
        const adsetId = priorIds.meta_adset;
        if (!adsetId) return { ok: false, message: "Brak zestawu reklam Meta.", retryable: false };
        const pageId = draft.channel.metaPageId;
        if (!pageId) return { ok: false, message: "Brak Page ID — dodaj w kanale.", retryable: false };
        const creative = draft.structure.adSets[0]?.creatives[0];
        const link = creative?.destinationUrl || "https://example.com";
        const cr = await graphPost(`${act}/adcreatives`, ctx.accessToken, {
          name: `cc_${draft.structure.campaignName}`.slice(0, 90),
          object_story_spec: JSON.stringify({
            page_id: pageId,
            link_data: {
              link: link,
              message: creative?.primaryText ?? "",
              name: creative?.headline ?? "",
              call_to_action: { type: creative?.cta || "LEARN_MORE", value: { link: link } },
            },
          }),
        });
        if (!cr.ok) return cr;
        const ad = await graphPost(`${act}/ads`, ctx.accessToken, {
          name: `ad_${Date.now()}`.slice(0, 90),
          adset_id: adsetId,
          creative: JSON.stringify({ creative_id: cr.externalId }),
          status: liveStatus,
        });
        return ad.ok ? { ok: true, externalId: ad.externalId, raw: { creative: cr.externalId, ad: ad.raw } } : ad;
      }
      return { ok: false, message: `Nieobsługiwany krok Meta: ${kind}`, retryable: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Błąd sieci Meta";
      return { ok: false, message: msg, retryable: true, raw: e };
    }
  }
}

export const metaMarketingAdapter = new MetaMarketingAdapter();
