import type { AdsPlatformAdapter, AdapterContext, ProviderResult, ProviderStepKind } from "./types";
import type { CampaignComposerDraftPayload } from "../domain/draft-schema";

const API = "https://api.linkedin.com/rest";

function liHeaders(token: string, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": "202411",
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
    ...extra,
  };
}

async function liPost(path: string, token: string, body: unknown) {
  const res = await fetch(`${API}/${path}`, { method: "POST", headers: liHeaders(token), body: JSON.stringify(body) });
  const text = await res.text();
  let json: { id?: string; message?: string; errorDetails?: unknown } = {};
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    /* empty */
  }
  const id = res.headers.get("x-restli-id") ?? json.id;
  if (!res.ok) {
    return {
      ok: false as const,
      message: json.message ?? text.slice(0, 400) ?? res.statusText,
      code: String(res.status),
      retryable: res.status >= 500 || res.status === 429,
      raw: json,
    };
  }
  if (!id) {
    return { ok: false as const, message: "Brak identyfikatora zasobu LinkedIn w odpowiedzi", retryable: false, raw: json };
  }
  return { ok: true as const, externalId: id, raw: json };
}

/**
 * Adapter LinkedIn Ads (REST 2024+).
 * Pełna ścieżka tworzenia grupy → kampanii → kreacji wymaga dodatkowych encji (creative);
 * tutaj: plan kroków + minimalny szkielet z jasnym dry-run i mapowaniem błędów.
 */
export class LinkedInAdsAdapter implements AdsPlatformAdapter {
  readonly provider = "linkedin" as const;

  buildLaunchPlan(_draft: CampaignComposerDraftPayload) {
    return [
      { order: 1, kind: "linkedin_campaign_group" as const, label: "Grupa kampanii" },
      { order: 2, kind: "linkedin_campaign" as const, label: "Kampania" },
      { order: 3, kind: "linkedin_creative" as const, label: "Kreacja (Sponsored Content)" },
    ];
  }

  async executeStep(
    ctx: AdapterContext,
    draft: CampaignComposerDraftPayload,
    kind: ProviderStepKind,
    priorIds: Record<string, string>,
  ): Promise<ProviderResult> {
    if (ctx.dryRun) {
      return { ok: true, externalId: `dry_li_${kind}_${Date.now()}`, raw: { dryRun: true } };
    }

    const account = ctx.adAccountId.startsWith("urn:li:sponsoredAccount:") ? ctx.adAccountId : `urn:li:sponsoredAccount:${ctx.adAccountId}`;

    try {
      if (kind === "linkedin_campaign_group") {
        const cg = draft.structure.campaignGroup;
        const body = {
          account: account,
          name: cg?.name ?? "Grupa",
          status: "PAUSED",
          runSchedule: {
            start: draft.structure.adSets[0]?.schedule?.startAt ? Date.parse(draft.structure.adSets[0].schedule.startAt!) : Date.now(),
            end: draft.structure.adSets[0]?.schedule?.endAt ? Date.parse(draft.structure.adSets[0].schedule.endAt!) : undefined,
          },
        };
        const r = await liPost("adCampaignGroups", ctx.accessToken, body);
        return r.ok ? { ok: true, externalId: r.externalId, raw: r.raw } : r;
      }
      if (kind === "linkedin_campaign") {
        const groupUrn = priorIds.linkedin_campaign_group;
        if (!groupUrn) return { ok: false, message: "Brak grupy kampanii LinkedIn.", retryable: false };
        const objectiveType = draft.linkedin?.objective ?? "WEBSITE_TRAFFIC";
        const body = {
          name: draft.structure.campaignName,
          account: account,
          campaignGroup: groupUrn.startsWith("urn:") ? groupUrn : `urn:li:sponsoredCampaignGroup:${groupUrn}`,
          type: "SPONSORED_UPDATES",
          objectiveType,
          status: "PAUSED",
          runSchedule: {
            start: draft.structure.adSets[0]?.schedule?.startAt
              ? Date.parse(draft.structure.adSets[0].schedule.startAt!)
              : Date.now(),
            end: draft.structure.adSets[0]?.schedule?.endAt
              ? Date.parse(draft.structure.adSets[0].schedule.endAt!)
              : undefined,
          },
          dailyBudget: { amount: String((draft.structure.adSets[0]?.budget?.dailyBudgetMinorUnits ?? 2000) / 100), currencyCode: "USD" },
        };
        const r = await liPost("adCampaigns", ctx.accessToken, body);
        return r.ok ? { ok: true, externalId: r.externalId, raw: r.raw } : r;
      }
      if (kind === "linkedin_creative") {
        /** Kreacja Sponsored Content wymaga postów / images API — do rozszerzenia przy pełnych scope. */
        return {
          ok: false,
          message:
            "Krok kreacji LinkedIn: wymagana rejestracja obrazu (images API) i powiązanie z formatem — skonfiguruj scope rw_ads i uzupełnij asset pipeline.",
          code: "LINKEDIN_CREATIVE_TODO",
          retryable: false,
        };
      }
      if (kind === "linkedin_image_register") {
        return { ok: false, message: "Rejestracja obrazu: użyj dedykowanego uploadu do images API.", retryable: false };
      }
      return { ok: false, message: `Nieobsługiwany krok LinkedIn: ${kind}`, retryable: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Błąd sieci LinkedIn";
      return { ok: false, message: msg, retryable: true, raw: e };
    }
  }
}

export const linkedInAdsAdapter = new LinkedInAdsAdapter();
