import type { CampaignComposerDraftPayload } from "../domain/draft-schema";
import type { ValidationIssue } from "../validation/preflight";

export type PreviewSnapshot = {
  provider: "meta" | "linkedin" | "tiktok" | "google";
  headline: string;
  body: string;
  cta: string;
  destination: string;
  assetUrls: string[];
  frame: "feed" | "sidebar" | "linkedin_feed" | "tiktok_feed";
  warnings: ValidationIssue[];
};

export function buildLocalPreview(draft: CampaignComposerDraftPayload, issues: ValidationIssue[]): PreviewSnapshot {
  const ad0 = draft.structure.adSets[0]?.creatives[0];
  const gHeadline = draft.google?.headlines?.[0] || draft.google?.headline;
  const gBody = draft.google?.descriptions?.[0] || draft.google?.description;
  return {
    provider: draft.channel.provider,
    headline: gHeadline || ad0?.headline || "(nagłówek)",
    body: gBody || ad0?.primaryText || "(tekst)",
    cta: ad0?.cta ?? "—",
    destination: draft.google?.finalUrl || ad0?.destinationUrl || "—",
    assetUrls: [],
    frame:
      draft.channel.provider === "linkedin"
        ? "linkedin_feed"
        : draft.channel.provider === "tiktok"
          ? "tiktok_feed"
          : "feed",
    warnings: issues.filter((i) => i.severity === "warning"),
  };
}

/** Meta Ad Preview API — wymaga dodatkowych uprawnień; zwraca null jeśli niedostępne. */
export async function tryMetaAdPreview(_accessToken: string, _creativeSpec: unknown): Promise<string | null> {
  return null;
}
