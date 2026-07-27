import type { CampaignComposerDraftPayload } from "../domain/draft-schema";
import { TIKTOK_MIN_CAMPAIGN_DAILY_MINOR, TIKTOK_MIN_ADGROUP_DAILY_MINOR } from "@/lib/campaignComposerLabels";
import {
  GOOGLE_MIN_DAILY_BUDGET_MINOR,
  googleNeedsAppId,
  googleNeedsImages,
  googleNeedsKeywords,
  googleNeedsMerchant,
  googleNeedsYoutube,
  type GoogleCampaignType,
} from "../config/googleAdsFields";

export type ValidationSeverity = "blocking" | "warning";

export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  message: string;
  fieldPath?: string;
};

/** Akceptuje też adresy bez protokołu — przed walidacją dodaje https:// */
export function normalizeDestinationUrl(s: string | undefined): string | undefined {
  const t = s?.trim();
  if (!t) return undefined;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

const URL_OK = (s: string | undefined) => {
  const n = normalizeDestinationUrl(s);
  if (!n) return false;
  try {
    new URL(n);
    return true;
  } catch {
    return false;
  }
};

const HTTPS_OK = (s: string | undefined) => {
  const n = normalizeDestinationUrl(s);
  if (!n) return false;
  try {
    return new URL(n).protocol === "https:";
  } catch {
    return false;
  }
};

/** Walidacja kampanii Google Ads (wszystkie typy). */
export function googlePreflight(draft: CampaignComposerDraftPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const g = draft.google;
  if (!g) {
    issues.push({ code: "GADS_CONFIG", severity: "blocking", message: "Brak konfiguracji kampanii Google Ads.", fieldPath: "google" });
    return issues;
  }
  if (!draft.structure.campaignName?.trim()) {
    issues.push({ code: "GADS_NAME", severity: "blocking", message: "Podaj nazwę kampanii Google Ads.", fieldPath: "structure.campaignName" });
  }
  if (!g.campaignType) {
    issues.push({ code: "GADS_TYPE", severity: "blocking", message: "Wybierz typ kampanii Google Ads.", fieldPath: "google.campaignType" });
  }
  if (!g.dailyBudgetMinor || g.dailyBudgetMinor <= 0) {
    issues.push({ code: "GADS_BUDGET", severity: "blocking", message: "Podaj budżet dzienny Google Ads.", fieldPath: "google.dailyBudgetMinor" });
  } else if (g.dailyBudgetMinor < GOOGLE_MIN_DAILY_BUDGET_MINOR) {
    issues.push({
      code: "GADS_BUDGET_MIN",
      severity: "warning",
      message: `Budżet dzienny jest niski (zalecane min. ${(GOOGLE_MIN_DAILY_BUDGET_MINOR / 100).toFixed(0)}).`,
      fieldPath: "google.dailyBudgetMinor",
    });
  }

  const type = g.campaignType as GoogleCampaignType;
  const assets = draft.structure.adSets[0]?.creatives[0]?.assetIds ?? [];
  const headlines = (g.headlines?.length ? g.headlines : [g.headline]).map((h) => h?.trim()).filter(Boolean);
  const descriptions = (g.descriptions?.length ? g.descriptions : [g.description]).map((d) => d?.trim()).filter(Boolean);
  const finalUrl = g.finalUrl || draft.structure.adSets[0]?.creatives[0]?.destinationUrl;
  const needsUrl = type !== "APP" && type !== "SHOPPING";

  if (needsUrl && !URL_OK(finalUrl)) {
    issues.push({ code: "GADS_URL", severity: "blocking", message: "Podaj prawidłowy Final URL (adres docelowy).", fieldPath: "google.finalUrl" });
  }

  if (type !== "SHOPPING" && type !== "APP") {
    const minH = type === "VIDEO" ? 1 : 3;
    const minD = type === "VIDEO" ? 0 : 2;
    if (headlines.length < minH) {
      issues.push({
        code: "GADS_HEADLINES",
        severity: "blocking",
        message: `Dodaj co najmniej ${minH} nagłówk${minH === 1 ? "" : "i"} (max 30 znaków).`,
        fieldPath: "google.headlines",
      });
    }
    if (minD > 0 && descriptions.length < minD) {
      issues.push({
        code: "GADS_DESCRIPTIONS",
        severity: "blocking",
        message: `Dodaj co najmniej ${minD} opis${minD === 1 ? "" : "y"} (max 90 znaków).`,
        fieldPath: "google.descriptions",
      });
    }
  }

  if (googleNeedsImages(type) && assets.length < 1) {
    issues.push({
      code: "GADS_IMAGES",
      severity: "blocking",
      message: `${type}: dodaj co najmniej jedno zdjęcie (biblioteka lub dysk).`,
      fieldPath: "structure.adSets.0.creatives.0.assetIds",
    });
  }

  if (googleNeedsYoutube(type) && !(g.youtubeVideoIds?.length)) {
    issues.push({
      code: "GADS_YOUTUBE",
      severity: "blocking",
      message: "Kampania Video: wklej link YouTube do filmu.",
      fieldPath: "google.youtubeVideoIds",
    });
  }

  if (googleNeedsKeywords(type) && !(g.keywords?.length)) {
    issues.push({
      code: "GADS_KEYWORDS",
      severity: "warning",
      message: "Kampania Search bez słów kluczowych — dodaj je dla lepszej skuteczności.",
      fieldPath: "google.keywords",
    });
  }

  if (googleNeedsMerchant(type) && !g.merchantCenterId?.replace(/[^0-9]/g, "")) {
    issues.push({
      code: "GADS_MERCHANT",
      severity: "blocking",
      message: "Shopping: podaj ID Google Merchant Center.",
      fieldPath: "google.merchantCenterId",
    });
  }

  if (googleNeedsAppId(type) && !g.appId?.trim()) {
    issues.push({
      code: "GADS_APP_ID",
      severity: "blocking",
      message: "App: podaj ID aplikacji (pakiet Android lub App Store ID).",
      fieldPath: "google.appId",
    });
  }

  if (type === "DEMAND_GEN" && assets.length < 1 && !(g.youtubeVideoIds?.length)) {
    issues.push({
      code: "GADS_DEMAND_GEN_MEDIA",
      severity: "blocking",
      message: "Demand Gen: dodaj zdjęcie lub link YouTube.",
      fieldPath: "structure.adSets.0.creatives.0.assetIds",
    });
  }

  return issues;
}

/** Walidacja kampanii TikTok Ads (osobna logika — pola tiktok.*, nie adSet creatives). */
export function tiktokPreflight(draft: CampaignComposerDraftPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const tt = draft.tiktok;
  if (!tt) {
    issues.push({ code: "TT_CONFIG", severity: "blocking", message: "Brak konfiguracji kampanii TikTok.", fieldPath: "tiktok" });
    return issues;
  }

  // ── Campaign ──
  if (!draft.structure.campaignName?.trim()) {
    issues.push({ code: "TT_CAMPAIGN_NAME", severity: "blocking", message: "Podaj nazwę kampanii TikTok.", fieldPath: "structure.campaignName" });
  }
  if (!tt.objective) {
    issues.push({ code: "TT_OBJECTIVE", severity: "blocking", message: "Wybierz cel kampanii TikTok.", fieldPath: "tiktok.objective" });
  }
  if (tt.budgetMode === "daily" || tt.budgetMode === "lifetime") {
    if (!tt.budgetAmountMinor || tt.budgetAmountMinor <= 0) {
      issues.push({ code: "TT_CAMPAIGN_BUDGET", severity: "blocking", message: "Podaj kwotę budżetu kampanii TikTok.", fieldPath: "tiktok.budgetAmountMinor" });
    } else if (tt.budgetMode === "daily" && tt.budgetAmountMinor < TIKTOK_MIN_CAMPAIGN_DAILY_MINOR) {
      issues.push({
        code: "TT_CAMPAIGN_BUDGET_MIN",
        severity: "blocking",
        message: `Budżet dzienny kampanii TikTok jest poniżej minimum (${(TIKTOK_MIN_CAMPAIGN_DAILY_MINOR / 100).toFixed(0)}).`,
        fieldPath: "tiktok.budgetAmountMinor",
      });
    }
  }

  // ── Ad Group ──
  const ag = tt.adGroup;
  if (!ag?.name?.trim()) {
    issues.push({ code: "TT_ADGROUP_NAME", severity: "blocking", message: "Podaj nazwę grupy reklam TikTok.", fieldPath: "tiktok.adGroup.name" });
  }
  if (!ag?.optimizationGoal?.trim()) {
    issues.push({ code: "TT_OPT_GOAL", severity: "blocking", message: "Wybierz cel optymalizacji grupy reklam.", fieldPath: "tiktok.adGroup.optimizationGoal" });
  }
  if (!tt.targeting?.locations?.length) {
    issues.push({ code: "TT_LOCATION", severity: "blocking", message: "Wybierz przynajmniej jedną lokalizację (targetowanie).", fieldPath: "tiktok.targeting.locations" });
  }
  if (!ag?.budgetAmountMinor || ag.budgetAmountMinor <= 0) {
    issues.push({ code: "TT_ADGROUP_BUDGET", severity: "blocking", message: "Podaj budżet grupy reklam TikTok.", fieldPath: "tiktok.adGroup.budgetAmountMinor" });
  } else if (ag.budgetMode === "daily" && ag.budgetAmountMinor < TIKTOK_MIN_ADGROUP_DAILY_MINOR) {
    issues.push({
      code: "TT_ADGROUP_BUDGET_MIN",
      severity: "blocking",
      message: `Budżet dzienny grupy reklam jest poniżej minimum (${(TIKTOK_MIN_ADGROUP_DAILY_MINOR / 100).toFixed(0)}).`,
      fieldPath: "tiktok.adGroup.budgetAmountMinor",
    });
  }
  if (ag?.scheduleType === "specific_dates") {
    if (!ag.startAt) {
      issues.push({ code: "TT_START_DATE", severity: "blocking", message: "Podaj datę startu grupy reklam.", fieldPath: "tiktok.adGroup.startAt" });
    }
    if (ag.startAt && ag.endAt && new Date(ag.endAt).getTime() <= new Date(ag.startAt).getTime()) {
      issues.push({ code: "TT_DATE_ORDER", severity: "blocking", message: "Data zakończenia musi być późniejsza niż data startu.", fieldPath: "tiktok.adGroup.endAt" });
    }
  } else if (!ag?.startAt) {
    // ciągły harmonogram — start „od teraz" jest OK, brak błędu
  }

  const isConversion = tt.objective === "website_conversion" || tt.objective === "tiktok_shop";
  const isTraffic = tt.objective === "traffic";
  if (isConversion) {
    if (!ag?.pixelId) {
      issues.push({ code: "TT_PIXEL", severity: "blocking", message: "Kampania konwersji wymaga wyboru TikTok Pixela.", fieldPath: "tiktok.adGroup.pixelId" });
    }
    if (!ag?.conversionEvent) {
      issues.push({ code: "TT_CONV_EVENT", severity: "blocking", message: "Kampania konwersji wymaga wyboru zdarzenia konwersji.", fieldPath: "tiktok.adGroup.conversionEvent" });
    }
  }

  // ── Ad ──
  const ad = tt.ad;
  if (!ad?.name?.trim()) {
    issues.push({ code: "TT_AD_NAME", severity: "blocking", message: "Podaj nazwę reklamy TikTok.", fieldPath: "tiktok.ad.name" });
  }
  if (!ad?.creativeType) {
    issues.push({ code: "TT_CREATIVE_TYPE", severity: "blocking", message: "Wybierz typ kreacji reklamowej.", fieldPath: "tiktok.ad.creativeType" });
  }
  if (ad?.creativeType === "spark") {
    if (!ad.sparkPostUrl?.trim()) {
      issues.push({ code: "TT_SPARK", severity: "blocking", message: "Spark Ad wymaga linku/identyfikatora posta TikTok.", fieldPath: "tiktok.ad.sparkPostUrl" });
    }
  } else {
    const hasMedia = draft.structure.adSets[0]?.creatives[0]?.assetIds?.length;
    if (!hasMedia) {
      issues.push({ code: "TT_VIDEO", severity: "blocking", message: "Dodaj wideo/kreację z biblioteki dla reklamy TikTok.", fieldPath: "tiktok.ad" });
    }
  }
  if (!ad?.adText?.trim()) {
    issues.push({ code: "TT_AD_TEXT", severity: "blocking", message: "Dodaj tekst reklamy (caption).", fieldPath: "tiktok.ad.adText" });
  }
  if (!ad?.cta?.trim()) {
    issues.push({ code: "TT_CTA", severity: "blocking", message: "Wybierz przycisk akcji (CTA).", fieldPath: "tiktok.ad.cta" });
  }
  if (isTraffic || isConversion) {
    if (!ad?.destinationUrl?.trim()) {
      issues.push({ code: "TT_DEST_URL", severity: "blocking", message: "Podaj docelowy URL (wymagany dla Ruchu/Konwersji).", fieldPath: "tiktok.ad.destinationUrl" });
    } else if (!HTTPS_OK(ad.destinationUrl)) {
      issues.push({ code: "TT_DEST_URL_HTTPS", severity: "blocking", message: "Docelowy URL musi być poprawnym adresem https://.", fieldPath: "tiktok.ad.destinationUrl" });
    }
  } else if (ad?.destinationUrl?.trim() && !HTTPS_OK(ad.destinationUrl)) {
    issues.push({ code: "TT_DEST_URL_HTTPS", severity: "warning", message: "Docelowy URL powinien być adresem https://.", fieldPath: "tiktok.ad.destinationUrl" });
  }

  return issues;
}

/**
 * Walidacja przed uruchomieniem (preflight).
 * Błędy blocking blokują przycisk launch w UI; ostrzeżenia są widoczne, ale nie zatrzymują dry-run.
 */
export function runPreflightValidation(
  draft: CampaignComposerDraftPayload,
  ctx: {
    hasMetaPixelWhenRequired: boolean;
    hasLinkedInOrg: boolean;
  },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!draft.channel.adAccountId) {
    issues.push({
      code: "MISSING_AD_ACCOUNT",
      severity: "blocking",
      message: "Wybierz konto reklamowe powiązane z kanałem.",
      fieldPath: "channel.adAccountId",
    });
  }

  if (draft.channel.provider === "tiktok") {
    return [...issues, ...tiktokPreflight(draft)];
  }

  if (draft.channel.provider === "google") {
    return [...issues, ...googlePreflight(draft)];
  }

  if (draft.channel.provider === "meta") {
    if (!draft.meta) {
      issues.push({ code: "META_CONFIG", severity: "blocking", message: "Brak konfiguracji celu Meta.", fieldPath: "meta" });
    } else {
      const sac = draft.meta.specialAdCategory;
      if (sac && sac !== "NONE" && (!draft.meta.specialAdCategoryCountry || draft.meta.specialAdCategoryCountry.length === 0)) {
        issues.push({
          code: "SPECIAL_AD_CATEGORY_COUNTRY",
          severity: "blocking",
          message: "Kategoria reklam specjalnych wymaga co najmniej jednego kraju.",
          fieldPath: "meta.specialAdCategoryCountry",
        });
      }
    }
    if (draft.channel.metaPageId == null || draft.channel.metaPageId === "") {
      issues.push({
        code: "MISSING_PAGE",
        severity: "blocking",
        message: "Meta wymaga strony (Page) powiązanej z reklamą.",
        fieldPath: "channel.metaPageId",
      });
    }
    if (!ctx.hasMetaPixelWhenRequired) {
      issues.push({
        code: "PIXEL_OPTIONAL",
        severity: "warning",
        message: "Dla wybranego celu rozważ przypisanie piksela konwersji.",
        fieldPath: "channel.metaPixelId",
      });
    }
    for (const adset of draft.structure.adSets) {
      for (const cr of adset.creatives) {
        const needsMedia = cr.format === "single_image" || cr.format === "video" || cr.format === "carousel";
        if (needsMedia && cr.assetIds.length === 0) {
          issues.push({
            code: "META_MEDIA_REQUIRED",
            severity: "blocking",
            message: `Meta: dodaj grafikę lub wideo do reklamy „${adset.name}”.`,
            fieldPath: `structure.adSets.${adset.id}.creatives.${cr.id}.assetIds`,
          });
        }
      }
    }
  }

  if (draft.channel.provider === "linkedin") {
    if (!draft.linkedin) {
      issues.push({ code: "LI_CONFIG", severity: "blocking", message: "Brak konfiguracji LinkedIn.", fieldPath: "linkedin" });
    } else {
      if (draft.linkedin.objective === "WEBSITE_CONVERSION" && !draft.linkedin.conversionPixelUrn) {
        issues.push({
          code: "LI_CONVERSION_DEPENDENCY",
          severity: "blocking",
          message: "Kampanie konwersji wymagają mapowania piksela / konwersji.",
          fieldPath: "linkedin.conversionPixelUrn",
        });
      }
      const euTargeting =
        draft.structure.adSets.some((a) =>
          a.audience.geoInclude.some((g) => ["PL", "DE", "FR", "ES", "IT", "EU"].some((p) => g.includes(p))),
        ) || draft.structure.adSets.some((a) => a.audience.linkedinFacets.some((f) => f.facetUrn.includes("geo")));
      if (euTargeting && !draft.linkedin.politicalIntentEu) {
        issues.push({
          code: "EU_POLITICAL_HOOK",
          severity: "warning",
          message: "Targetowanie obejmujące UE: potwierdź zgodność z polityką reklam politycznych / zgody tam, gdzie wymagane.",
          fieldPath: "linkedin.politicalIntentEu",
        });
      }
      if (!draft.linkedin.complianceAcknowledged) {
        issues.push({
          code: "LI_COMPLIANCE",
          severity: "warning",
          message: "Zaakceptuj informacje zgodności LinkedIn przed publikacją produkcyjną.",
          fieldPath: "linkedin.complianceAcknowledged",
        });
      }
      if (!draft.linkedin.nonDiscriminationAcknowledged) {
        issues.push({
          code: "LI_NON_DISCRIMINATION",
          severity: "warning",
          message: "Wymagane potwierdzenie polityki niedyskryminacji LinkedIn.",
          fieldPath: "linkedin.nonDiscriminationAcknowledged",
        });
      }
    }
    if (!draft.structure.campaignGroup?.name?.trim()) {
      issues.push({
        code: "LI_CAMPAIGN_GROUP",
        severity: "blocking",
        message: "LinkedIn wymaga nazwy grupy kampanii (campaign group).",
        fieldPath: "structure.campaignGroup.name",
      });
    }
    if (!ctx.hasLinkedInOrg && (draft.channel.linkedinOrganizationUrn == null || draft.channel.linkedinOrganizationUrn === "")) {
      issues.push({
        code: "LI_ORG",
        severity: "blocking",
        message: "Wybierz organizację LinkedIn powiązaną z reklamą.",
        fieldPath: "channel.linkedinOrganizationUrn",
      });
    }
  }

  for (const adset of draft.structure.adSets) {
    for (const cr of adset.creatives) {
      if (!URL_OK(cr.destinationUrl)) {
        issues.push({
          code: "DESTINATION_URL",
          severity: "blocking",
          message: `Ad „${adset.name}”: podaj prawidłowy URL docelowy.`,
          fieldPath: `structure.adSets.${adset.id}.creatives.${cr.id}.destinationUrl`,
        });
      }
      if (!cr.primaryText?.trim() && !cr.headline?.trim()) {
        issues.push({
          code: "EMPTY_COPY",
          severity: "warning",
          message: `Ad „${adset.name}”: brak tekstu głównego lub nagłówka.`,
          fieldPath: `structure.adSets.${adset.id}.creatives.${cr.id}`,
        });
      }
      if (!cr.cta?.trim() && draft.channel.provider !== "meta") {
        issues.push({
          code: "CTA_MISSING",
          severity: "warning",
          message: `Ad „${adset.name}”: rozważ wybór CTA.`,
          fieldPath: `structure.adSets.${adset.id}.creatives.${cr.id}.cta`,
        });
      }
      const maxAssets = draft.channel.provider === "linkedin" ? 5 : 10;
      if (cr.assetIds.length > maxAssets) {
        issues.push({
          code: "ASSET_LIMIT",
          severity: "blocking",
          message: `Przekroczono limit assetów (${maxAssets}) dla jednostki reklamowej.`,
          fieldPath: `structure.adSets.${adset.id}.creatives.${cr.id}.assetIds`,
        });
      }
      if (cr.format === "carousel" && cr.assetIds.length < 2) {
        issues.push({
          code: "CAROUSEL_CARDS",
          severity: "blocking",
          message: "Karuzela wymaga co najmniej dwóch assetów.",
          fieldPath: `structure.adSets.${adset.id}.creatives.${cr.id}.assetIds`,
        });
      }
    }
  }

  return issues;
}

export function blockingCount(issues: ValidationIssue[]) {
  return issues.filter((i) => i.severity === "blocking").length;
}
