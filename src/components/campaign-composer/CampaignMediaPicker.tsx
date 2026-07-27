import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Loader2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  importGeneratedImageToCampaignAsset,
  importGeneratedVideoToCampaignAsset,
} from "@/lib/campaignAssetImport";
import { toastSupabaseLoadError } from "@/lib/supabaseSchemaHint";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  provider: "meta" | "linkedin" | "tiktok";
  selectedAssetIds: string[];
  onChange: (assetIds: string[], suggestedFormat?: Props["format"]) => void;
  format: "single_image" | "carousel" | "video" | "article_share" | "dark_post";
  onFormatChange?: (format: Props["format"]) => void;
};

type Thumb = {
  key: string;
  kind: "image" | "video";
  sourceId: string;
  url: string;
  label: string;
};

const FORMAT_TABS: { value: "single_image" | "carousel" | "video"; label: string }[] = [
  { value: "single_image", label: "Pojedynczy obraz" },
  { value: "carousel", label: "Karuzela" },
  { value: "video", label: "Wideo" },
];

function formatHint(format: "single_image" | "carousel" | "video", maxPick: number): string {
  switch (format) {
    case "single_image":
      return "Wybierz jeden obraz z listy poniżej. Inne typy plików są ukryte.";
    case "carousel":
      return `Wybierz od 2 do ${maxPick} obrazów — kolejność kliknięć to kolejność slajdów w karuzeli.`;
    case "video":
      return "Wybierz jeden gotowy film z Zasobów → Wideo. Obrazy są ukryte.";
  }
}

