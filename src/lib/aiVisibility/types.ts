import type { ScoringBreakdown } from "@/lib/aiVisibility/calculateScore";
import type { ValidationIssue } from "@/lib/aiVisibility/validateInput";
import type { LlmVisibilityAnalysis } from "@/lib/llmVisibilityAnalysis";
import type { LlmVisibilityFormInput } from "@/lib/llmVisibilityRunAnalysis";

export type ReportLanguage = "pl" | "en" | "de";
export type ReportStatus = "saved" | "draft" | "archived";

export type AnalysisContext = {
  analyzedBrandName: string;
  analyzedBrandUrl: string;
  analyzedCategory: string;
  competitorUrls: string[];
  userManualContent: string;
  generatedQueries: string[];
};

export type AiVisibilityDebugData = {
  inputValidation: ValidationIssue[];
  outputValidation: ValidationIssue[];
  scoringBreakdown: ScoringBreakdown;
  detectedDomains: string[];
  foreignDomains: string[];
  rawResponses: unknown;
};

export type AiVisibilityMetrics = {
  visibilityInQueries: number;
  brandMentions: number;
  totalQueries: number;
  mentionsWithSources: number;
  aiShareOfVoice: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
};

export type AiVisibilityQueryResult = {
  query: string;
  model: string;
  brandMentioned: boolean;
  brandPosition: number | null;
  competitorsMentioned: string[];
  sourceMentioned: boolean;
  sourceUrls: string[];
  sentiment: "positive" | "neutral" | "negative" | string;
  comment: string;
};

export type AiVisibilityCompetitorRow = {
  competitor: string;
  mentions: number;
  shareOfVoice: number;
  strengths: string[];
  contentGaps: string[];
};

export type AiVisibilityRecommendation = {
  title: string;
  problem: string;
  whyItMatters: string;
  howToFix: string;
  priority: string;
  difficulty: string;
  impact: string;
  owner: string;
  basedOnQueries?: string[];
};

export type AiVisibilityContentIdea = {
  title: string;
  userIntent: string;
  targetQuery: string;
  format: string;
  whyItHelps: string;
};

export type AiVisibilityReport = {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  status: ReportStatus;
  domain: string;
  normalizedUrl: string;
  brandName: string;
  industry: string;
  offerDescription: string;
  targetAudience: string;
  competitors: string[];
  targetQueries: string[];
  aiModels: string[];
  language: ReportLanguage;
  score: number;
  statusLabel: string;
  metrics: AiVisibilityMetrics;
  summary: string;
  executiveSummary: string;
  confidence: { level: string; rationale: string } | null;
  limitations: string[];
  topActions: string[];
  findings: string[];
  recommendations: AiVisibilityRecommendation[];
  contentIdeas: AiVisibilityContentIdea[];
  thirtyDayPlan: {
    week1: string[];
    week2: string[];
    week3: string[];
    week4: string[];
  };
  analyzedQueries: AiVisibilityQueryResult[];
  modelResults: AiVisibilityQueryResult[];
  competitorsAnalysis: AiVisibilityCompetitorRow[];
  rawJson: LlmVisibilityAnalysis;
  formSnapshot: LlmVisibilityFormInput;
  blocked: boolean;
  blockReason: string | null;
  validationIssues: ValidationIssue[];
  analysisContext: AnalysisContext;
  scoringBreakdown: ScoringBreakdown;
  debugData: AiVisibilityDebugData | null;
  lowConfidenceAlert: string | null;
};

export type ReportCompareResult = {
  reportA: AiVisibilityReport;
  reportB: AiVisibilityReport;
  scoreDelta: number;
  scoreDeltaPct: number;
  metricsDelta: {
    visibilityInQueries: number;
    mentionsWithSources: number;
    aiShareOfVoice: number;
  };
  newQueriesWithBrand: string[];
  lostQueries: string[];
  stillRelevantRecommendations: AiVisibilityRecommendation[];
  newRecommendations: AiVisibilityRecommendation[];
};
