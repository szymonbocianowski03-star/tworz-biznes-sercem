import type { AdsPlatformAdapter, AdapterContext, ProviderResult, ProviderStepKind, ResolvedCampaignAsset } from "./types";
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

type GraphJson = {
  id?: string;
  images?: Record<string, { hash?: string; url?: string }>;
  status?: { video_status?: string };
  error?: { message: string; code?: number; error_subcode?: number };
};

async function graphPostRaw(
  actPath: string,
  token: string,
  body: Record<string, string | number | boolean | undefined | null>,
): Promise<{ ok: boolean; json: GraphJson; status: number }> {
  const url = `${GRAPH}/${actPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `${formBody(body)}&access_token=${encodeURIComponent(token)}`,
  });
  const json = (await res.json()) as GraphJson;
  const ok = res.ok && !json.error;
  return { ok, json, status: res.status };
}

async function graphGetRaw(path: string, token: string, fields: string): Promise<{ ok: boolean; json: GraphJson }> {
  const url = `${GRAPH}/${path}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const json = (await res.json()) as GraphJson;
  return { ok: res.ok && !json.error, json };
}

async function graphPost(actPath: string, token: string, body: Record<string, string | number | boolean | undefined | null>) {
  const { ok, json, status } = await graphPostRaw(actPath, token, body);
  if (!ok) {
    const msg = json.error?.message ?? "Błąd Meta API";
    const retryable = status === 429 || status >= 500;
    return { ok: false as const, message: msg, code: String(json.error?.code ?? status), retryable, raw: json };
  }
  if (!json.id) return { ok: false as const, message: "Brak id w odpowiedzi Meta", retryable: false, raw: json };
  return { ok: true as const, externalId: json.id, raw: json };
}

function isVideoAsset(asset: ResolvedCampaignAsset): boolean {
  if (asset.source.includes("video")) return true;
  return /\.(mp4|webm|mov)(\?|$)/i.test(asset.publicUrl);
}

/** Mapowanie wartości placementu z UI -> publisher_platforms + pozycje Meta. */
const META_PLACEMENT_MAP: Record<string, { platform: string; position?: string }> = {
  FACEBOOK_FEED: { platform: "facebook", position: "feed" },
  FACEBOOK_STORIES: { platform: "facebook", position: "story" },
  FACEBOOK_MARKETPLACE: { platform: "facebook", position: "marketplace" },
  FACEBOOK_VIDEO_FEEDS: { platform: "facebook", position: "video_feeds" },
  INSTAGRAM_FEED: { platform: "instagram", position: "stream" },
  INSTAGRAM_STORIES: { platform: "instagram", position: "story" },
  INSTAGRAM_REELS: { platform: "instagram", position: "reels" },
  MESSENGER_INBOX: { platform: "messenger", position: "messenger_home" },
  AUDIENCE_NETWORK: { platform: "audience_network", position: "classic" },
};

