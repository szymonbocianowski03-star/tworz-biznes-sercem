import type { CampaignComposerDraftPayload } from "../domain/draft-schema";

export type ProviderName = "meta" | "linkedin" | "tiktok";

export type ProviderStepKind =
  | "meta_campaign"
  | "meta_adset"
  | "meta_ad_creative"
  | "linkedin_campaign_group"
  | "linkedin_campaign"
  | "linkedin_creative"
  | "linkedin_image_register"
  | "tiktok_campaign"
  | "tiktok_adgroup"
  | "tiktok_creative"
  | "tiktok_lead_form";

export type ProviderOk = { ok: true; externalId: string; raw?: unknown };
export type ProviderErr = { ok: false; message: string; code?: string; retryable?: boolean; raw?: unknown };
export type ProviderResult = ProviderOk | ProviderErr;

export type ResolvedCampaignAsset = {
  publicUrl: string;
  source: string;
};

export type AdapterContext = {
  dryRun: boolean;
  accessToken: string;
  /** Meta: act_123 */
  adAccountId: string;
  /** true = utwórz obiekty ze statusem ACTIVE (go_live), false = PAUSED */
  publishLive?: boolean;
  /** cc_asset id → URL pliku do uploadu u providera */
  resolvedAssets?: Record<string, ResolvedCampaignAsset>;
};

export interface AdsPlatformAdapter {
  readonly provider: ProviderName;
  buildLaunchPlan(draft: CampaignComposerDraftPayload): { order: number; kind: ProviderStepKind; label: string }[];
  executeStep(
    ctx: AdapterContext,
    draft: CampaignComposerDraftPayload,
    kind: ProviderStepKind,
    priorIds: Record<string, string>,
  ): Promise<ProviderResult>;
}
