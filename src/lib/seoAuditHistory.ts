import type { SeoAuditAnalysis } from "@/lib/seoAuditAnalysis";

const STORAGE_PREFIX = "mn.seoAudit.history.v1";
const MAX_ENTRIES = 50;

export type SeoAuditHistoryEntry = {
  id: string;
  userId: string;
  url: string;
  normalizedUrl: string;
  targetKeywords: string;
  industry: string;
  overallScore: number;
  createdAt: string;
  analysis: SeoAuditAnalysis;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}.${userId}`;
}

function readAll(userId: string): SeoAuditHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const list = raw ? (JSON.parse(raw) as SeoAuditHistoryEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeAll(userId: string, list: SeoAuditHistoryEntry[]): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(list.slice(0, MAX_ENTRIES)));
}

export function resolveSeoHistoryUserId(authUserId: string | undefined): string {
  if (authUserId) return authUserId;
  if (typeof window === "undefined") return "guest-anonymous";
  const key = "mn.seoAudit.guestSession";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return `guest-${sessionId}`;
}

export function saveSeoAuditToHistory(params: {
  userId: string;
  url: string;
  normalizedUrl: string;
  targetKeywords: string;
  industry: string;
  analysis: SeoAuditAnalysis;
}): SeoAuditHistoryEntry {
  const now = new Date().toISOString();
  const entry: SeoAuditHistoryEntry = {
    id: crypto.randomUUID(),
    userId: params.userId,
    url: params.url,
    normalizedUrl: params.normalizedUrl,
    targetKeywords: params.targetKeywords,
    industry: params.industry,
    overallScore: params.analysis.overallScore,
    createdAt: now,
    analysis: params.analysis,
  };
  const list = readAll(params.userId).filter(
    (e) => !(e.normalizedUrl === params.normalizedUrl && Math.abs(new Date(e.createdAt).getTime() - Date.now()) < 60_000),
  );
  writeAll(params.userId, [entry, ...list]);
  return entry;
}

export function getSeoAuditHistory(userId: string): SeoAuditHistoryEntry[] {
  return readAll(userId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getSeoAuditHistoryEntry(userId: string, id: string): SeoAuditHistoryEntry | null {
  return readAll(userId).find((e) => e.id === id && e.userId === userId) ?? null;
}

export function deleteSeoAuditHistoryEntry(userId: string, id: string): void {
  writeAll(
    userId,
    readAll(userId).filter((e) => e.id !== id),
  );
}

export function clearSeoAuditHistory(userId: string): void {
  localStorage.removeItem(storageKey(userId));
}