/** Budowa pełnego obiektu targeting Meta z parametrów ustawionych przez użytkownika. */
function buildMetaTargeting(draft: CampaignComposerDraftPayload): Record<string, unknown> {
  const adset = draft.structure.adSets[0];
  const audience = adset?.audience;
  const metaAdSet = draft.meta?.adSet;

  const targeting: Record<string, unknown> = {
    geo_locations: {
      countries: audience?.geoInclude?.length ? audience.geoInclude : ["PL"],
    },
  };

  // Wiek
  if (typeof audience?.ageMin === "number") targeting.age_min = audience.ageMin;
  if (typeof audience?.ageMax === "number") targeting.age_max = audience.ageMax;

  // Płeć — 1 = mężczyźni, 2 = kobiety. "all"/puste = bez ograniczenia.
  const genders = metaAdSet?.genders ?? [];
  if (genders.length && !genders.includes("all")) {
    const map: Record<string, number> = { male: 1, female: 2 };
    const ids = genders.map((g) => map[g]).filter((n): n is number => Boolean(n));
    if (ids.length) targeting.genders = ids;
  }

  // Placementy — tylko gdy tryb ręczny i wybrano konkretne pozycje.
  const placementMode = metaAdSet?.placementMode ?? "advantage";
  const placements = (metaAdSet?.placements ?? []).filter((p) => p && p !== "ADVANTAGE_PLUS");
  if (placementMode === "manual" && placements.length) {
    const platforms = new Set<string>();
    const positionsByPlatform: Record<string, Set<string>> = {};
    for (const p of placements) {
      const m = META_PLACEMENT_MAP[p];
      if (!m) continue;
      platforms.add(m.platform);
      if (m.position) {
        (positionsByPlatform[m.platform] ??= new Set()).add(m.position);
      }
    }
    if (platforms.size) {
      targeting.publisher_platforms = Array.from(platforms);
      const posKey: Record<string, string> = {
        facebook: "facebook_positions",
        instagram: "instagram_positions",
        messenger: "messenger_positions",
        audience_network: "audience_network_positions",
      };
      for (const [platform, positions] of Object.entries(positionsByPlatform)) {
        const key = posKey[platform];
        if (key) targeting[key] = Array.from(positions);
      }
    }
  }

  return targeting;
}

function resolveCreativeAssets(ctx: AdapterContext, creative: CampaignComposerDraftPayload["structure"]["adSets"][0]["creatives"][0]) {
  return creative.assetIds
    .map((id) => {
      const a = ctx.resolvedAssets?.[id];
      return a ? { id, ...a } : null;
    })
    .filter((a): a is { id: string } & ResolvedCampaignAsset => Boolean(a));
}

async function uploadMetaImageHash(act: string, token: string, imageUrl: string): Promise<ProviderResult & { hash?: string }> {
  const { ok, json, status } = await graphPostRaw(`${act}/adimages`, token, { url: imageUrl });
  if (!ok) {
    const msg = json.error?.message ?? "Nie udało się wgrać grafiki do Meta";
    return {
      ok: false,
      message: msg,
      code: String(json.error?.code ?? status),
      retryable: status === 429 || status >= 500,
      raw: json,
    };
  }
  const images = json.images ?? {};
  const first = Object.values(images)[0];
  const hash = first?.hash;
  if (!hash) {
    return { ok: false, message: "Meta nie zwróciło hash obrazu po uploadzie.", retryable: false, raw: json };
  }
  return { ok: true, externalId: hash, hash, raw: json };
}

async function waitMetaVideoReady(videoId: string, token: string, maxAttempts = 12): Promise<ProviderResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const { ok, json } = await graphGetRaw(videoId, token, "status");
    if (!ok) {
      return { ok: false, message: json.error?.message ?? "Nie udało się sprawdzić statusu wideo w Meta.", retryable: true, raw: json };
    }
    const st = json.status?.video_status;
    if (st === "ready") return { ok: true, externalId: videoId, raw: json };
    if (st === "error") {
      return { ok: false, message: "Meta odrzuciło wgrane wideo.", retryable: false, raw: json };
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return { ok: false, message: "Przekroczono czas oczekiwania na przetworzenie wideo w Meta.", retryable: true };
}

