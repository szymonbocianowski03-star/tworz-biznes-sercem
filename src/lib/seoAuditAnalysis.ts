import { z } from "zod";
import { completeSeoAudit, normalizeKeyProblemRow } from "@/lib/seoAuditComplete";

const arr = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(inner));

const priorityEnum = z.enum(["high", "medium", "low"]);
const difficultyEnum = z.enum(["easy", "medium", "hard"]);

const checklistItemSchema = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    title: z.string(),
    status: z.enum(["ok", "warn", "fail"]).optional(),
    detail: z.string().optional(),
    category: z.string().optional(),
  }),
]);

const quickWinItemSchema = z.union([
  z.string(),
  z.object({
    title: z.string(),
    impact: z.string().optional(),
    effort: z.string().optional(),
    action: z.string().optional(),
  }),
]);

export const SeoAuditAnalysisSchema = z.object({
  summary: z.string(),
  overallScore: z.coerce.number().min(0).max(100),
  scores: z.object({
    technical: z.coerce.number().min(0).max(100),
    onPage: z.coerce.number().min(0).max(100),
    content: z.coerce.number().min(0).max(100),
    authority: z.coerce.number().min(0).max(100),
  }),
  pageOverview: z.object({
    fetchedUrl: z.string().optional(),
    title: z.string(),
    metaDescription: z.string(),
    h1: z.string(),
    h1Count: z.coerce.number().int().min(0),
    h2Count: z.coerce.number().int().min(0),
    canonical: z.string().nullable().optional(),
    indexStatus: z.string(),
    schemaJsonLd: z.string(),
    wordCount: z.coerce.number().int().min(0),
  }),
  keyProblems: z.preprocess(
    (v) => {
      if (!Array.isArray(v)) return [];
      return v.map((item) => normalizeKeyProblemRow(item)).filter(Boolean);
    },
    z.array(
      z.object({
        problem: z.string(),
        whyItMatters: z.string(),
        howToFix: z.string(),
        priority: z.union([priorityEnum, z.string()]),
        difficulty: z.union([difficultyEnum, z.string()]),
        estimatedImpact: z.union([priorityEnum, z.string()]),
      }),
    ),
  ),
  quickWins: arr(quickWinItemSchema),
  checklist: arr(checklistItemSchema),
  tenQuickChanges: arr(z.string()),
  thirtyDayPlan: z.object({
    week1: arr(z.string()),
    week2: arr(z.string()),
    week3: arr(z.string()),
    week4: arr(z.string()),
  }),
  recommendations: z.object({
    seoSpecialist: arr(z.string()),
    contentMarketer: arr(z.string()),
    developer: arr(z.string()),
  }),
  agentBrief: z.string(),
});

export type SeoAuditAnalysis = z.infer<typeof SeoAuditAnalysisSchema>;
export type SeoChecklistItem = SeoAuditAnalysis["checklist"][number];
export type SeoQuickWinItem = SeoAuditAnalysis["quickWins"][number];

/** Mapuje starszy format API (seoScore, categoryScores…) na nowy. */
function normalizeLegacyPayload(raw: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof raw.seoScore !== "number" && typeof raw.overallScore !== "number") return null;
  if (raw.scores && typeof raw.scores === "object") return null;

  const cs = (raw.categoryScores ?? {}) as Record<string, unknown>;
  const snap = (raw.pageSnapshot ?? {}) as Record<string, unknown>;
  const plan = Array.isArray(raw.plan30Days) ? raw.plan30Days : [];

  const weekTasks = (i: number): string[] => {
    const w = plan[i] as { tasks?: unknown } | undefined;
    return Array.isArray(w?.tasks) ? w.tasks.map(String) : [];
  };

  return {
    summary: typeof raw.summary === "string" ? raw.summary : "",
    overallScore: raw.seoScore ?? raw.overallScore ?? 0,
    scores: {
      technical: cs.technical ?? 0,
      onPage: cs.onPage ?? 0,
      content: cs.content ?? 0,
      authority: cs.authority ?? 0,
    },
    pageOverview: {
      fetchedUrl: snap.fetchedUrl,
      title: snap.title ?? "",
      metaDescription: snap.metaDescription ?? "",
      h1: snap.h1 ?? "",
      h1Count: snap.h1Count ?? 0,
      h2Count: snap.h2Count ?? 0,
      canonical: snap.canonical ?? null,
      indexStatus: snap.hasRobotsNoindex ? "noindex (meta robots)" : "prawdopodobnie indeksowalna",
      schemaJsonLd: snap.hasSchema ? "wykryto JSON-LD" : "brak",
      wordCount: snap.wordCount ?? 0,
    },
    keyProblems: [],
    quickWins: Array.isArray(raw.quickWins) ? raw.quickWins : [],
    checklist: Array.isArray(raw.checklist) ? raw.checklist : [],
    tenQuickChanges: [],
    thirtyDayPlan: {
      week1: weekTasks(0),
      week2: weekTasks(1),
      week3: weekTasks(2),
      week4: weekTasks(3),
    },
    recommendations: { seoSpecialist: [], contentMarketer: [], developer: [] },
    agentBrief: "",
  };
}

export function extractJsonObjectFromModelText(raw: string): string | null {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence ? fence[1] : trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

export function parseSeoAuditAnalysis(raw: unknown): { ok: true; data: SeoAuditAnalysis } | { ok: false } {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    const jsonStr = extractJsonObjectFromModelText(raw);
    if (!jsonStr) return { ok: false };
    try {
      obj = JSON.parse(jsonStr);
    } catch {
      return { ok: false };
    }
  }

  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { ok: false };

  const record = obj as Record<string, unknown>;
  const normalized = normalizeLegacyPayload(record) ?? record;
  const parsed = SeoAuditAnalysisSchema.safeParse(normalized);
  if (parsed.success) return { ok: true, data: completeSeoAudit(parsed.data) };
  return { ok: false };
}

export function quickWinTitle(item: SeoQuickWinItem): string {
  return typeof item === "string" ? item : item.title;
}

export function quickWinAction(item: SeoQuickWinItem): string {
  if (typeof item === "string") return "";
  return item.action ?? "";
}

export function checklistTitle(item: SeoChecklistItem): string {
  return typeof item === "string" ? item : item.title;
}
