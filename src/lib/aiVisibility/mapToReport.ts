import { calculateVisibilityScore, getConfidenceFromQueryCount } from "@/lib/aiVisibility/calculateScore";
import { filterGenericRecommendations } from "@/lib/aiVisibility/filterRecommendations";
import { buildAiVisibilityExecutiveSummary, getVisibilityStatus } from "@/lib/aiVisibility/executiveSummary";
import { normalizeDomain, parseListInput } from "@/lib/aiVisibility/generateQueries";
import type {
  AiVisibilityCompetitorRow,
  AiVisibilityContentIdea,
  AiVisibilityDebugData,
  AiVisibilityMetrics,
  AiVisibilityQueryResult,
  AiVisibilityRecommendation,
  AiVisibilityReport,
  AnalysisContext,
  ReportLanguage,
  ReportStatus,
} from "@/lib/aiVisibility/types";
import { BLOCKED_REPORT_MESSAGE, validateAnalysisOutput } from "@/lib/aiVisibility/validateOutput";
import { validateAnalysisInput } from "@/lib/aiVisibility/validateInput";
import type { LlmVisibilityAnalysis } from "@/lib/llmVisibilityAnalysis";
import type { LlmVisibilityFormInput } from "@/lib/llmVisibilityRunAnalysis";

const URL_IN_TEXT_REGEX = /https?:\/\/[^\s)\]"']+/gi;

function bucketSentiment(s: string): "positive" | "neutral" | "negative" {
  const x = s.toLowerCase();
  if (x.includes("positive") || x.includes("pozytyw")) return "positive";
  if (x.includes("negative") || x.includes("negatyw")) return "negative";
  return "neutral";
}

function extractSourceUrls(comment: string): string[] {
  const urls = comment.match(URL_IN_TEXT_REGEX) ?? [];
  return [...new Set(urls.map((u) => u.replace(/[.,;]+$/, "")))];
}

function mapQueryRows(analysis: LlmVisibilityAnalysis): AiVisibilityQueryResult[] {
  const ext = analysis as LlmVisibilityAnalysis & {
    queryResults?: Array<AiVisibilityQueryResult & { sourceUrls?: string[] }>;
  };
  if (ext.queryResults?.length) {
    return ext.queryResults.map((r) => ({
      query: r.query,
      model: r.model || "ChatGPT",
      brandMentioned: Boolean(r.brandMentioned),
      brandPosition: r.brandPosition ?? null,
      competitorsMentioned: r.competitorsMentioned ?? [],
      sourceMentioned: Boolean(r.sourceMentioned),
      sourceUrls: r.sourceUrls?.length ? r.sourceUrls : extractSourceUrls(r.comment ?? ""),
      sentiment: bucketSentiment(r.sentiment),
      comment: r.comment ?? "",
    }));
  }

  return analysis.brandMentions.map((r) => ({
    query: r.query,
    model: r.aiModel || "ChatGPT",
    brandMentioned: r.appears,
    brandPosition: r.position ?? null,
    competitorsMentioned: [],
    sourceMentioned: Boolean(r.citations && r.citations > 0),
    sourceUrls: extractSourceUrls(r.comment ?? ""),
    sentiment: bucketSentiment(r.sentiment),
    comment: r.comment,
  }));
}

function computeMetrics(queries: AiVisibilityQueryResult[], scoring: ReturnType<typeof calculateVisibilityScore>): AiVisibilityMetrics {
  const total = queries.length;
  const brandMentions = queries.filter((q) => q.brandMentioned).length;
  const withSources = queries.filter((q) => q.brandMentioned && q.sourceMentioned).length;

  const sent = { positive: 0, neutral: 0, negative: 0 };
  for (const q of queries) {
    const b = bucketSentiment(q.sentiment);
    sent[b] += 1;
  }

  return {
    visibilityInQueries: scoring.brandMentionRate,
    brandMentions,
    totalQueries: total,
    mentionsWithSources: withSources,
    aiShareOfVoice: scoring.answerShare,
    sentiment: sent,
  };
}

function mapRecommendations(analysis: LlmVisibilityAnalysis): AiVisibilityRecommendation[] {
  const ext = analysis as LlmVisibilityAnalysis & { recommendations?: AiVisibilityRecommendation[] };
  if (ext.recommendations?.length) return ext.recommendations;

  return analysis.recommendedActions.map((a) => ({
    title: a.action.slice(0, 80),
    problem: a.reason,
    whyItMatters: a.reason,
    howToFix: a.action,
    priority: a.priority,
    difficulty: "medium",
    impact: a.expectedImpact,
    owner: "SEO",
  }));
}

function mapContentIdeas(analysis: LlmVisibilityAnalysis): AiVisibilityContentIdea[] {
  const ext = analysis as LlmVisibilityAnalysis & { contentIdeas?: AiVisibilityContentIdea[] };
  if (ext.contentIdeas?.length && "userIntent" in (ext.contentIdeas[0] as object)) {
    return ext.contentIdeas as AiVisibilityContentIdea[];
  }

  return analysis.contentIdeas.map((c) => ({
    title: c.title,
    userIntent: c.goal,
    targetQuery: c.targetQuery,
    format: c.type,
    whyItHelps: c.goal,
  }));
}

