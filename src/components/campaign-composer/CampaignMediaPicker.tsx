import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Loader2, Upload, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  importGeneratedImageToCampaignAsset,
  importGeneratedVideoToCampaignAsset,
  uploadLocalFileToCampaignAsset,
} from "@/lib/campaignAssetImport";
import { toastSupabaseLoadError } from "@/lib/supabaseSchemaHint";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  provider: "meta" | "linkedin" | "tiktok" | "google";
  selectedAssetIds: string[];
  onChange: (assetIds: string[], suggestedFormat?: Props["format"]) => void;
  format: "single_image" | "carousel" | "video" | "article_share" | "dark_post";
  onFormatChange?: (format: Props["format"]) => void;
  /** Google: wiele obrazów + filmików naraz */
  allowMixedMedia?: boolean;
  /** Max wybranych materiałów (domyślnie zależnie od providera) */
  maxSelect?: number;
};

type Thumb = {
  key: string;
  kind: "image" | "video";
  sourceId: string;
  url: string;
  label: string;
  assetId?: string;
};

const FORMAT_TABS: { value: "single_image" | "carousel" | "video"; label: string }[] = [
  { value: "single_image", label: "Pojedynczy obraz" },
  { value: "carousel", label: "Karuzela" },
  { value: "video", label: "Wideo" },
];

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

