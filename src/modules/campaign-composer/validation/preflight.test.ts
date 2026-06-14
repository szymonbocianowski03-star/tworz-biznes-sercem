import { describe, expect, it } from "vitest";
import { defaultDraftPayload } from "../domain/draft-schema";
import { blockingCount, runPreflightValidation } from "./preflight";

describe("runPreflightValidation", () => {
  it("wymaga URL dla Meta", () => {
    const d = defaultDraftPayload({
      provider: "meta",
      adAccountId: "123",
      campaignName: "T",
    });
    d.channel.metaPageId = "page1";
    d.meta!.specialAdCategory = "NONE";
    const issues = runPreflightValidation(d, {
      hasMetaPage: true,
      hasMetaPixelWhenRequired: true,
      hasLinkedInOrg: true,
      scopesMeta: ["ads_management"],
      scopesLinkedIn: [],
    });
    expect(blockingCount(issues)).toBeGreaterThan(0);
    expect(issues.some((i) => i.code === "DESTINATION_URL")).toBe(true);
  });

  it("LinkedIn: wymaga grupy kampanii", () => {
    const d = defaultDraftPayload({
      provider: "linkedin",
      adAccountId: "999",
      campaignName: "L",
    });
    d.structure.campaignGroup = { id: "g1", name: "" };
    d.channel.linkedinOrganizationUrn = "urn:li:organization:1";
    d.linkedin!.objective = "WEBSITE_TRAFFIC";
    d.structure.adSets[0].creatives[0].destinationUrl = "https://example.com";
    const issues = runPreflightValidation(d, {
      hasMetaPage: true,
      hasMetaPixelWhenRequired: true,
      hasLinkedInOrg: true,
      scopesMeta: [],
      scopesLinkedIn: ["r_ads"],
    });
    expect(issues.some((i) => i.code === "LI_CAMPAIGN_GROUP")).toBe(true);
  });
});
