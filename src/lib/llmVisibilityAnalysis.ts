import { z } from "zod";

const arr = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(inner));

export const LlmVisibilityAnalysisSchema = z.object({
  executiveSummary: z.string().optional(),
  topActions: arr(z.string()).optional(),
  visibilityScore: z.coerce.number().min(0).max(100),
  confidence: z
    .object({
      level: z.string(),
      rationale: z.string().optional().default(""),
    })
    .optional(),
  limitations: arr(z.string()).optional(),
  summary: z.string(),
  queryResults: arr(
    z.object({
      query: z.string(),
      model: z.string(),
      brandMentioned: z.coerce.boolean(),
      brandPosition: z.coerce.number().int().min(0).optional().nullable(),
      competitorsMentioned: arr(z.string()),
      sourceMentioned: z.coerce.boolean(),
      sourceUrls: arr(z.string()).optional(),
      sentiment: z.string(),
      comment: z.string(),
    }),
  ).optional(),
  competitorAnalysis: arr(
    z.object({
      competitor: z.string(),
      mentions: z.coerce.number(),
      shareOfVoice: z.coerce.number(),
      strengths: arr(z.string()),
      contentGaps: arr(z.string()),
    }),
  ).optional(),
  recommendations: arr(
    z.object({
      title: z.string(),
      problem: z.string(),
      whyItMatters: z.string(),
      howToFix: z.string(),
      priority: z.string(),
      difficulty: z.string(),
      impact: z.string(),
      owner: z.string(),
    }),
  ).optional(),
  thirtyDayPlan: z
    .object({
      week1: arr(z.string()),
      week2: arr(z.string()),
      week3: arr(z.string()),
      week4: arr(z.string()),
    })
    .optional(),
  brandMentions: arr(
    z.object({
      query: z.string(),
      appears: z.coerce.boolean(),
      position: z.coerce.number().int().min(0).optional().nullable(),
      sentiment: z.string(),
      comment: z.string(),
      /** np. ChatGPT, Perplexity, Gemini, Google AI Mode */
      aiModel: z.string().optional(),
      /** Szacowana liczba cytowań / źródeł w odpowiedzi */
      citations: z.coerce.number().min(0).optional(),
      /** ISO lub czytelna data ostatniego „sprawdzenia” w symulacji */
      lastChecked: z.string().optional(),
    }),
  ),
  /** Opcjonalne metryki zbiorcze zwracane przez model */
  metrics: z
    .object({
      visibilityInQueries: z.coerce.number().min(0).max(100).optional(),
      brandMentions: z.coerce.number().min(0).optional(),
      totalQueries: z.coerce.number().min(0).optional(),
      mentionsWithSources: z.coerce.number().min(0).optional(),
      aiShareOfVoice: z.coerce.number().min(0).max(100).optional(),
      sentiment: z
        .object({
          positive: z.coerce.number(),
          neutral: z.coerce.number(),
          negative: z.coerce.number(),
        })
        .optional(),
      citationRate: z.coerce.number().min(0).max(100).optional(),
      shareOfVoicePercent: z.coerce.number().min(0).max(100).optional(),
      answeredPromptsPercent: z.coerce.number().min(0).max(100).optional(),
    })
    .optional(),
  /** Seria tygodniowa z analizy (model); brak klucza → pusta tablica */
  visibilityTrend: z
    .array(
      z.object({
        week: z.string(),
        score: z.coerce.number().min(0).max(100),
      }),
    )
    .optional()
    .default([]),
  missingQueries: arr(
    z.object({
      query: z.string(),
      reason: z.string(),
      recommendedAction: z.string(),
    }),
  ),
  competitors: arr(
    z.object({
      name: z.string(),
      visibilityScore: z.coerce.number().min(0).max(100).optional(),
      mentions: z.coerce.number().optional(),
      sentiment: z.string(),
      advantage: z.string(),
    }),
  ),
  recommendedActions: arr(
    z.object({
      priority: z.string(),
      action: z.string(),
      reason: z.string(),
      expectedImpact: z.string(),
    }),
  ),
  contentIdeas: arr(
    z.object({
      title: z.string(),
      type: z.string(),
      targetQuery: z.string(),
      goal: z.string(),
    }),
  ),
  promptTests: arr(
    z.object({
      userPrompt: z.string(),
      likelyAnswer: z.string(),
      brandInclusionChance: z.string(),
      howToImprove: z.string(),
    }),
  ),
});

export type LlmVisibilityAnalysis = z.infer<typeof LlmVisibilityAnalysisSchema>;

/** Wyciąga pierwszy obiekt JSON z odpowiedzi modelu (obsługa ```json ... ```). */
export function extractJsonObjectFromModelText(raw: string): string | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence ? fence[1] : trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

/**
 * Próbuje odzyskać obiekt JSON, gdy odpowiedź modelu została ucięta (limit tokenów):
 * domyka otwarty string, usuwa „wiszący” klucz/przecinek i dokleja brakujące `}`/`]`.
 */
export function repairTruncatedJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*)/i);
  const body = (fence ? fence[1] : trimmed).replace(/```\s*$/i, "");
  const start = body.indexOf("{");
  if (start === -1) return null;

  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }

  let frag = body.slice(start);
  if (inStr) frag += '"';
  frag = frag.replace(/\s+$/, "");
  // wiszący klucz bez wartości: ...,"key" lub ...,"key":
  frag = frag.replace(/,\s*"[^"]*"\s*:?\s*$/, "");
  // dwukropek bez wartości na końcu
  frag = frag.replace(/:\s*$/, ": null");
  // wiszący przecinek
  frag = frag.replace(/,\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) {
    frag += stack[i] === "{" ? "}" : "]";
  }
  return frag;
}

export function parseLlmVisibilityAnalysis(raw: string): { ok: true; data: LlmVisibilityAnalysis } | { ok: false } {
  const candidates: string[] = [];
  const direct = extractJsonObjectFromModelText(raw);
  if (direct) candidates.push(direct);
  const repaired = repairTruncatedJsonObject(raw);
  if (repaired && repaired !== direct) candidates.push(repaired);

  for (const jsonStr of candidates) {
    try {
      const parsed = JSON.parse(jsonStr) as unknown;
      const result = LlmVisibilityAnalysisSchema.safeParse(parsed);
      if (result.success) return { ok: true, data: result.data };
    } catch {
      /* spróbuj następnego kandydata */
    }
  }
  return { ok: false };
}
