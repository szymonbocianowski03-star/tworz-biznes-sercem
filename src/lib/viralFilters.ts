import type { ViralShortItem } from "@/components/ViralShortCard";

export type ViralMediaType = "video" | "image" | "carousel";

export type ViralSortBy = "relevance" | "views" | "likes" | "engagement" | "recent";

export type ViralSearchFilters = {
  mediaTypes: ViralMediaType[];
  minViews: number | null;
  maxViews: number | null;
  minLikes: number | null;
  maxLikes: number | null;
  /** Film musi mieć co najmniej tyle dni (starszy content). */
  minAgeDays: number | null;
  /** Film nie starszy niż X dni. */
  maxAgeDays: number | null;
  minDurationSec: number | null;
  maxDurationSec: number | null;
  minCaptionLen: number | null;
  maxCaptionLen: number | null;
  captionKeyword: string;
  sortBy: ViralSortBy;
};

export const DEFAULT_VIRAL_FILTERS: ViralSearchFilters = {
  mediaTypes: [],
  minViews: null,
  maxViews: null,
  minLikes: null,
  maxLikes: null,
  minAgeDays: null,
  maxAgeDays: null,
  minDurationSec: null,
  maxDurationSec: null,
  minCaptionLen: null,
  maxCaptionLen: null,
  captionKeyword: "",
  sortBy: "relevance",
};

export function engagementRate(item: ViralShortItem): number {
  const v = item.views || 0;
  if (v <= 0) return item.likes > 0 ? 1 : 0;
  return (item.likes || 0) / v;
}

export function isViralWinner(item: ViralShortItem): boolean {
  const views = item.views || 0;
  const likes = item.likes || 0;
  const rate = engagementRate(item);
  return views >= 10_000 && (likes >= 500 || rate >= 0.04);
}

