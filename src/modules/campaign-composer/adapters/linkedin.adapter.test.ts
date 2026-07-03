import { describe, expect, it } from "vitest";
import { linkedInAdsAdapter } from "./linkedin.adapter";
import { defaultDraftPayload } from "../domain/draft-schema";

describe("LinkedInAdsAdapter", () => {
  it("dry-run dla campaign group", async () => {
    const draft = defaultDraftPayload({ provider: "linkedin", adAccountId: "123", campaignName: "L" });
    draft.structure.adSets[0].creatives[0].destinationUrl = "https://example.com";
    const r = await linkedInAdsAdapter.executeStep(
      { dryRun: true, accessToken: "t", adAccountId: "123" },
      draft,
      "linkedin_campaign_group",
      {},
    );
    expect(r.ok).toBe(true);
  });
});
