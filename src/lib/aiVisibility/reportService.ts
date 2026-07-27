import { calculateVisibilityScore } from "@/lib/aiVisibility/calculateScore";
import { mapAnalysisToReport } from "@/lib/aiVisibility/mapToReport";
import { normalizeStoredReport, slimReportForLocalStorage } from "@/lib/aiVisibility/reportNormalize";
import {
  deleteCloudReport,
  fetchCloudReports,
  upsertCloudReport,
} from "@/lib/aiVisibility/reportServiceCloud";
import { supabase } from "@/integrations/supabase/client";
import type { AiVisibilityReport, ReportCompareResult } from "@/lib/aiVisibility/types";

const STORAGE_PREFIX = "mn.aiVisibility.reports.v2";
const DRAFT_SUFFIX = ".draft";
const GUEST_SESSION_KEY = "mn.aiVisibility.guestSession";

/** Izolacja raportów gościa per sesja przeglądarki (nie wspólny klucz „guest”). */
export function resolveAiVisibilityUserId(authUserId: string | undefined): string {
  if (authUserId) return authUserId;
  if (typeof window === "undefined") return "guest-anonymous";
  let sessionId = sessionStorage.getItem(GUEST_SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(GUEST_SESSION_KEY, sessionId);
  }
  return `guest-${sessionId}`;
}

/** Sesja Supabase ma pierwszeństwo — React `user` bywa chwilowo null mimo aktywnego logowania. */
export async function resolveAiVisibilityUserIdAsync(authUserId: string | undefined): Promise<string> {
  if (authUserId) return authUserId;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch {
    /* ignore */
  }
  return resolveAiVisibilityUserId(undefined);
}