function mapCompetitors(analysis: LlmVisibilityAnalysis): AiVisibilityCompetitorRow[] {
  const ext = analysis as LlmVisibilityAnalysis & { competitorAnalysis?: AiVisibilityCompetitorRow[] };
  if (ext.competitorAnalysis?.length) return ext.competitorAnalysis;

  return analysis.competitors.map((c) => ({
    competitor: c.name,
    mentions: c.mentions ?? 0,
    shareOfVoice: c.visibilityScore ?? 0,
    strengths: c.advantage ? [c.advantage] : [],
    contentGaps: [],
  }));
}

function mapThirtyDayPlan(analysis: LlmVisibilityAnalysis): AiVisibilityReport["thirtyDayPlan"] {
  const ext = analysis as LlmVisibilityAnalysis & {
    thirtyDayPlan?: AiVisibilityReport["thirtyDayPlan"];
  };
  if (ext.thirtyDayPlan) return ext.thirtyDayPlan;

  const actions = analysis.recommendedActions.slice(0, 12).map((a) => a.action);
  return {
    week1: actions.slice(0, 3),
    week2: actions.slice(3, 6),
    week3: actions.slice(6, 9),
    week4: actions.slice(9, 12),
  };
}

function buildAnalysisContext(form: LlmVisibilityFormInput, targetQueries: string[]): AnalysisContext {
  return {
    analyzedBrandName: form.brandName.trim(),
    analyzedBrandUrl: form.websiteUrl.trim(),
    analyzedCategory: form.industry.trim(),
    competitorUrls: parseListInput(form.competitors),
    userManualContent: [form.offerDescription, form.targetAudience].filter(Boolean).join("\n"),
    generatedQueries: targetQueries,
  };
}

function buildBlockedReport(params: {
  userId: string;
  form: LlmVisibilityFormInput;
  issues: import("@/lib/aiVisibility/validateInput").ValidationIssue[];
  targetQueries: string[];
  status?: ReportStatus;
  id?: string;
  createdAt?: string;
  debugData?: AiVisibilityDebugData | null;
}): AiVisibilityReport {
  const now = new Date().toISOString();
  const domain = normalizeDomain(params.form.websiteUrl);
  const emptyScoring = calculateVisibilityScore([]);
  const context = buildAnalysisContext(params.form, params.targetQueries);

  return {
    id: params.id ?? crypto.randomUUID(),
    userId: params.userId,
    createdAt: params.createdAt ?? now,
    updatedAt: now,
    status: params.status ?? "draft",
    domain,
    normalizedUrl: params.form.websiteUrl.trim(),
    brandName: params.form.brandName.trim(),
    industry: params.form.industry.trim(),
    offerDescription: params.form.offerDescription?.trim() ?? "",
    targetAudience: params.form.targetAudience.trim(),
    competitors: parseListInput(params.form.competitors),
    targetQueries: params.targetQueries,
    aiModels: parseListInput(params.form.aiModels ?? "ChatGPT, Gemini, Claude, Perplexity"),
    language: "pl",
    score: 0,
    statusLabel: "Raport zablokowany",
    metrics: computeMetrics([], emptyScoring),
    summary: BLOCKED_REPORT_MESSAGE,
    executiveSummary: BLOCKED_REPORT_MESSAGE,
    confidence: {
      level: "niska pewność analizy",
      rationale: "Analiza została przerwana z powodu błędów walidacji.",
    },
    limitations: params.issues.map((i) => i.message),
    topActions: [],
    findings: params.issues.map((i) => `[${i.code}] ${i.message}`),
    recommendations: [],
    contentIdeas: [],
    thirtyDayPlan: { week1: [], week2: [], week3: [], week4: [] },
    analyzedQueries: [],
    modelResults: [],
    competitorsAnalysis: [],
    rawJson: {
      visibilityScore: 0,
      summary: BLOCKED_REPORT_MESSAGE,
      brandMentions: [],
      missingQueries: [],
      competitors: [],
      recommendedActions: [],
      contentIdeas: [],
      promptTests: [],
      visibilityTrend: [],
    },
    formSnapshot: { ...params.form },
    blocked: true,
    blockReason: BLOCKED_REPORT_MESSAGE,
    validationIssues: params.issues,
    analysisContext: context,
    scoringBreakdown: emptyScoring,
    debugData: params.debugData ?? null,
    lowConfidenceAlert:
      "Ten raport ma niską pewność, ponieważ dane wejściowe były niepełne lub niespójne. Nie traktuj wyniku jako wiarygodnej oceny widoczności marki.",
  };
}

