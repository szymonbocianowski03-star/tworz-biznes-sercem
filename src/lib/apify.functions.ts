import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ViralMediaType, ViralScrapedMeta, ViralShortItem } from "@/components/ViralShortCard";

const ACTORS = {
  tiktok: "clockworks~tiktok-scraper",
  /** Bogatsze pola: type, videoDuration, videoPlayCount, timestamp, childPosts */
  instagram: "apify~instagram-hashtag-scraper",
  youtube: "streamers~youtube-scraper",
} as const;

type Platform = keyof typeof ACTORS;

const InputSchema = z.object({
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  query: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(30).default(30),
});

/** Odczyt zagnieżdżony lub spłaszczony klucz (np. `videoMeta.duration`). */
function pick(raw: Record<string, unknown>, ...paths: string[]): unknown {
  for (const path of paths) {
    if (path in raw && raw[path] != null && raw[path] !== "") return raw[path];
    const parts = path.split(".");
    let cur: unknown = raw;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[p];
    }
    if (cur != null && cur !== "") return cur;
  }
  return undefined;
}

function toIsoDate(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number") {
    const ms = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

function parseDurationSec(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number" && raw > 0) return Math.round(raw);
  if (typeof raw === "string") {
    const t = raw.trim();
    if (/^\d+$/.test(t)) return Number(t);
    const iso = t.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
    if (iso) {
      const h = Number(iso[1] || 0);
      const min = Number(iso[2] || 0);
      const s = Number(iso[3] || 0);
      const total = h * 3600 + min * 60 + s;
      return total > 0 ? total : undefined;
    }
    if (t.includes(":")) {
      const parts = t.split(":").map((x) => Number(x.trim()));
      if (parts.every((n) => !Number.isNaN(n))) {
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
      }
    }
  }
  return undefined;
}

function toCount(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function buildActorInput(platform: Platform, query: string, limit: number): Record<string, unknown> {
  const tag = query.replace(/^#/, "").trim();
  if (platform === "tiktok") {
    return {
      hashtags: [tag],
      resultsPerPage: limit,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSlideshowImages: false,
      shouldDownloadSubtitles: false,
      shouldDownloadAvatars: false,
      shouldDownloadMusicCovers: false,
    };
  }
  if (platform === "instagram") {
    return {
      hashtags: [tag],
      resultsLimit: limit,
    };
  }
  return {
    searchKeywords: query.trim(),
    maxResults: 0,
    maxResultsShorts: limit,
    maxResultStreams: 0,
    downloadSubtitles: false,
  };
}

function inferInstagramMediaType(r: Record<string, unknown>): ViralMediaType {
  const type = String(pick(r, "type", "productType") ?? "").toLowerCase();
  const childPosts = pick(r, "childPosts", "children");
  const hasChildren = Array.isArray(childPosts) && childPosts.length > 0;
  const videoUrl = pick(r, "videoUrl", "video_url");

  if (type.includes("sidecar") || type === "carousel" || hasChildren) return "carousel";
  if (type.includes("video") || type === "clips" || type === "reels" || videoUrl) return "video";
  if (type.includes("image") || type === "photo") return "image";
  if (videoUrl) return "video";
  return "unknown";
}

function normalizeTikTok(r: Record<string, unknown>): ViralShortItem {
  const views = toCount(pick(r, "playCount", "play_count", "stats.playCount"));
  const likes = toCount(pick(r, "diggCount", "digg_count", "stats.diggCount"));
  const comments = toCount(pick(r, "commentCount", "comment_count", "stats.commentCount"));
  const shares = toCount(pick(r, "shareCount", "share_count", "stats.shareCount"));
  const durationSec = parseDurationSec(
    pick(r, "videoMeta.duration", "videoMeta.durationSec", "duration", "video.duration"),
  );
  const createdAt = toIsoDate(pick(r, "createTimeISO", "createTime", "create_time"));

  const scraped: ViralScrapedMeta = {
    views: views > 0,
    likes: likes > 0,
    duration: durationSec != null,
    createdAt: createdAt != null,
    mediaType: true,
    comments: comments > 0,
  };

  return {
    title: String(pick(r, "text", "desc", "description") ?? ""),
    author: String(
      pick(r, "authorMeta.name", "authorMeta.nickName", "authorMeta.nickname", "author", "authorName") ?? "",
    ),
    url: String(pick(r, "webVideoUrl", "videoUrl", "url") ?? ""),
    thumbnail: String(
      pick(r, "videoMeta.coverUrl", "videoMeta.cover", "covers.0", "coverUrl", "thumbnail") ?? "",
    ),
    views,
    likes,
    comments: comments || undefined,
    shares: shares || undefined,
    durationSec,
    createdAt,
    mediaType: "video",
    scraped,
  };
}

function normalizeInstagram(r: Record<string, unknown>): ViralShortItem {
  const mediaType = inferInstagramMediaType(r);
  const views = toCount(
    pick(r, "videoPlayCount", "igPlayCount", "videoViewCount", "playCount", "viewsCount"),
  );
  let likes = toCount(pick(r, "likesCount", "likes", "likeCount"));
  if (likes < 0) likes = 0;
  const comments = toCount(pick(r, "commentsCount", "comments", "commentCount"));
  const shares = toCount(pick(r, "reshareCount", "sharesCount", "shareCount"));
  const durationSec = parseDurationSec(pick(r, "videoDuration", "duration", "video_duration"));
  const createdAt = toIsoDate(pick(r, "timestamp", "takenAt", "taken_at", "createdAt"));

  const scraped: ViralScrapedMeta = {
    views: views > 0,
    likes: likes > 0 || pick(r, "likesCount") != null,
    duration: durationSec != null,
    createdAt: createdAt != null,
    mediaType: mediaType !== "unknown",
    comments: comments > 0,
  };

  return {
    title: String(pick(r, "caption", "text", "description") ?? ""),
    author: String(pick(r, "ownerUsername", "owner.username", "username") ?? ""),
    url: String(pick(r, "url", "postUrl") ?? ""),
    thumbnail: String(pick(r, "displayUrl", "thumbnailUrl", "imageUrl", "images.0") ?? ""),
    views,
    likes,
    comments: comments || undefined,
    shares: shares || undefined,
    durationSec,
    createdAt,
    mediaType,
    scraped,
  };
}

function normalizeYouTube(r: Record<string, unknown>): ViralShortItem {
  const views = toCount(pick(r, "viewCount", "views", "stats.viewCount"));
  const likes = toCount(pick(r, "likes", "likeCount", "stats.likeCount"));
  const comments = toCount(pick(r, "commentCount", "numberOfComments", "comments"));
  const durationSec = parseDurationSec(
    pick(r, "duration", "lengthSeconds", "videoDuration", "durationSeconds"),
  );
  const createdAt = toIsoDate(pick(r, "publishedAt", "uploadDate", "date", "publishedTime"));

  const scraped: ViralScrapedMeta = {
    views: views > 0,
    likes: likes > 0,
    duration: durationSec != null,
    createdAt: createdAt != null,
    mediaType: true,
    comments: comments > 0,
  };

  return {
    title: String(pick(r, "title", "name") ?? ""),
    author: String(pick(r, "channelName", "channelTitle", "author", "uploader") ?? ""),
    url: String(pick(r, "url", "videoUrl", "link") ?? ""),
    thumbnail: String(pick(r, "thumbnailUrl", "thumbnail", "thumbnails.default.url") ?? ""),
    views,
    likes,
    comments: comments || undefined,
    durationSec,
    createdAt,
    mediaType: "video",
    scraped,
  };
}

function normalize(platform: Platform, raw: unknown): ViralShortItem {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (platform === "tiktok") return normalizeTikTok(r);
  if (platform === "instagram") return normalizeInstagram(r);
  return normalizeYouTube(r);
}

export const searchVirals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) return { items: [], error: "Wyszukiwanie filmów nie jest skonfigurowane po stronie serwera." };

    const platform = data.platform as Platform;
    const actor = ACTORS[platform];
    const body = buildActorInput(platform, data.query, data.limit);

    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=120`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      if (!res.ok) {
        const txt = await res.text();
        return { items: [], error: `Nie udało się pobrać wyników (${res.status}). ${txt.slice(0, 300)}` };
      }
      const raw = (await res.json()) as unknown[];
      if (!Array.isArray(raw)) {
        return { items: [], error: "Nieprawidłowa odpowiedź Apify." };
      }
      const items = raw.slice(0, data.limit).map((row) => normalize(platform, row));
      return { items, error: null as string | null };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Błąd połączenia — spróbuj ponownie za chwilę.";
      return { items: [], error: message };
    }
  });
