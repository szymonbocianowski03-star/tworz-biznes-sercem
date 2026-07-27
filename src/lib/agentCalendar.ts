export type CalMarker = { start: string; title: string; description?: string };

const CAL_PATTERN = /\[CAL:\s*([^\]|]+?)\s*\|\s*([^|\]]+?)(?:\s*\|\s*([^\]]*?))?\s*\]/i;

export function extractCalMarkers(content: string): CalMarker[] {
  const out: CalMarker[] = [];
  const re = new RegExp(CAL_PATTERN.source, "gi");
  for (const m of content.matchAll(re)) {
    const start = m[1]?.trim();
    const title = m[2]?.trim();
    if (!start || !title) continue;
    out.push({
      start,
      title,
      description: m[3]?.trim() || undefined,
    });
  }
  return out.slice(0, 10);
}

export function stripCalMarkers(content: string): string {
  return content
    .replace(new RegExp(CAL_PATTERN.source, "gi"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** ISO 8601 z offsetem (Google / Outlook Calendar API). */
export function normalizeCalDateTime(raw: string): string {
  let s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) s += ":00";
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return s;
  }
  const withSec = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s) ? s : s;
  const month = parseInt(withSec.slice(5, 7), 10);
  const offset = month >= 4 && month <= 10 ? "+02:00" : "+01:00";
  const d = new Date(`${withSec}${offset}`);
  if (Number.isNaN(d.getTime())) throw new Error(`Nieprawidłowa data: ${raw}`);
  return d.toISOString();
}

export function addMinutesIso(startIso: string, minutes = 30): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) throw new Error("Nieprawidłowa data końca");
  return new Date(d.getTime() + minutes * 60_000).toISOString();
}
