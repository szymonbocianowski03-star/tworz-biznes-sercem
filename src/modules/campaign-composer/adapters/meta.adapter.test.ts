import { describe, expect, it, afterEach, vi } from "vitest";
import { metaMarketingAdapter } from "./meta.adapter";
import { defaultDraftPayload } from "../domain/draft-schema";

describe("MetaMarketingAdapter", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("dry-run zwraca syntetyczne id", async () => {
    const draft = defaultDraftPayload({ provider: "meta", adAccountId: "act_1", campaignName: "X" });
    draft.channel.metaPageId = "p1";
    draft.structure.adSets[0].creatives[0].destinationUrl = "https://a.pl";
    const r = await metaMarketingAdapter.executeStep(
      { dryRun: true, accessToken: "t", adAccountId: "act_1" },
      draft,
      "meta_campaign",
      {},
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.externalId).toContain("dry_meta");
  });
});
