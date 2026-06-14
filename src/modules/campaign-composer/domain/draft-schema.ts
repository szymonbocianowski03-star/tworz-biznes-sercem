import { z } from "zod";

/** Cele wyników — Meta OUTCOME_* (mapowanie do Marketing API w adapterze). */
export const metaObjectiveSchema = z.enum([
  "OUTCOME_AWARENESS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_SALES",
  "OUTCOME_APP_PROMOTION",
]);

export const linkedInObjectiveSchema = z.enum([
  "WEBSITE_CONVERSION",
  "WEBSITE_TRAFFIC",
  "LEAD_GENERATION",
  "BRAND_AWARENESS",
  "VIDEO_VIEW",
  "ENGAGEMENT",
  "JOB_APPLICANTS",
]);

/**
 * Cele kampanii TikTok Ads (kategorie: Brand awareness / Sales / Lead generation).
 * Wartości UI -> wartości TikTok Ads API w `tiktokObjectiveMap`.
 */
export const tiktokObjectiveSchema = z.enum([
  "traffic",
  "video_views",
  "community_interaction",
  "website_conversion",
  "tiktok_shop",
  "website_form",
  "tiktok_instant_form",
  "direct_messages",
  "reach",
  "app_promotion",
]);

/**
 * Mapowanie celu UI -> objective_type TikTok Ads API.
 * TODO: zweryfikować dokładne wartości z aktualną dokumentacją TikTok Ads API
 * (np. REACH, TRAFFIC, VIDEO_VIEWS, ENGAGEMENT, WEB_CONVERSIONS, LEAD_GENERATION, PRODUCT_SALES).
 */
export const tiktokObjectiveMap: Record<z.infer<typeof tiktokObjectiveSchema>, string> = {
  traffic: "TRAFFIC",
  video_views: "VIDEO_VIEWS",
  community_interaction: "ENGAGEMENT", // TODO: potwierdź (COMMUNITY_INTERACTION)
  website_conversion: "WEB_CONVERSIONS",
  tiktok_shop: "PRODUCT_SALES", // TODO: potwierdź wartość dla TikTok Shop
  website_form: "LEAD_GENERATION",
  tiktok_instant_form: "LEAD_GENERATION",
  direct_messages: "LEAD_GENERATION", // TODO: potwierdź (ENGAGEMENT/MESSAGES)
  reach: "REACH",
  app_promotion: "APP_PROMOTION",
};

export const composerModeSchema = z.enum([
  "create_new",
  "from_previous",
  "use_existing",
  "duplicate_structure",
]);

export const metaSpecialAdCategorySchema = z.enum(["NONE", "EMPLOYMENT", "HOUSING", "CREDIT", "ISSUES_ELECTIONS_POLITICS"]).default("NONE");

const placementSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
});

const budgetSchema = z.object({
  dailyBudgetMinorUnits: z.number().int().nonnegative().optional(),
  lifetimeBudgetMinorUnits: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).default("PLN"),
  bidStrategy: z.string().optional(),
  budgetOptimization: z.boolean().optional(),
});

const scheduleSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  timezone: z.string().optional(),
});

const targetingFacetSchema = z.object({
  facetUrn: z.string(),
  operator: z.enum(["INCLUDE", "EXCLUDE"]),
  values: z.array(z.string()),
});

const audienceSchema = z.object({
  geoInclude: z.array(z.string()).default([]),
  geoExclude: z.array(z.string()).default([]),
  ageMin: z.number().int().min(18).max(65).optional(),
  ageMax: z.number().int().min(18).max(65).optional(),
  advantageAudience: z.boolean().optional(),
  audienceExpansion: z.boolean().optional(),
  linkedinFacets: z.array(targetingFacetSchema).default([]),
  booleanGroups: z
    .array(
      z.object({
        id: z.string(),
        mode: z.enum(["AND", "OR"]),
        include: z.array(targetingFacetSchema),
        exclude: z.array(targetingFacetSchema),
      }),
    )
    .default([]),
});

const creativeUnitSchema = z.object({
  id: z.string(),
  headline: z.string().max(200).optional(),
  primaryText: z.string().max(5000).optional(),
  description: z.string().max(500).optional(),
  destinationUrl: z.string().url().optional().or(z.literal("")),
  cta: z.string().optional(),
  urlTags: z.string().max(2000).optional(),
  assetIds: z.array(z.string()).max(10).default([]),
  altText: z.string().max(2000).optional(),
  format: z.enum(["single_image", "carousel", "video", "article_share", "dark_post"]).default("single_image"),
  linkedinLeadGenFormId: z.string().optional(),
  existingPostId: z.string().optional(),
  directSponsored: z.boolean().optional(),
});

const adSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  optimizationGoal: z.string().optional(),
  billingEvent: z.string().optional(),
  placements: z.array(placementSchema).default([]),
  budget: budgetSchema.optional(),
  schedule: scheduleSchema.optional(),
  audience: audienceSchema.default({ geoInclude: [], geoExclude: [], linkedinFacets: [], booleanGroups: [] }),
  creatives: z.array(creativeUnitSchema).default([]),
});

/** LinkedIn: grupa kampanii (natywny byt). Meta: logiczny kontener w payloadzie. */
export const campaignGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerGroupUrn: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});

export const campaignComposerDraftPayloadSchema = z.object({
  version: z.literal(1),
  channel: z.object({
    provider: z.enum(["meta", "linkedin", "tiktok"]),
    adAccountId: z.string().default(""),
    metaConnectionId: z.string().uuid().optional(),
    linkedinConnectionId: z.string().uuid().optional(),
    tiktokConnectionId: z.string().uuid().optional(),
    metaPageId: z.string().optional(),
    metaPixelId: z.string().optional(),
    linkedinOrganizationUrn: z.string().optional(),
    tiktokAdvertiserId: z.string().optional(),
  }),
  mode: composerModeSchema,
  referenceCampaignId: z.string().optional(),
  meta: z
    .object({
      objective: metaObjectiveSchema,
      specialAdCategory: metaSpecialAdCategorySchema,
      specialAdCategoryCountry: z.array(z.string()).default([]),
      status: z.enum(["paused", "active"]).default("paused"),
      budgetStrategy: z.enum(["campaign_budget", "ad_set_budget"]).default("ad_set_budget"),
      campaignBudgetType: z.enum(["daily", "lifetime"]).default("daily"),
      campaignBudgetAmountMinor: z.number().int().nonnegative().optional(),
      instagramActorId: z.string().optional(),
      // ── Poziom Ad Set ──
      adSet: z
        .object({
          name: z.string().default(""),
          placementMode: z.enum(["advantage", "manual"]).default("advantage"),
          placements: z.array(z.string()).default([]),
          budgetType: z.enum(["daily", "lifetime"]).default("daily"),
          budgetAmountMinor: z.number().int().nonnegative().optional(),
          startAt: z.string().optional(),
          endAt: z.string().optional(),
          optimizationGoal: z.string().default(""),
          bidStrategy: z.string().optional(),
          pixelId: z.string().optional(),
          conversionEvent: z.string().optional(),
          locations: z.array(z.string()).default([]),
          ageMin: z.number().int().min(13).max(65).default(18),
          ageMax: z.number().int().min(13).max(65).default(65),
          genders: z.array(z.string()).default([]),
          languages: z.array(z.string()).default([]),
          interests: z.array(z.string()).default([]),
          customAudienceIds: z.array(z.string()).default([]),
          lookalikeAudienceIds: z.array(z.string()).default([]),
        })
        .default({ name: "", placementMode: "advantage", placements: [], budgetType: "daily", optimizationGoal: "", locations: [], ageMin: 18, ageMax: 65, genders: [], languages: [], interests: [], customAudienceIds: [], lookalikeAudienceIds: [] }),
      // ── Poziom Ad ──
      ad: z
        .object({
          name: z.string().default(""),
          creativeFormat: z.enum(["single_image", "single_video", "carousel", "collection", "existing_post"]).default("single_image"),
          primaryText: z.string().max(5000).default(""),
          headline: z.string().max(255).default(""),
          description: z.string().max(255).default(""),
          cta: z.string().default(""),
          destinationUrl: z.string().optional(),
          existingPostId: z.string().optional(),
          utm: z.string().optional(),
        })
        .default({ name: "", creativeFormat: "single_image", primaryText: "", headline: "", description: "", cta: "" }),
    })
    .optional(),
  linkedin: z
    .object({
      objective: linkedInObjectiveSchema,
      format: z.string().optional(),
      complianceAcknowledged: z.boolean().optional(),
      nonDiscriminationAcknowledged: z.boolean().optional(),
      politicalIntentEu: z.boolean().optional(),
      conversionPixelUrn: z.string().optional(),
      // ── Poziom Campaign / Campaign Group ──
      campaign: z
        .object({
          dynamicGroupBudget: z.enum(["enabled", "disabled"]).default("disabled"),
          budgetType: z.enum(["daily", "lifetime"]).default("daily"),
          budgetAmountMinor: z.number().int().nonnegative().optional(),
          startAt: z.string().optional(),
          endAt: z.string().optional(),
          status: z.enum(["paused", "active"]).default("paused"),
        })
        .default({ dynamicGroupBudget: "disabled", budgetType: "daily", status: "paused" }),
      // ── Poziom Ad Set ──
      adSet: z
        .object({
          name: z.string().default(""),
          adSetType: z.enum(["classic", "accelerate"]).default("classic"),
          budgetType: z.enum(["daily", "lifetime"]).default("daily"),
          budgetAmountMinor: z.number().int().nonnegative().optional(),
          bidType: z.enum(["max_delivery", "cost_cap", "manual"]).default("max_delivery"),
          bidAmountMinor: z.number().int().nonnegative().optional(),
          startAt: z.string().optional(),
          endAt: z.string().optional(),
          optimizationGoal: z.string().default(""),
          insightTag: z.string().optional(),
          conversionEvent: z.string().optional(),
          locations: z.array(z.string()).default([]),
          languages: z.array(z.string()).default([]),
          companies: z.array(z.string()).default([]),
          industries: z.array(z.string()).default([]),
          companySizes: z.array(z.string()).default([]),
          jobTitles: z.array(z.string()).default([]),
          jobFunctions: z.array(z.string()).default([]),
          seniorities: z.array(z.string()).default([]),
          skills: z.array(z.string()).default([]),
          education: z.array(z.string()).default([]),
          fieldsOfStudy: z.array(z.string()).default([]),
          degrees: z.array(z.string()).default([]),
          memberGroups: z.array(z.string()).default([]),
          interests: z.array(z.string()).default([]),
          matchedAudiences: z.array(z.string()).default([]),
          audienceNetwork: z.boolean().default(false),
        })
        .default({ name: "", adSetType: "classic", budgetType: "daily", bidType: "max_delivery", optimizationGoal: "", locations: [], languages: [], companies: [], industries: [], companySizes: [], jobTitles: [], jobFunctions: [], seniorities: [], skills: [], education: [], fieldsOfStudy: [], degrees: [], memberGroups: [], interests: [], matchedAudiences: [], audienceNetwork: false }),
      // ── Poziom Ad ──
      ad: z
        .object({
          name: z.string().default(""),
          adFormat: z
            .enum([
              "single_image",
              "video",
              "carousel",
              "document",
              "message",
              "conversation",
              "text",
              "spotlight",
              "follower",
              "event",
              "single_job",
            ])
            .default("single_image"),
          introText: z.string().max(3000).default(""),
          headline: z.string().max(255).default(""),
          description: z.string().max(500).default(""),
          destinationUrl: z.string().optional(),
          cta: z.string().default(""),
          leadGenFormId: z.string().optional(),
          documentAssetId: z.string().optional(),
          senderId: z.string().optional(),
          conversationFlow: z.string().optional(),
          utm: z.string().optional(),
        })
        .default({ name: "", adFormat: "single_image", introText: "", headline: "", description: "", cta: "" }),
    })
    .optional(),
  tiktok: z
    .object({
      objective: tiktokObjectiveSchema,
      optimizationLocation: z.string().optional(),
      optimizationGoal: z.string().optional(),
      budgetType: z.enum(["daily", "lifetime"]).optional(),
      // ── Poziom kampanii TikTok ──
      status: z.enum(["draft", "active", "paused"]).default("draft"),
      budgetMode: z.enum(["no_limit", "daily", "lifetime"]).default("daily"),
      budgetAmountMinor: z.number().int().nonnegative().optional(),
      // ── Poziom grupy reklam (Ad Group) ──
      adGroup: z
        .object({
          name: z.string().default(""),
          placementMode: z.enum(["automatic", "manual"]).default("automatic"),
          placements: z.array(z.string()).default([]),
          budgetMode: z.enum(["daily", "lifetime"]).default("daily"),
          budgetAmountMinor: z.number().int().nonnegative().optional(),
          scheduleType: z.enum(["continuous", "specific_dates"]).default("continuous"),
          startAt: z.string().optional(),
          endAt: z.string().optional(),
          dayparting: z.string().optional(),
          optimizationGoal: z.string().default(""),
          bidStrategy: z.string().optional(),
          bidAmountMinor: z.number().int().nonnegative().optional(),
          pixelId: z.string().optional(),
          conversionEvent: z.string().optional(),
        })
        .default({ name: "", placementMode: "automatic", placements: [], budgetMode: "daily", scheduleType: "continuous", optimizationGoal: "" }),
      // ── Targetowanie ──
      targeting: z
        .object({
          locations: z.array(z.string()).default([]),
          ageGroups: z.array(z.string()).default([]),
          genders: z.array(z.string()).default([]),
          languages: z.array(z.string()).default([]),
          interests: z.array(z.string()).default([]),
          behaviors: z.array(z.string()).default([]),
          devices: z.array(z.string()).default([]),
          customAudienceIds: z.array(z.string()).default([]),
          lookalikeAudienceIds: z.array(z.string()).default([]),
        })
        .default({ locations: [], ageGroups: [], genders: [], languages: [], interests: [], behaviors: [], devices: [], customAudienceIds: [], lookalikeAudienceIds: [] }),
      // ── Poziom reklamy (Ad) ──
      ad: z
        .object({
          name: z.string().default(""),
          identityId: z.string().optional(),
          creativeType: z.enum(["video", "existing", "spark"]).default("video"),
          thumbnailUrl: z.string().optional(),
          adText: z.string().max(2200).default(""),
          cta: z.string().default(""),
          destinationUrl: z.string().optional(),
          displayName: z.string().optional(),
          utm: z.string().optional(),
          trackingPixelId: z.string().optional(),
          trackingEvent: z.string().optional(),
          sparkPostUrl: z.string().optional(),
        })
        .default({ name: "", creativeType: "video", adText: "", cta: "" }),
      leadForm: z
        .object({
          formName: z.string().optional(),
          headline: z.string().optional(),
          description: z.string().optional(),
          privacyPolicyUrl: z.string().url().optional().or(z.literal("")),
        })
        .optional(),
    })
    .optional(),
  structure: z.object({
    campaignName: z.string().min(1),
    campaignGroup: campaignGroupSchema.optional(),
    adSets: z.array(adSetSchema).min(1),
  }),
  reviewNotes: z.string().optional(),
});