function itemAgeDays(item: ViralShortItem): number | null {
  if (!item.createdAt) return null;
  const t = Date.parse(item.createdAt);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function matchesMediaType(item: ViralShortItem, types: ViralMediaType[]): boolean {
  if (types.length === 0) return true;
  const mt = item.mediaType ?? "unknown";
  if (mt === "unknown") {
    if (item.scraped?.mediaType === false) return true;
    return types.includes("video");
  }
  return types.includes(mt);
}

export function applyViralFilters(
  items: ViralShortItem[],
  filters: ViralSearchFilters,
  opts?: { winnersOnly?: boolean; searchQuery?: string },
): ViralShortItem[] {
  const q = (opts?.searchQuery ?? filters.captionKeyword).trim().toLowerCase();
  const kw = filters.captionKeyword.trim().toLowerCase();

  let out = items.filter((item) => {
    if (opts?.winnersOnly && !isViralWinner(item)) return false;

    if (!matchesMediaType(item, filters.mediaTypes)) return false;

    const views = item.views || 0;
    const likes = item.likes || 0;
    if (filters.minViews != null && views < filters.minViews) return false;
    if (filters.maxViews != null && views > filters.maxViews) return false;
    if (filters.minLikes != null && likes < filters.minLikes) return false;
    if (filters.maxLikes != null && likes > filters.maxLikes) return false;

    const cap = (item.title || "").length;
    if (filters.minCaptionLen != null && cap < filters.minCaptionLen) return false;
    if (filters.maxCaptionLen != null && cap > filters.maxCaptionLen) return false;

    const dur = item.durationSec;
    if (filters.minDurationSec != null) {
      if (dur == null) {
        if (item.scraped?.duration === false) return true;
        return false;
      }
      if (dur < filters.minDurationSec) return false;
    }
    if (filters.maxDurationSec != null) {
      if (dur == null) {
        if (item.scraped?.duration === false) return true;
        return false;
      }
      if (dur > filters.maxDurationSec) return false;
    }

    const age = itemAgeDays(item);
    if (filters.minAgeDays != null) {
      if (age == null) {
        if (item.scraped?.createdAt === false) return true;
        return false;
      }
      if (age < filters.minAgeDays) return false;
    }
    if (filters.maxAgeDays != null) {
      if (age == null) {
        if (item.scraped?.createdAt === false) return true;
        return false;
      }
      if (age > filters.maxAgeDays) return false;
    }

    if (kw) {
      const hay = `${item.title} ${item.author}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }

    if (q && !kw) {
      const hay = `${item.title} ${item.author}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  out = sortViralItems(out, filters.sortBy);
  return out;
}

export function sortViralItems(items: ViralShortItem[], sortBy: ViralSortBy): ViralShortItem[] {
  const copy = [...items];
  switch (sortBy) {
    case "views":
      return copy.sort((a, b) => (b.views || 0) - (a.views || 0));
    case "likes":
      return copy.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    case "engagement":
      return copy.sort((a, b) => engagementRate(b) - engagementRate(a));
    case "recent":
      return copy.sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });
    default:
      return copy;
  }
}

export type ActiveFilterTag = { key: string; label: string };

export function getActiveFilterTags(filters: ViralSearchFilters): ActiveFilterTag[] {
  const tags: ActiveFilterTag[] = [];
  if (filters.mediaTypes.length > 0) {
    const labels = { video: "Wideo", image: "Obraz", carousel: "Karuzela" };
    tags.push({
      key: "media",
      label: filters.mediaTypes.map((m) => labels[m]).join(", "),
    });
  }
  if (filters.minViews != null) tags.push({ key: "minViews", label: `Min. ${formatNum(filters.minViews)} wyśw.` });
  if (filters.maxViews != null) tags.push({ key: "maxViews", label: `Max. ${formatNum(filters.maxViews)} wyśw.` });
  if (filters.minLikes != null) tags.push({ key: "minLikes", label: `Min. ${formatNum(filters.minLikes)} polub.` });
  if (filters.maxLikes != null) tags.push({ key: "maxLikes", label: `Max. ${formatNum(filters.maxLikes)} polub.` });
  if (filters.minAgeDays != null) tags.push({ key: "minAge", label: `Min. ${filters.minAgeDays} dni` });
  if (filters.maxAgeDays != null) tags.push({ key: "maxAge", label: `Max. ${filters.maxAgeDays} dni` });
  if (filters.minDurationSec != null) tags.push({ key: "minDur", label: `Min. ${filters.minDurationSec}s` });
  if (filters.maxDurationSec != null) tags.push({ key: "maxDur", label: `Max. ${filters.maxDurationSec}s` });
  if (filters.minCaptionLen != null) tags.push({ key: "minCap", label: `Opis min. ${filters.minCaptionLen} zn.` });
  if (filters.maxCaptionLen != null) tags.push({ key: "maxCap", label: `Opis max. ${filters.maxCaptionLen} zn.` });
  if (filters.captionKeyword.trim()) {
    tags.push({ key: "kw", label: `„${filters.captionKeyword.trim().slice(0, 28)}${filters.captionKeyword.length > 28 ? "…" : ""}"` });
  }
  return tags;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function clearFilterKey(filters: ViralSearchFilters, key: string): ViralSearchFilters {
  const next = { ...filters };
  switch (key) {
    case "media":
      next.mediaTypes = [];
      break;
    case "minViews":
      next.minViews = null;
      break;
    case "maxViews":
      next.maxViews = null;
      break;
    case "minLikes":
      next.minLikes = null;
      break;
    case "maxLikes":
      next.maxLikes = null;
      break;
    case "minAge":
      next.minAgeDays = null;
      break;
    case "maxAge":
      next.maxAgeDays = null;
      break;
    case "minDur":
      next.minDurationSec = null;
      break;
    case "maxDur":
      next.maxDurationSec = null;
      break;
    case "minCap":
      next.minCaptionLen = null;
      break;
    case "maxCap":
      next.maxCaptionLen = null;
      break;
    case "kw":
      next.captionKeyword = "";
      break;
  }
  return next;
}

export function hasActiveFilters(filters: ViralSearchFilters): boolean {
  return getActiveFilterTags(filters).length > 0 || filters.sortBy !== "relevance";
}