export function mapAnalysisToReport(params: {
  userId: string;
  form: LlmVisibilityFormInput;
  analysis: LlmVisibilityAnalysis;
  status?: ReportStatus;
  id?: string;
  createdAt?: string;
  language?: ReportLanguage;
  skipInputValidation?: boolean;
}): AiVisibilityReport {
  const now = new Date().toISOString();
  const domain = normalizeDomain(params.form.websiteUrl);
  const queries = mapQueryRows(params.analysis);
  const targetQueries =
    parseListInput(params.form.targetKeywords).length > 0
      ? parseListInput(params.form.targetKeywords)
      : queries.map((q) => q.query);

  const inputValidation = params.skipInputValidation
    ? { valid: true, issues: [], canContinueWithWarnings: false, normalizedDomain: domain, normalizedUrl: params.form.websiteUrl }
    : validateAnalysisInput(params.form);

  if (!inputValidation.valid) {
    return buildBlockedReport({
      userId: params.userId,
      form: params.form,
      issues: inputValidation.issues,
      targetQueries,
      status: params.status,
      id: params.id,
      createdAt: params.createdAt,
      debugData: {
        inputValidation: inputValidation.issues,
        outputValidation: [],
        scoringBreakdown: calculateVisibilityScore([]),
        detectedDomains: [],
        foreignDomains: [],
        rawResponses: null,
      },
    });
  }

  const outputValidation = validateAnalysisOutput(params.analysis, params.form, targetQueries.length);
  const allIssues = [...inputValidation.issues, ...outputValidation.issues];

  const scoring = calculateVisibilityScore(queries);
  const metrics = computeMetrics(queries, scoring);
  const score = scoring.weightedScore;

  if (outputValidation.shouldBlock) {
    return buildBlockedReport({
      userId: params.userId,
      form: params.form,
      issues: allIssues,
      targetQueries,
      status: params.status,
      id: params.id,
      createdAt: params.createdAt,
      debugData: {
        inputValidation: inputValidation.issues,
        outputValidation: outputValidation.issues,
        scoringBreakdown: scoring,
        detectedDomains: outputValidation.detectedDomains,
        foreignDomains: outputValidation.foreignDomains,
        rawResponses: params.analysis,
      },
    });
  }

  const confidenceInfo = getConfidenceFromQueryCount(targetQueries.length, false);
  const statusInfo = getVisibilityStatus(score);
  const competitors = parseListInput(params.form.competitors);
  const context = buildAnalysisContext(params.form, targetQueries);

  const filteredRecs = filterGenericRecommendations(mapRecommendations(params.analysis), queries);

  const executiveSummary = buildAiVisibilityExecutiveSummary({
    domain,
    brandName: params.form.brandName,
    score,
    metrics,
    industry: params.form.industry,
    executiveSummaryFromModel: (params.analysis as { executiveSummary?: string }).executiveSummary,
    blocked: false,
  });

  const lowConfidenceAlert = confidenceInfo.isLow
    ? "Ten raport ma niską pewność, ponieważ dane wejściowe były niepełne lub niespójne. Nie traktuj wyniku jako wiarygodnej oceny widoczności marki."
    : null;

  return {
    id: params.id ?? crypto.randomUUID(),
    userId: params.userId,
    createdAt: params.createdAt ?? now,
    updatedAt: now,
    status: params.status ?? "draft",
    domain,
    normalizedUrl: params.form.websiteUrl.trim(),
    brandName: params.form.brandName.trim(),
    industry: params.form.industry.trim(),
    offerDescription: params.form.offerDescription?.trim() ?? "",
    targetAudience: params.form.targetAudience.trim(),
    competitors,
    targetQueries,
    aiModels: parseListInput(params.form.aiModels ?? "ChatGPT, Gemini, Claude, Perplexity"),
    language: params.language ?? "pl",
    score,
    statusLabel: statusInfo.label,
    metrics,
    summary: params.analysis.summary,
    executiveSummary,
    confidence: {
      level: confidenceInfo.level,
      rationale: confidenceInfo.rationale,
    },
    limitations: (
      (params.analysis as { limitations?: unknown }).limitations as string[] | undefined
    )?.filter((x): x is string => typeof x === "string" && x.trim().length > 0) ?? [],
    topActions:
      (params.analysis as { topActions?: string[] }).topActions?.slice(0, 3) ??
      params.analysis.recommendedActions.slice(0, 3).map((a) => a.action),
    findings: params.analysis.missingQueries.map((m) => `${m.query}: ${m.reason}`),
    recommendations: filteredRecs,
    contentIdeas: mapContentIdeas(params.analysis),
    thirtyDayPlan: mapThirtyDayPlan(params.analysis),
    analyzedQueries: queries,
    modelResults: queries,
    competitorsAnalysis: mapCompetitors(params.analysis),
    rawJson: params.analysis,
    formSnapshot: { ...params.form },
    blocked: false,
    blockReason: null,
    validationIssues: allIssues.filter((i) => i.severity === "warning"),
    analysisContext: context,
    scoringBreakdown: scoring,
    debugData: {
      inputValidation: inputValidation.issues,
      outputValidation: outputValidation.issues,
      scoringBreakdown: scoring,
      detectedDomains: outputValidation.detectedDomains,
      foreignDomains: outputValidation.foreignDomains,
      rawResponses: params.analysis,
    },
    lowConfidenceAlert,
  };
}
