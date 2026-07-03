const KEY = "mn.llmVisibility.trend.v1";
const MAX = 24;

export type LlmTrendPoint = { at: string; score: number; brandKey: string };

function normBrand(brand: string): string {
  return brand.trim().toLowerCase().slice(0, 64) || "default";
}

export function loadLlmVisibilityTrend(brandName: string): LlmTrendPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const all = (raw ? JSON.parse(raw) : []) as LlmTrendPoint[];
    if (!Array.isArray(all)) return [];
    const k = normBrand(brandName);
    return all.filter((p) => p.brandKey === k).slice(-MAX);
  } catch {
    return [];
  }
}

export function appendLlmVisibilityTrend(brandName: string, score: number): void {
  if (typeof window === "undefined") return;
  const brandKey = normBrand(brandName);
  const point: LlmTrendPoint = { at: new Date().toISOString(), score, brandKey };
  try {
    const raw = localStorage.getItem(KEY);
    const all = (raw ? JSON.parse(raw) : []) as LlmTrendPoint[];
    const list = Array.isArray(all) ? all : [];
    const next = [...list.filter((p) => !(p.brandKey === brandKey && p.at === point.at)), point].slice(-200);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