export function isGuestAiVisibilityUser(userId: string): boolean {
  return userId.startsWith("guest-") || userId === "guest-anonymous";
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}.${userId}`;
}

function draftKey(userId: string): string {
  return `${STORAGE_PREFIX}${DRAFT_SUFFIX}.${userId}`;
}

function readAllLocal(userId: string): AiVisibilityReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const list = raw ? (JSON.parse(raw) as AiVisibilityReport[]) : [];
    return Array.isArray(list) ? list.map(normalizeStoredReport) : [];
  } catch {
    return [];
  }
}

function writeAllLocal(userId: string, list: AiVisibilityReport[]): void {
  const trimmed = list.slice(0, 100).map(normalizeStoredReport);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(trimmed));
  } catch {
    try {
      localStorage.setItem(
        storageKey(userId),
        JSON.stringify(trimmed.map(slimReportForLocalStorage)),
      );
    } catch (e) {
      console.error("aiVisibility writeAllLocal failed", userId, e);
      throw new Error("Nie udało się zapisać raportu w przeglądarce (brak miejsca).");
    }
  }
}

function mergeReportsById(primary: AiVisibilityReport[], secondary: AiVisibilityReport[]): AiVisibilityReport[] {
  const map = new Map<string, AiVisibilityReport>();
  for (const r of secondary) map.set(r.id, r);
  for (const r of primary) map.set(r.id, r);
  return [...map.values()];
}

function assertOwner(report: AiVisibilityReport | undefined, userId: string): AiVisibilityReport {
  if (!report) throw new Error("Raport nie istnieje.");
  if (report.userId !== userId) throw new Error("Brak dostępu do tego raportu.");
  return report;
}

export async function migrateGuestReportsToUser(guestUserId: string, authUserId: string): Promise<void> {
  if (!guestUserId.startsWith("guest-") || isGuestAiVisibilityUser(authUserId)) return;
  const guestReports = readAllLocal(guestUserId);
  if (guestReports.length === 0) return;

  const existing = readAllLocal(authUserId);
  if (existing.length > 0) {
    localStorage.removeItem(storageKey(guestUserId));
    return;
  }

  for (const r of guestReports) {
    await createReport(authUserId, { ...r, status: "saved" });
  }
  localStorage.removeItem(storageKey(guestUserId));
}

export async function createReport(
  userId: string,
  reportData: Omit<AiVisibilityReport, "id" | "userId" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<{ report: AiVisibilityReport; cloudOk: boolean; error?: string }> {
  const now = new Date().toISOString();
  const preservedCreatedAt = (reportData as { createdAt?: string }).createdAt;
  const report: AiVisibilityReport = normalizeStoredReport({
    ...reportData,
    id: reportData.id ?? crypto.randomUUID(),
    userId,
    createdAt: preservedCreatedAt ?? now,
    updatedAt: now,
    status: reportData.status ?? "saved",
  } as AiVisibilityReport);

  let cloudOk = false;
  let cloudError: string | undefined;

  if (!isGuestAiVisibilityUser(userId)) {
    const cloud = await upsertCloudReport(userId, report);
    cloudOk = cloud.ok;
    cloudError = cloud.error;
  }

  const list = readAllLocal(userId).filter((r) => r.id !== report.id);
  try {
    writeAllLocal(userId, [report, ...list]);
  } catch (e) {
    const slim = slimReportForLocalStorage(report);
    writeAllLocal(userId, [slim, ...list.filter((r) => r.id !== slim.id)]);
    return {
      report: slim,
      cloudOk,
      error: cloudError ?? (e instanceof Error ? e.message : "Zapis lokalny nieudany"),
    };
  }
  clearDraft(userId);

  return { report, cloudOk, error: cloudError };
}

export async function getReportsByUser(userId: string): Promise<AiVisibilityReport[]> {
  const local = readAllLocal(userId);

  if (!isGuestAiVisibilityUser(userId)) {
    const cloud = await fetchCloudReports(userId);
    if (cloud.ok) {
      const merged = mergeReportsById(cloud.reports, local);
      writeAllLocal(userId, merged);
      return merged.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
  }

  return local.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getReportById(userId: string, reportId: string): AiVisibilityReport | null {
  const found = readAllLocal(userId).find((r) => r.id === reportId);
  return found ? assertOwner(found, userId) : null;
}

export async function deleteReport(userId: string, reportId: string): Promise<void> {
  if (!isGuestAiVisibilityUser(userId)) {
    await deleteCloudReport(userId, reportId);
  }
  const list = readAllLocal(userId).filter((r) => r.id !== reportId);
  writeAllLocal(userId, list);
}

export function updateReport(
  userId: string,
  reportId: string,
  updates: Partial<AiVisibilityReport>,
): AiVisibilityReport {
  const list = readAllLocal(userId);
  const idx = list.findIndex((r) => r.id === reportId);
  if (idx === -1) throw new Error("Raport nie istnieje.");
  assertOwner(list[idx], userId);
  const next = {
    ...list[idx],
    ...updates,
    id: list[idx].id,
    userId,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = next;
  writeAllLocal(userId, list);
  return next;
}

export function saveDraft(userId: string, report: AiVisibilityReport): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      draftKey(userId),
      JSON.stringify({
        ...report,
        userId,
        status: "draft" as const,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    localStorage.setItem(
      draftKey(userId),
      JSON.stringify(slimReportForLocalStorage({
        ...report,
        userId,
        status: "draft" as const,
        updatedAt: new Date().toISOString(),
      })),
    );
  }
}

export function loadDraft(userId: string, expectedDomain?: string): AiVisibilityReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const d = normalizeStoredReport(JSON.parse(raw) as AiVisibilityReport);
    if (d.userId !== userId) return null;
    if (expectedDomain && d.domain.toLowerCase() !== expectedDomain.toLowerCase()) return null;
    return d;
  } catch {
    return null;
  }
}

export function clearDraft(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(draftKey(userId));
}

export function getPreviousReportForDomain(
  userId: string,
  domain: string,
  excludeId?: string,
): AiVisibilityReport | null {
  const normalized = domain.toLowerCase();
  return (
    readAllLocal(userId).find(
      (r) => r.status === "saved" && r.domain.toLowerCase() === normalized && r.id !== excludeId,
    ) ?? null
  );
}

export function compareReports(
  userId: string,
  reportIdA: string,
  reportIdB: string,
): ReportCompareResult {
  const a = getReportById(userId, reportIdA);
  const b = getReportById(userId, reportIdB);
  if (!a || !b) throw new Error("Nie znaleziono raportów do porównania.");
  if (a.domain.toLowerCase() !== b.domain.toLowerCase()) {
    throw new Error("Porównanie możliwe tylko dla tej samej domeny.");
  }

  const older = new Date(a.createdAt) < new Date(b.createdAt) ? a : b;
  const newer = older.id === a.id ? b : a;

  const scoreDelta = newer.score - older.score;
  const scoreDeltaPct = older.score > 0 ? Math.round((scoreDelta / older.score) * 100) : scoreDelta > 0 ? 100 : 0;

  const olderQueries = new Set(older.analyzedQueries.filter((q) => q.brandMentioned).map((q) => q.query));
  const newerQueries = new Set(newer.analyzedQueries.filter((q) => q.brandMentioned).map((q) => q.query));

  const newQueriesWithBrand = [...newerQueries].filter((q) => !olderQueries.has(q));
  const lostQueries = [...olderQueries].filter((q) => !newerQueries.has(q));

  const olderRecTitles = new Set(older.recommendations.map((r) => r.title.toLowerCase()));
  const stillRelevant = newer.recommendations.filter((r) => olderRecTitles.has(r.title.toLowerCase()));
  const newRecommendations = newer.recommendations.filter((r) => !olderRecTitles.has(r.title.toLowerCase()));

  return {
    reportA: older,
    reportB: newer,
    scoreDelta,
    scoreDeltaPct,
    metricsDelta: {
      visibilityInQueries: newer.metrics.visibilityInQueries - older.metrics.visibilityInQueries,
      mentionsWithSources: newer.metrics.mentionsWithSources - older.metrics.mentionsWithSources,
      aiShareOfVoice: newer.metrics.aiShareOfVoice - older.metrics.aiShareOfVoice,
    },
    newQueriesWithBrand,
    lostQueries,
    stillRelevantRecommendations: stillRelevant,
    newRecommendations,
  };
}

/** Migracja starych zapisów mn.llmVisibility.saved.v1 — tylko dla zalogowanych użytkowników. */
export async function migrateLegacySavedReports(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (isGuestAiVisibilityUser(userId)) return;
  try {
    const legacyKey = `mn.llmVisibility.saved.v1.${userId}`;
    const raw = localStorage.getItem(legacyKey) ?? localStorage.getItem("mn.llmVisibility.saved.v1");
    if (!raw) return;
    const legacy = JSON.parse(raw) as Array<{
      id: string;
      savedAt: string;
      label: string;
      form: import("@/lib/llmVisibilityRunAnalysis").LlmVisibilityFormInput;
      analysis: import("@/lib/llmVisibilityAnalysis").LlmVisibilityAnalysis;
    }>;
    if (!Array.isArray(legacy) || legacy.length === 0) return;
    const existing = readAllLocal(userId);
    if (existing.length > 0) return;

    for (const item of legacy.slice(0, 30)) {
      const report = mapAnalysisToReport({
        userId,
        form: item.form,
        analysis: item.analysis,
        status: "saved",
        id: item.id,
        createdAt: item.savedAt,
        skipInputValidation: true,
      });
      await createReport(userId, report);
    }
    localStorage.removeItem(legacyKey);
    localStorage.removeItem("mn.llmVisibility.saved.v1");
  } catch {
    /* ignore */
  }
}