export function CampaignMediaPicker({
  workspaceId,
  provider,
  selectedAssetIds,
  onChange,
  format,
  onFormatChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  /** source_ref (generated_images / generated_videos id) → cc_asset id */
  const [refToAsset, setRefToAsset] = useState<Record<string, string>>({});

  const maxPick = provider === "linkedin" ? 5 : 10;
  const effectiveFormat: "single_image" | "carousel" | "video" =
    provider === "tiktok" ? "video" : format === "carousel" || format === "video" ? format : "single_image";

  const formatLimit = effectiveFormat === "carousel" ? maxPick : 1;

  const assetKindById = useMemo(() => {
    const m: Record<string, Thumb["kind"]> = {};
    for (const t of thumbs) {
      const aid = refToAsset[t.sourceId];
      if (aid) m[aid] = t.kind;
    }
    return m;
  }, [thumbs, refToAsset]);

  const visibleThumbs = useMemo(() => {
    if (effectiveFormat === "video") return thumbs.filter((t) => t.kind === "video");
    return thumbs.filter((t) => t.kind === "image");
  }, [thumbs, effectiveFormat]);

  const pruneSelectionForFormat = useCallback(
    (assetIds: string[], fmt: typeof effectiveFormat) => {
      const want: Thumb["kind"] = fmt === "video" ? "video" : "image";
      const compatible = assetIds.filter((id) => assetKindById[id] === want);
      if (fmt === "single_image" || fmt === "video") return compatible.slice(0, 1);
      return compatible.slice(0, formatLimit);
    },
    [assetKindById, formatLimit],
  );

  const load = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      setThumbs([]);
      return;
    }
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }
    const [{ data: imgs, error: imgErr }, { data: vids, error: vidErr }, assetsRes] = await Promise.all([
      supabase
        .from("generated_images")
        .select("id,image_url,prompt")
        .eq("user_id", u.user.id)
        .or("user_reaction.is.null,user_reaction.eq.none,user_reaction.eq.like")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("generated_videos")
        .select("id,video_url,prompt,status")
        .eq("user_id", u.user.id)
        .eq("status", "succeeded")
        .or("user_reaction.is.null,user_reaction.eq.none,user_reaction.eq.like")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("cc_asset")
        .select("id,source_ref,public_url,display_name,source")
        .eq("workspace_id", workspaceId)
        .eq("user_id", u.user.id),
    ]);

    if (imgErr) toastSupabaseLoadError(imgErr, "generated_images");
    if (vidErr) toastSupabaseLoadError(vidErr, "generated_videos");

    const map: Record<string, string> = {};
    for (const a of assetsRes.data ?? []) {
      if (a.source_ref) map[a.source_ref] = a.id;
    }

    const items: Thumb[] = [];
    for (const g of imgs ?? []) {
      items.push({
        key: `img-${g.id}`,
        kind: "image",
        sourceId: g.id,
        url: g.image_url,
        label: g.prompt?.slice(0, 60) ?? "Obraz",
      });
    }
    for (const v of vids ?? []) {
      if (!v.video_url) continue;
      items.push({
        key: `vid-${v.id}`,
        kind: "video",
        sourceId: v.id,
        url: v.video_url,
        label: v.prompt?.slice(0, 60) ?? "Wideo",
      });
    }

    // Materiały już wybrane w szkicu muszą być widoczne nawet, gdy oryginalna
    // generacja wypadła poza ostatnie 100 pozycji biblioteki.
    const known = new Set(items.map((i) => i.sourceId));
    for (const a of assetsRes.data ?? []) {
      if (!selectedRef.current.includes(a.id)) continue;
      const ref = a.source_ref ?? a.id;
      if (known.has(ref)) continue;
      if (!a.public_url) continue;
      const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(a.public_url);
      map[ref] = a.id;
      items.push({
        key: `asset-${a.id}`,
        kind: isVideo ? "video" : "image",
        sourceId: ref,
        url: a.public_url,
        label: a.display_name?.slice(0, 60) ?? (isVideo ? "Wideo" : "Obraz"),
      });
    }

    setRefToAsset(map);
    setThumbs(items);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolveAssetId = async (t: Thumb): Promise<string | null> => {
    const existing = refToAsset[t.sourceId];
    if (existing) return existing;

    const result =
      t.kind === "image"
        ? await importGeneratedImageToCampaignAsset({
            workspaceId,
            generatedImageId: t.sourceId,
            imageUrl: t.url,
            prompt: t.label,
          })
        : await importGeneratedVideoToCampaignAsset({
            workspaceId,
            generatedVideoId: t.sourceId,
            videoUrl: t.url,
            prompt: t.label,
          });

    if (!result.ok) {
      toast.error(result.error);
      return null;
    }

    setRefToAsset((m) => ({ ...m, [t.sourceId]: result.assetId }));
    return result.assetId;
  };

  const selectedSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  const isSelected = (t: Thumb) => {
    const aid = refToAsset[t.sourceId];
    return Boolean(aid && selectedSet.has(aid));
  };

  const toggle = async (t: Thumb) => {
    if (!workspaceId) {
      toast.error("Brak przestrzeni roboczej — odśwież stronę szkicu kampanii.");
      return;
    }

    if (effectiveFormat === "video" && t.kind !== "video") {
      toast.error("W trybie wideo wybierz film — przełącz format lub wybierz klip z listy.");
      return;
    }
    if (effectiveFormat !== "video" && t.kind === "video") {
      toast.error("Ten format wymaga obrazów. Przełącz na „Wideo”, aby dodać film.");
      return;
    }

    setBusyKey(t.key);
    try {
      const assetId = refToAsset[t.sourceId] ?? (await resolveAssetId(t));
      if (!assetId) return;

      if (selectedSet.has(assetId)) {
        onChange(pruneSelectionForFormat(selectedAssetIds.filter((id) => id !== assetId), effectiveFormat), effectiveFormat);
        return;
      }

      if (effectiveFormat === "single_image" || effectiveFormat === "video") {
        onChange([assetId], effectiveFormat);
        toast.success(effectiveFormat === "video" ? "Wybrano wideo" : "Wybrano obraz");
        return;
      }

      if (selectedAssetIds.length >= formatLimit) {
        toast.message(`Karuzela: maksymalnie ${formatLimit} obrazów. Odznacz jeden, aby dodać inny.`);
        return;
      }

      const next = [...selectedAssetIds, assetId];
      onChange(next, "carousel");
      toast.success(`Dodano slajd ${next.length}/${formatLimit}`);
    } finally {
      setBusyKey(null);
    }
  };

  const handleFormatChange = (fmt: "single_image" | "carousel" | "video") => {
    if (!onFormatChange) return;
    onFormatChange(fmt);
    const pruned = pruneSelectionForFormat(selectedAssetIds, fmt);
    if (pruned.length !== selectedAssetIds.length) {
      onChange(pruned, fmt);
      if (selectedAssetIds.length > 0) {
        toast.message("Dostosowano wybór do nowego formatu reklamy.");
      }
    }
  };

  if (!workspaceId) {
    return (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-950 dark:text-amber-100">
        Ładowanie przestrzeni roboczej kampanii… Jeśli komunikat nie znika, odśwież stronę szkicu.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Wybrano{" "}
            <span className="font-semibold text-foreground">{selectedAssetIds.length}</span>
            {effectiveFormat === "carousel" ? ` / min. 2, max ${formatLimit}` : " / 1"}
          </p>
          {provider !== "tiktok" && onFormatChange && (
            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
              {FORMAT_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleFormatChange(tab.value)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                    effectiveFormat === tab.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="rounded-lg border border-border/80 bg-background px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
          {provider === "tiktok"
            ? "TikTok Ads wymaga wideo — poniżej widać tylko gotowe filmy z Zasobów."
            : formatHint(effectiveFormat, formatLimit)}
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Ładowanie biblioteki…
        </p>
      ) : visibleThumbs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
          {effectiveFormat === "video"
            ? "Brak gotowych filmów. Wygeneruj wideo w Zasobach → Wideo i wróć tutaj."
            : "Brak obrazów. Wygeneruj grafiki w agencie (Zasoby → Obrazy) i wróć tutaj."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {visibleThumbs.map((t) => {
            const on = isSelected(t);
            const picking = busyKey === t.key;
            return (
              <button
                type="button"
                key={t.key}
                disabled={picking}
                onClick={() => void toggle(t)}
                aria-pressed={on}
                className={`relative cursor-pointer overflow-hidden rounded-xl border-2 text-left transition ${
                  on ? "border-foreground ring-2 ring-foreground/20" : "border-transparent hover:border-border"
                } ${picking ? "opacity-80" : ""}`}
              >
                {t.kind === "video" ? (
                  <div className="pointer-events-none relative aspect-square w-full bg-muted">
                    <video src={t.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      <Video className="h-3 w-3" />
                      Wideo
                    </span>
                  </div>
                ) : (
                  <div className="pointer-events-none relative aspect-square w-full">
                    <img src={t.url} alt="" className="h-full w-full object-cover" draggable={false} />
                    <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      <Image className="h-3 w-3" />
                      Obraz
                    </span>
                  </div>
                )}
                {on && effectiveFormat === "carousel" && refToAsset[t.sourceId] && (
                  <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
                    {selectedAssetIds.indexOf(refToAsset[t.sourceId]) + 1}
                  </span>
                )}
                {on && effectiveFormat !== "carousel" && (
                  <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
                    ✓
                  </span>
                )}
                {picking && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
