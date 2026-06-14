import { useState } from "react";
import { Bookmark, ExternalLink, Eye, Heart, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";

export type ViralMediaType = "video" | "image" | "carousel" | "unknown";

/** Które cechy udało się pobrać ze scrapera (do filtrów i UI). */
export type ViralScrapedMeta = {
  views: boolean;
  likes: boolean;
  duration: boolean;
  createdAt: boolean;
  mediaType: boolean;
  comments: boolean;
};

export type ViralShortItem = {
  title: string;
  author: string;
  url: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments?: number;
  shares?: number;
  durationSec?: number;
  createdAt?: string;
  mediaType?: ViralMediaType;
  scraped?: ViralScrapedMeta;
};

export type ViralPlatform = "tiktok" | "instagram" | "youtube";

export type SavedViralShortRow = {
  id: string;
  platform: ViralPlatform;
  url: string;
  title: string;
  author: string;
  thumbnail: string;
  views: number;
  likes: number;
  search_query: string | null;
  created_at: string;
};

function fmt(n: number) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const PLATFORM_LABEL: Record<ViralPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
};

type Props = {
  item: ViralShortItem;
  platform: ViralPlatform;
  /** Zapytanie użyte przy wyszukiwaniu (opcjonalnie zapisane w bazie). */
  searchQuery?: string;
  /** Id wiersza w `saved_viral_shorts`, jeśli już zapisano. */
  savedRowId: string | null;
  /** Po zapisaniu / usunięciu — odśwież listę zapisanych u rodzica. */
  onMutated: () => void;
  /** Wywoływane tylko po udanym zapisie (np. przejście do zakładki „Zapisane”). */
  afterSave?: () => void;
  /** Mniejszy układ (np. siatka w analizie konkurencji). */
  compact?: boolean;
};

export function ViralShortCard({ item, platform, searchQuery, savedRowId, onMutated, afterSave, compact }: Props) {
  const { user } = useAuthSession();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!user) {
      toast.error("Zaloguj się, żeby zapisywać rolki.");
      return;
    }
    if (!item.url?.trim()) {
      toast.error("Brak adresu filmu — nie da się zapisać.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("saved_viral_shorts").insert({
        user_id: user.id,
        platform,
        url: item.url.trim(),
        title: (item.title || "").slice(0, 2000),
        author: (item.author || "").slice(0, 500),
        thumbnail: (item.thumbnail || "").slice(0, 4000),
        views: Math.max(0, Math.floor(item.views || 0)),
        likes: Math.max(0, Math.floor(item.likes || 0)),
        search_query: searchQuery?.trim() ? searchQuery.trim().slice(0, 200) : null,
      });
      if (error) {
        if (error.code === "23505") {
          toast.info("Ta rolka jest już w zapisanych.");
        } else if (error.message.includes("saved_viral_shorts") || error.code === "42P01") {
          toast.error("Tabela zapisów nie jest jeszcze wdrożona w Supabase (migracja saved_viral_shorts).");
        } else {
          toast.error(error.message || "Nie udało się zapisać.");
        }
        return;
      }
      toast.success("Zapisano w „Moje virale”.");
      onMutated();
      afterSave?.();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!savedRowId || !user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("saved_viral_shorts").delete().eq("id", savedRowId).eq("user_id", user.id);
      if (error) {
        toast.error(error.message || "Nie udało się usunąć.");
        return;
      }
      toast.success("Usunięto z zapisanych.");
      onMutated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`group relative rounded-xl border border-border overflow-hidden bg-background ${compact ? "" : "hover:border-foreground/30"} transition`}
    >
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full aspect-video object-cover" loading="lazy" />
        ) : (
          <div className="w-full aspect-video bg-muted" />
        )}
        <div className={compact ? "p-2" : "p-3"}>
          <div className={`font-medium line-clamp-2 ${compact ? "text-xs" : "text-sm"}`}>
            {item.title || "(brak opisu)"}
          </div>
          <div className={`text-muted-foreground mt-1 ${compact ? "text-[10px]" : "text-xs"}`}>@{item.author}</div>
          <div className={`mt-2 flex flex-wrap items-center gap-2 text-muted-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3 shrink-0" /> {fmt(item.views)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3 shrink-0" /> {fmt(item.likes)}
            </span>
            {item.durationSec != null && item.durationSec > 0 ? (
              <span>{Math.round(item.durationSec)}s</span>
            ) : null}
            {item.mediaType && item.mediaType !== "unknown" ? (
              <span className="uppercase tracking-wide text-[9px] font-semibold opacity-80">
                {item.mediaType === "video" ? "wideo" : item.mediaType === "image" ? "obraz" : "karuzela"}
              </span>
            ) : null}
            {item.scraped && (!item.scraped.duration || !item.scraped.createdAt) ? (
              <span className="text-[9px] opacity-60" title="Część metryk nie wróciła z API platformy">
                {!item.scraped.duration && !item.scraped.createdAt ? "brak części danych" : null}
              </span>
            ) : null}
          </div>
        </div>
      </a>

      <div className="absolute top-2 right-2 flex gap-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-background/90 border border-border text-foreground shadow-sm hover:bg-muted"
          title="Otwórz"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {savedRowId ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-background/90 border border-border text-foreground shadow-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-50"
            title="Usuń z zapisanych"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-background/90 border border-border text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
            title="Zapisz viral"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

/** Wiersz na liście „Moje virale” (platforma + link + usuń). */
export function SavedViralShortListItem({ row, onMutated }: { row: SavedViralShortRow; onMutated: () => void }) {
  const { user } = useAuthSession();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("saved_viral_shorts").delete().eq("id", row.id).eq("user_id", user.id);
      if (error) {
        toast.error(error.message || "Nie udało się usunąć.");
        return;
      }
      toast.success("Usunięto z zapisanych.");
      onMutated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-3 rounded-xl border border-border p-3 bg-background">
      {row.thumbnail ? (
        <img src={row.thumbnail} alt="" className="w-28 shrink-0 aspect-video object-cover rounded-md" loading="lazy" />
      ) : (
        <div className="w-28 shrink-0 aspect-video rounded-md bg-muted" />
      )}
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {PLATFORM_LABEL[row.platform]}
            </span>
            <p className="text-sm font-medium line-clamp-2 mt-0.5">{row.title || row.url}</p>
            <p className="text-xs text-muted-foreground mt-0.5">@{row.author}</p>
            {row.search_query ? (
              <p className="text-[11px] text-muted-foreground mt-1 truncate">Szukano: {row.search_query}</p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove()}
            className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-50"
            title="Usuń z zapisanych"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3 shrink-0" /> {fmt(row.views)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3 shrink-0" /> {fmt(row.likes)}
          </span>
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto font-medium text-foreground underline-offset-2 hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> Otwórz
          </a>
        </div>
      </div>
    </div>
  );
}