function formatHint(format: "single_image" | "carousel" | "video", maxPick: number, mixed: boolean): string {
  if (mixed) {
    return `Wybierz zdjęcia i/lub filmiki z biblioteki albo wgraj z komputera (max ${maxPick}).`;
  }
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
  allowMixedMedia = false,
  maxSelect,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  /** source_ref (generated_images / generated_videos id) → cc_asset id */
  const [refToAsset, setRefToAsset] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<string[]>(selectedAssetIds);
  selectedRef.current = selectedAssetIds;

  const mixed = allowMixedMedia || provider === "google";
  const maxPick = maxSelect ?? (mixed ? 15 : provider === "linkedin" ? 5 : 10);
  const effectiveFormat: "single_image" | "carousel" | "video" =
    provider === "tiktok" ? "video" : format === "carousel" || format === "video" ? format : "single_image";

  const formatLimit = mixed ? maxPick : effectiveFormat === "carousel" ? maxPick : 1;

  const assetKindById = useMemo(() => {
    const m: Record<string, Thumb["kind"]> = {};
    for (const t of thumbs) {
      const aid = t.assetId ?? refToAsset[t.sourceId];
      if (aid) m[aid] = t.kind;
    }
    return m;
  }, [thumbs, refToAsset]);

  const visibleThumbs = useMemo(() => {
    if (mixed) {
      if (filter === "image") return thumbs.filter((t) => t.kind === "image");
      if (filter === "video") return thumbs.filter((t) => t.kind === "video");
      return thumbs;
    }
    if (effectiveFormat === "video") return thumbs.filter((t) => t.kind === "video");
    return thumbs.filter((t) => t.kind === "image");
  }, [thumbs, effectiveFormat, mixed, filter]);

  const pruneSelectionForFormat = useCallback(
    (assetIds: string[], fmt: typeof effectiveFormat) => {
      if (mixed) return assetIds.slice(0, formatLimit);
      const want: Thumb["kind"] = fmt === "video" ? "video" : "image";
      const compatible = assetIds.filter((id) => assetKindById[id] === want);
      if (fmt === "single_image" || fmt === "video") return compatible.slice(0, 1);
      return compatible.slice(0, formatLimit);
    },
    [assetKindById, formatLimit, mixed],
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
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (imgErr) toastSupabaseLoadError(imgErr, "generated_images");
    if (vidErr) toastSupabaseLoadError(vidErr, "generated_videos");

    const map: Record<string, string> = {};
    for (const a of assetsRes.data ?? []) {
      if (a.source_ref) map[a.source_ref] = a.id;
      map[a.id] = a.id;
    }

    const items: Thumb[] = [];
    const seenUrls = new Set<string>();

    // Najpierw wgrane / zapisane w bibliotece kampanii (upload + wcześniejsze importy)
    for (const a of assetsRes.data ?? []) {
      if (!a.public_url) continue;
      seenUrls.add(a.public_url);
      const kind: "image" | "video" = isVideoUrl(a.public_url) ? "video" : "image";
      const ref = a.source_ref ?? a.id;
      map[ref] = a.id;
      items.push({
        key: `asset-${a.id}`,
        kind,
        sourceId: ref,
        url: a.public_url,
        label: a.display_name?.slice(0, 60) ?? (kind === "video" ? "Wideo" : "Obraz"),
        assetId: a.id,
      });
    }

    for (const g of imgs ?? []) {
      if (seenUrls.has(g.image_url)) continue;
      items.push({
        key: `img-${g.id}`,
        kind: "image",
        sourceId: g.id,
        url: g.image_url,
        label: g.prompt?.slice(0, 60) ?? "Obraz",
        assetId: map[g.id],
      });
    }
    for (const v of vids ?? []) {
      if (!v.video_url || seenUrls.has(v.video_url)) continue;
      items.push({
        key: `vid-${v.id}`,
        kind: "video",
        sourceId: v.id,
        url: v.video_url,
        label: v.prompt?.slice(0, 60) ?? "Wideo",
        assetId: map[v.id],
      });
    }

    setRefToAsset(map);
    setThumbs(items);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const knownAssetIds = useMemo(() => new Set(Object.values(refToAsset)), [refToAsset]);
  const missingSelected = selectedAssetIds.filter((id) => !knownAssetIds.has(id)).join(",");
  const retriedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!missingSelected) return;
    if (retriedFor.current === missingSelected) return;
    retriedFor.current = missingSelected;
    void load();
  }, [missingSelected, load]);

  const resolveAssetId = async (t: Thumb): Promise<string | null> => {
    if (t.assetId) return t.assetId;
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
    setThumbs((list) =>
      list.map((x) => (x.key === t.key ? { ...x, assetId: result.assetId } : x)),
    );
    return result.assetId;
  };

  const selectedSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  const isSelected = (t: Thumb) => {
    const aid = t.assetId ?? refToAsset[t.sourceId];
    return Boolean(aid && selectedSet.has(aid));
  };

  const toggle = async (t: Thumb) => {
    if (!workspaceId) {
      toast.error("Brak przestrzeni roboczej — odśwież stronę szkicu kampanii.");
      return;
    }

    if (!mixed) {
      if (effectiveFormat === "video" && t.kind !== "video") {
        toast.error("W trybie wideo wybierz film — przełącz format lub wybierz klip z listy.");
        return;
      }
      if (effectiveFormat !== "video" && t.kind === "video") {
        toast.error("Ten format wymaga obrazów. Przełącz na „Wideo”, aby dodać film.");
        return;
      }
    }

    setBusyKey(t.key);
    try {
      const assetId = t.assetId ?? refToAsset[t.sourceId] ?? (await resolveAssetId(t));
      if (!assetId) return;

      if (selectedSet.has(assetId)) {
        onChange(
          pruneSelectionForFormat(
            selectedAssetIds.filter((id) => id !== assetId),
            effectiveFormat,
          ),
          mixed ? (t.kind === "video" ? "video" : "single_image") : effectiveFormat,
        );
        return;
      }

      if (mixed) {
        if (selectedAssetIds.length >= formatLimit) {
          toast.message(`Maksymalnie ${formatLimit} materiałów. Odznacz jeden, aby dodać inny.`);
          return;
        }
        const next = [...selectedAssetIds, assetId];
        onChange(next, t.kind === "video" ? "video" : selectedAssetIds.length > 0 ? "carousel" : "single_image");
        toast.success(t.kind === "video" ? "Dodano filmik" : "Dodano obraz");
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

  const handleLocalUpload = async (files: FileList | null) => {
    if (!files?.length || !workspaceId) return;
    setUploading(true);
    const added: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        const result = await uploadLocalFileToCampaignAsset({ workspaceId, file });
        if (!result.ok) {
          toast.error(`${file.name}: ${result.error}`);
          continue;
        }
        added.push(result.assetId);
        toast.success(`Wgrano: ${file.name}`);
      }
      if (added.length) {
        await load();
        const merged = [...selectedAssetIds];
        for (const id of added) {
          if (merged.length >= formatLimit) break;
          if (!merged.includes(id)) merged.push(id);
        }
        onChange(merged, mixed ? "carousel" : effectiveFormat);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
            {mixed
              ? ` / max ${formatLimit}`
              : effectiveFormat === "carousel"
                ? ` / min. 2, max ${formatLimit}`
                : " / 1"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {mixed && (
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
                {(
                  [
                    { value: "all", label: "Wszystko" },
                    { value: "image", label: "Zdjęcia" },
                    { value: "video", label: "Filmiki" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setFilter(tab.value)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                      filter === tab.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            {!mixed && provider !== "tiktok" && onFormatChange && (
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov"
            multiple
            className="hidden"
            onChange={(e) => void handleLocalUpload(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Wgrywanie…" : "Wgraj z komputera"}
          </button>
          <span className="text-[11px] text-muted-foreground">JPG, PNG, WEBP, MP4, WEBM, MOV</span>
        </div>

        <p className="rounded-lg border border-border/80 bg-background px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
          {provider === "tiktok"
            ? "TikTok Ads wymaga wideo — poniżej widać tylko gotowe filmy z Zasobów. Możesz też wgrać MP4 z komputera."
            : formatHint(effectiveFormat, formatLimit, mixed)}
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Ładowanie biblioteki…
        </p>
      ) : visibleThumbs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
          Brak materiałów. Wgraj plik z komputera albo wygeneruj grafikę/wideo w Zasobach.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {visibleThumbs.map((t) => {
            const on = isSelected(t);
            const picking = busyKey === t.key;
            const aid = t.assetId ?? refToAsset[t.sourceId];
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
                      Filmik
                    </span>
                  </div>
                ) : (
                  <div className="pointer-events-none relative aspect-square w-full">
                    <img src={t.url} alt="" className="h-full w-full object-cover" draggable={false} />
                    <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      <Image className="h-3 w-3" />
                      Zdjęcie
                    </span>
                  </div>
                )}
                {on && (mixed || effectiveFormat === "carousel") && aid && (
                  <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
                    {selectedAssetIds.indexOf(aid) + 1}
                  </span>
                )}
                {on && !mixed && effectiveFormat !== "carousel" && (
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