export type CampaignComposerDraftPayload = z.infer<typeof campaignComposerDraftPayloadSchema>;
export type CreativeUnit = z.infer<typeof creativeUnitSchema>;
export type AdSetPayload = z.infer<typeof adSetSchema>;

export function defaultDraftPayload(partial: {
  provider: "meta" | "linkedin" | "tiktok";
  adAccountId: string;
  campaignName: string;
}): CampaignComposerDraftPayload {
  const base = {
    version: 1 as const,
    channel: {
      provider: partial.provider,
      adAccountId: partial.adAccountId,
    },
    mode: "create_new" as const,
    structure: {
      campaignName: partial.campaignName,
      adSets: [
        {
          id: crypto.randomUUID(),
          name:
            partial.provider === "meta"
              ? "Zestaw reklam 1"
              : partial.provider === "tiktok"
                ? "Grupa reklam TikTok 1"
                : "Kampania LinkedIn 1",
          placements: [],
          audience: { geoInclude: [], geoExclude: [], linkedinFacets: [], booleanGroups: [] },
          creatives: [
            {
              id: crypto.randomUUID(),
              format: "single_image" as const,
              assetIds: [],
              cta: partial.provider === "meta" ? "LEARN_MORE" : undefined,
            },
          ],
        },
      ],
    },
  };
  if (partial.provider === "meta") {
    return campaignComposerDraftPayloadSchema.parse({
      ...base,
      meta: {
        objective: "OUTCOME_TRAFFIC",
        specialAdCategory: "NONE",
        specialAdCategoryCountry: [],
      },
    });
  }
  if (partial.provider === "tiktok") {
    return campaignComposerDraftPayloadSchema.parse({
      ...base,
      tiktok: {
        objective: "traffic",
        optimizationLocation: "Website",
        optimizationGoal: "Clicks",
        budgetType: "daily",
        status: "draft",
        budgetMode: "daily",
        budgetAmountMinor: 5000,
        adGroup: {
          name: "Grupa reklam TikTok 1",
          placementMode: "automatic",
          placements: [],
          budgetMode: "daily",
          budgetAmountMinor: 2000,
          scheduleType: "continuous",
          optimizationGoal: "CLICK",
        },
        ad: {
          name: "Reklama TikTok 1",
          creativeType: "video",
          adText: "",
          cta: "LEARN_MORE",
        },
      },
    });
  }
  return campaignComposerDraftPayloadSchema.parse({
    ...base,
    linkedin: {
      objective: "WEBSITE_TRAFFIC",
      complianceAcknowledged: false,
      nonDiscriminationAcknowledged: false,
    },
    structure: {
      ...base.structure,
      campaignGroup: {
        id: crypto.randomUUID(),
        name: "Grupa reklamowa",
      },
    },
  });
}
