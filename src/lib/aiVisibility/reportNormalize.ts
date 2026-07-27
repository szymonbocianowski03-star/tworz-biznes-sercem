import { calculateVisibilityScore } from "@/lib/aiVisibility/calculateScore";
import type { AiVisibilityReport } from "@/lib/aiVisibility/types";

export function normalizeStoredReport(r: AiVisibilityReport): AiVisibilityReport {
  const queries = (r.analyzedQueries ?? []).map((q) => ({
    ...q,
    sourceUrls: q.sourceUrls ?? [],
    competitorsMentioned: q.competitorsMentioned ?? [],
  }));
  const scoring = r.scoringBreakdown ?? calculateVisibilityScore(queries);
  return {
    ...r,
    analyzedQueries: queries,
    modelResults: r.modelResults ?? queries,
    blocked: r.blocked ?? false,
    blockReason: r.blockReason ?? null,
    validationIssues: r.validationIssues ?? [],
    analysisContext: r.analysisContext ?? {
      analyzedBrandName: r.brandName,
      analyzedBrandUrl: r.normalizedUrl,
      analyzedCategory: r.industry,
      competitorUrls: r.competitors ?? [],
      userManualContent: "",
      generatedQueries: r.targetQueries ?? [],
    },
    scoringBreakdown: scoring,
    debugData: r.debugData ?? null,
    lowConfidenceAlert: r.lowConfidenceAlert ?? null,
  };
}

/** Lżejsza wersja do localStorage (unikamy QuotaExceededError). */
export function slimReportForLocalStorage(r: AiVisibilityReport): AiVisibilityReport {
  const { rawJson: _raw, ...rest } = r;
  return {
    ...rest,
    rawJson: {} as AiVisibilityReport["rawJson"],
    debugData: r.debugData ? { ...r.debugData, rawResponses: null } : null,
  };
}
