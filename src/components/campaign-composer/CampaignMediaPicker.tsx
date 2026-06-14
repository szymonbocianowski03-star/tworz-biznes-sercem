import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Loader2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ccImportGeneratedVideos, ccListAssets } from "@/modules/campaign-composer/campaign-composer.functions";
import { importGeneratedImageToCampaignAsset } from "@/lib/campaignAssetImport";
import { toastSupabaseLoadError } from "@/lib/supabaseSchemaHint";
import { toast } from "sonner";

type Props = {
  workspaceId: string;
  provider: "meta" | "linkedin" | "tiktok";
  selectedAssetIds: string[];
  onChange: (assetIds: string[]) => void;
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

export function CampaignMediaPicker({
  workspaceId,
  provider,
  selectedAssetIds,
  onChange,
  format,
  onFormatChange,
}: Props) {
  const fnImportVid = useServerFn(ccImportGeneratedVideos);
  const fnList = useServerFn(ccListAssets);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  /** source_ref (generated_images / generated_videos id) → cc_asset id */
  const [refToAsset, setRefToAsset] = useState<Record<string, string>>({});

  const maxPick = provider === "linkedin" ? 5 : 10;

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
    const [{ data: imgs, error: imgErr }, { data: vids, error: vidErr }, listRes] = await Promise.all([
      supabase.from("generated_images").select("id,image_url,prompt").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(40),
      supabase
        .from("generated_videos")
        .select("id,video_url,prompt,status")
        .eq("user_id", u.user.id)
        .eq("status", "succeeded")
        .order("created_at", { ascending: false })
        .limit(20),
      fnList({ data: { workspaceId } }).catch(() => ({ assets: [] as { id: string; source_ref: string | null }[] })),
    ]);

    if (imgErr) toastSupabaseLoadError(imgErr, "generated_images");
    if (vidErr) toastSupabaseLoadError(vidErr, "generated_videos");

    const map: Record<string, string> = {};
    for (const a of (listRes.assets ?? []) as { id: string; source_ref: string | null }[]) {
      if (a.source_ref) map[a.source_ref] = a.id;
    }
    setRefToAsset(map);

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
    setThumbs(items);
    setLoading(false);
  }, [workspaceId, fnList]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolveAssetId = async (t: Thumb): Promise<string | null> => {
    const existing = refToAsset[t.sourceId];
    if (existing) return existing;

    if (t.kind === "image") {
      const r = await importGeneratedImageToCampaignAsset({
        workspaceId,
        generatedImageId: t.sourceId,
        imageUrl: t.url,
        prompt: t.label,
      });
      if (!r.ok) {
        toast.error(r.error);
        return null;
      }
      setRefToAsset((m) => ({ ...m, [t.sourceId]: r.assetId }));
      return r.assetId;
    }

    try {
      const { importedIds } = await fnImportVid({
        data: { workspaceId, generatedVideoIds: [t.sourceId] },
      });
      const id = importedIds?.[0];
      if (id) {
        setRefToAsset((m) => ({ ...m, [t.sourceId]: id }));
        return id;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się dodać wideo do kampanii.");
      return null;
    }
    toast.error("Nie udało się dodać materiału do kampanii.");
    return null;
  };

  const selectedSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);

  const toggle = async (t: Thumb) => {
    if (!workspaceId) {
      toast.error("Brak przestrzeni roboczej — odśwież stronę szkicu kampanii.");
      return;
    }

    const assetId = refToAsset[t.sourceId] ?? (await resolveAssetId(t));
    if (!assetId) return;

    if (selectedSet.has(assetId)) {
      onChange(selectedAssetIds.filter((id) => id !== assetId));
      return;
    }
    if (selectedAssetIds.length >= maxPick) {
      toast.message(`Możesz wybrać maksymalnie ${maxPick} materiałów do tej reklamy.`);
      return;
    }
    const next = [...selectedAssetIds, assetId];
    onChange(next);
    toast.success("Dodano materiał do kreacji kampanii");
    if (onFormatChange) {
      if (t.kind === "video") onFormatChange("video");
      else if (next.length >= 2) onFormatChange("carousel");
      else onFormatChange("single_image");
    }
  };

  const isSelected = (t: Thumb) => {
    const aid = refToAsset[t.sourceId];
    return aid ? selectedSet.has(aid) : false;
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Wybierz zdjęcia lub filmy z Zasobów (wygenerowane w aplikacji). Wybrano{" "}
          <span className="font-semibold text-foreground">{selectedAssetIds.length}</span> z {maxPick}.
        </p>
        {onFormatChange && (
          <select
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
            value={format}
            onChange={(e) => onFormatChange(e.target.value as Props["format"])}
          >
            <option value="single_image">Pojedynczy obraz</option>
            <option value="carousel">Karuzela (2+ obrazy)</option>
            <option value="video">Wideo</option>
          </select>
        )}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Ładowanie biblioteki…
        </p>
      ) : thumbs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
          Brak materiałów. Wygeneruj obrazy w agencie lub wideo w Zasobach → Wideo, a potem wróć tutaj.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {thumbs.map((t) => {
            const on = isSelected(t);
            return (
              <button
                type="button"
                key={t.key}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void toggle(t).finally(() => setBusy(false));
                }}
                className={`relative overflow-hidden rounded-xl border-2 text-left transition ${
                  on ? "border-foreground ring-2 ring-foreground/20" : "border-transparent hover:border-border"
                }`}
              >
                {t.kind === "video" ? (
                  <div className="relative aspect-square w-full bg-muted">
                    <video src={t.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      <Video className="h-3 w-3" />
                      Wideo
                    </span>
                  </div>
                ) : (
                  <div className="relative aspect-square w-full">
                    <img src={t.url} alt="" className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      <Image className="h-3 w-3" />
                      Obraz
                    </span>
                  </div>
                )}
                {on && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
                    ✓
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