async function uploadMetaVideoId(act: string, token: string, videoUrl: string, name: string): Promise<ProviderResult> {
  const { ok, json, status } = await graphPostRaw(`${act}/advideos`, token, {
    file_url: videoUrl,
    name: name.slice(0, 90),
  });
  if (!ok || !json.id) {
    const msg = json.error?.message ?? "Nie udało się wgrać wideo do Meta";
    return {
      ok: false,
      message: msg,
      code: String(json.error?.code ?? status),
      retryable: status === 429 || status >= 500,
      raw: json,
    };
  }
  return waitMetaVideoReady(json.id, token);
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
        const objective = draft.meta?.objective ?? "OUTCOME_TRAFFIC";
        const budgetType = draft.meta?.campaignBudgetType ?? "daily";
        const bidStrategy = adset?.budget?.bidStrategy || draft.meta?.adSet?.bidStrategy || "LOWEST_COST_WITHOUT_CAP";
        const params: Record<string, string | number | boolean | undefined> = {
          name: adset?.name ?? "Ad set",
          campaign_id: campaignId,
          billing_event: "IMPRESSIONS",
          optimization_goal: adset?.optimizationGoal ?? "LINK_CLICKS",
          bid_strategy: bidStrategy,
          targeting: JSON.stringify(buildMetaTargeting(draft)),
          status: liveStatus,
          start_time: adset?.schedule?.startAt,
          end_time: adset?.schedule?.endAt,
        };
        // Budżet: dzienny albo całkowity (lifetime). Lifetime wymaga end_time.
        if (budgetType === "lifetime") {
          params.lifetime_budget = Math.max(daily, 100);
        } else {
          params.daily_budget = Math.max(daily, 100);
        }
        if (objective.startsWith("OUTCOME_")) {
          params.destination_type = "WEBSITE";
        }
        const r = await graphPost(`${act}/adsets`, ctx.accessToken, params);
        return r.ok ? { ok: true, externalId: r.externalId, raw: r.raw } : r;
      }
      if (kind === "meta_ad_creative") {
        const adsetId = priorIds.meta_adset;
        if (!adsetId) return { ok: false, message: "Brak zestawu reklam Meta.", retryable: false };
        const pageId = draft.channel.metaPageId;
        if (!pageId) return { ok: false, message: "Brak Page ID — dodaj stronę Facebook w kanale.", retryable: false };

        const creative = draft.structure.adSets[0]?.creatives[0];
        if (!creative) return { ok: false, message: "Brak kreacji reklamowej w szkicu.", retryable: false };

        const assets = resolveCreativeAssets(ctx, creative);
        const format = creative.format ?? "single_image";
        const link = creative.destinationUrl || "https://example.com";
        const cta = creative.cta || "LEARN_MORE";
        const message = creative.primaryText ?? "";
        const headline = creative.headline ?? "";

        if (assets.length === 0) {
          return {
            ok: false,
            message: "Dodaj grafikę lub wideo z biblioteki kampanii — Meta wymaga materiału wizualnego.",
            retryable: false,
          };
        }

        let objectStorySpec: Record<string, unknown>;

        if (format === "video" || (assets.length === 1 && isVideoAsset(assets[0]))) {
          const uploaded = await uploadMetaVideoId(act, ctx.accessToken, assets[0].publicUrl, creative.headline ?? draft.structure.campaignName);
          if (!uploaded.ok) return uploaded;
          objectStorySpec = {
            page_id: pageId,
            video_data: {
              video_id: uploaded.externalId,
              title: headline,
              message,
              call_to_action: { type: cta, value: { link } },
            },
          };
        } else if (format === "carousel" && assets.length >= 2) {
          const childAttachments: Record<string, unknown>[] = [];
          for (const asset of assets.slice(0, 10)) {
            const up = await uploadMetaImageHash(act, ctx.accessToken, asset.publicUrl);
            if (!up.ok) return up;
            childAttachments.push({
              link,
              name: headline,
              description: creative.description ?? "",
              image_hash: up.hash,
              call_to_action: { type: cta, value: { link } },
            });
          }
          objectStorySpec = {
            page_id: pageId,
            link_data: {
              link,
              message,
              child_attachments: childAttachments,
            },
          };
        } else {
          const up = await uploadMetaImageHash(act, ctx.accessToken, assets[0].publicUrl);
          if (!up.ok) return up;
          objectStorySpec = {
            page_id: pageId,
            link_data: {
              link,
              message,
              name: headline,
              description: creative.description ?? "",
              image_hash: up.hash,
              call_to_action: { type: cta, value: { link } },
            },
          };
        }

        const cr = await graphPost(`${act}/adcreatives`, ctx.accessToken, {
          name: `cc_${draft.structure.campaignName}`.slice(0, 90),
          object_story_spec: JSON.stringify(objectStorySpec),
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
