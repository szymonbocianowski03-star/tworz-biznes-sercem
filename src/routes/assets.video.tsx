import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clapperboard, Heart, Loader2, MessageSquareText, ThumbsDown, Trash2, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AssetsTabs } from "@/components/AssetsTabs";
import { AssetsToolbar } from "@/components/AssetsToolbar";
import { ZasobyReactionFilter, type ZasobyReactionFilterValue } from "@/components/ZasobyReactionFilter";
import { supabase } from "@/integrations/supabase/client";
import { supabaseEdgeFunctionUrl } from "@/integrations/supabase/publicEnv";
import { supabaseFnHeaders } from "@/lib/supabaseFnHeaders";
import { buildAssetAgentPrompt, setAssetAgentSeed } from "@/lib/assetAgentSeed";
import { VIDEO_PROMPT_SEED_KEY } from "@/lib/saveProjectAsset";
import { useProducts } from "@/hooks/useProducts";
import { toast } from "sonner";
import { toastSupabaseLoadError } from "@/lib/supabaseSchemaHint";

export const Route = createFileRoute("/assets/video")({
  head: () => ({ meta: [{ title: "Zasoby — wideo — MarketingNow" }] }),
  component: VideoAssetsPage,
});

const VIDEO_FN = supabaseEdgeFunctionUrl("generate-video");

type Reaction = "none" | "like" | "dislike";

type VideoRow = {
  id: string;
  prompt: string;
  video_url: string | null;
  status: string;
  error_detail: string | null;
  created_at: string;
  user_reaction: Reaction;
};

const RATIOS = ["720:1280", "1280:720", "960:960"] as const;
const STYLES = [
  { value: "ugc", label: "UGC TikTok/Reels (domyślny)" },
  { value: "viral", label: "Viral hook (short-form)" },
  { value: "product", label: "Reklama produktu" },
  { value: "testimonial", label: "Testimonial / opinia" },
  { value: "image-animate", label: "Animacja zdjęcia → wideo" },
  { value: "", label: "Standard (bez szablonu UGC)" },
] as const;

function VideoAssetsPage() {
  const navigate = useNavigate();
  const { active: brandProduct } = useProducts();
  const [items, setItems] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ZasobyReactionFilterValue>("all");
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<(typeof RATIOS)[number]>("720:1280");
  const [style, setStyle] = useState<(typeof STYLES)[number]["value"]>("ugc");
  const [duration, setDuration] = useState(5);
  const [starting, setStarting] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setItems([]);
      setLoading(false);
      return;
    }
    let q = supabase
      .from("generated_videos")
      .select("id,prompt,video_url,status,error_detail,created_at,user_reaction")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false });
    if (filter === "all") q = q.or("user_reaction.is.null,user_reaction.eq.none,user_reaction.eq.like");
    else if (filter === "like") q = q.eq("user_reaction", "like");
    else q = q.eq("user_reaction", "dislike");
    const { data, error } = await q;
    if (error) {
      toastSupabaseLoadError(error, "wideo / generated_videos");
      setItems([]);
    } else {
      setItems((data as VideoRow[]) ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const seed = sessionStorage.getItem(VIDEO_PROMPT_SEED_KEY);
      if (seed?.trim()) {
        setPrompt(seed);
        sessionStorage.removeItem(VIDEO_PROMPT_SEED_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const stopPoll = () => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const stopGeneratingUi = () => {
    stopPoll();
    setStarting(false);
    setPollingId(null);
    toast.message("Zatrzymano sprawdzanie statusu. Wideo może dokończyć się w tle.");
  };

  useEffect(() => () => stopPoll(), []);

  const setReaction = async (it: VideoRow, r: Reaction) => {
    const { error } = await supabase.from("generated_videos").update({ user_reaction: r }).eq("id", it.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  };

  const openInAgent = (it: VideoRow) => {
    if (!it.video_url) return;
    setAssetAgentSeed({
      kind: "video",
      mediaUrl: it.video_url,
      text: buildAssetAgentPrompt("video", it.prompt, it.video_url),
    });
    void navigate({ to: "/agent" });
    toast.message("Otwarto czat — wiadomość z linkiem do klipu została dodana.");
  };

  const pollOnce = useCallback(
    async (id: string) => {
      const headers = await supabaseFnHeaders();
      if (!headers) return;
      const res = await fetch(VIDEO_FN, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "poll", id }),
      });
      const json = (await res.json().catch(() => ({}))) as { video?: VideoRow; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Nie udało się sprawdzić statusu generacji.");
        setPollingId(null);
        stopPoll();
        await load();
        return;
      }
      const row = json.video;
      if (row) {
        setItems((prev) => {
          const rest = prev.filter((x) => x.id !== row.id);
          return [row, ...rest].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
        });
        if (row.status === "succeeded" && row.video_url) {
          toast.success("Wideo gotowe.");
          setPollingId(null);
          stopPoll();
          await load();
        } else if (row.status === "failed") {
          toast.error(row.error_detail ?? "Generacja nie powiodła się.");
          setPollingId(null);
          stopPoll();
          await load();
        }
      }
    },
    [load],
  );

  const startGenerate = async () => {
    const p = prompt.trim();
    if (!p) {
      toast.error("Wpisz opis sceny (prompt).");
      return;
    }
    if (!VIDEO_FN) {
      toast.error("Brak adresu Supabase — nie można uruchomić generacji.");
      return;
    }
    const headers = await supabaseFnHeaders();
    if (!headers) {
      toast.error("Zaloguj się, aby generować wideo.");
      return;
    }
    setStarting(true);
    try {
      const res = await fetch(VIDEO_FN, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "start",
          prompt: p,
          ratio,
          duration,
          productName: brandProduct?.name ?? null,
          ...(style ? { style } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        details?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? json.details ?? "Nie udało się uruchomić generacji wideo.");
        return;
      }
      const id = json.id;
      if (!id) {
        toast.error("Brak identyfikatora zadania.");
        return;
      }
      toast.message("Zadanie wideo w kolejce — przetwarzanie w tle…");
      setPrompt("");
      setPollingId(id);
      await load();
      stopPoll();
      pollRef.current = window.setInterval(() => {
        void pollOnce(id);
      }, 5000);
      void pollOnce(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd sieci.");
    } finally {
      setStarting(false);
    }
  };

  const remove = async (it: VideoRow) => {
    if (!confirm("Usunąć to wideo z galerii?")) return;
    if (it.video_url && it.id) {
      const pathMatch = /\/generations\/(.+)$/.exec(it.video_url);
      const path = pathMatch?.[1];
      if (path) {
        await supabase.storage.from("generations").remove([decodeURIComponent(path)]);
      }
    }
    const { error } = await supabase.from("generated_videos").delete().eq("id", it.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Usunięto");
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    }
  };

  const generating = starting || pollingId !== null;

  return (
    <div className="px-6 md:px-10 py-10 max-w-6xl">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Zasoby</h1>
      <p className="mt-2 text-sm text-muted-foreground">Wideo z galerii — polubienia, nielubienia i edycja w czacie.</p>
      <AssetsTabs />
      <ZasobyReactionFilter value={filter} onChange={setFilter} />
      <AssetsToolbar placeholder="Szukaj wideo…" ctaLabel="Nowe wideo" />

      <div className="mt-8 rounded-2xl border border-border bg-surface-elevated p-5 md:p-6 shadow-soft space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clapperboard className="h-4 w-4" />
          Nowe wideo (tekst → wideo)
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={generating}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[100px]"
            placeholder="Np. kobieta 28 lat w kuchni, trzyma serum, mówi do kamery o pierwszych efektach po 7 dniach — hook: «przestałam ukrywać czerwone plamy»…"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">Styl wideo</span>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as (typeof STYLES)[number]["value"])}
              disabled={generating}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {STYLES.map((s) => (
                <option key={s.value || "standard"} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">Proporcje</span>
            <select
              value={ratio}
              onChange={(e) => setRatio(e.target.value as (typeof RATIOS)[number])}
              disabled={generating}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {RATIOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">Czas trwania (s)</span>
            <input
              type="number"
              min={2}
              max={10}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 5)}
              disabled={generating}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void startGenerate()}
          disabled={generating || !prompt.trim()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Trwa generowanie…
            </>
          ) : (
            <>
              <Video className="h-4 w-4" />
              Generuj wideo
            </>
          )}
        </button>
        {generating && (
          <button
            type="button"
            onClick={stopGeneratingUi}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold hover:bg-muted/30"
          >
            Zatrzymaj
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-8 text-sm text-muted-foreground">Ładowanie galerii…</div>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "dislike"
              ? "Brak pozycji w nielubianych."
              : filter === "like"
                ? "Brak polubionych klipów."
                : "Brak wideo. Wygeneruj pierwszy klip powyżej."}
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Galeria wideo</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="rounded-2xl border border-border bg-surface-elevated overflow-hidden shadow-soft"
              >
                <div className="aspect-video bg-neutral-950 flex items-center justify-center relative">
                  {it.status === "succeeded" && it.video_url ? (
                    <video
                      src={it.video_url}
                      controls
                      playsInline
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center px-4 py-8 text-muted-foreground text-sm">
                      {it.status === "failed" ? (
                        <span className="text-destructive">{it.error_detail ?? "Błąd generacji"}</span>
                      ) : (
                        <span className="inline-flex items-center gap-2 justify-center">
                          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                          {it.status === "pending" ? "Oczekiwanie…" : "Przetwarzanie…"}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 flex gap-1 z-10">
                    <button
                      type="button"
                      title="Polub"
                      onClick={() => void setReaction(it, it.user_reaction === "like" ? "none" : "like")}
                      className={`h-8 w-8 rounded-full flex items-center justify-center shadow ${
                        it.user_reaction === "like" ? "bg-rose-500 text-white" : "bg-black/60 text-white hover:bg-black/80"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${it.user_reaction === "like" ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      title="Nielubiane"
                      onClick={() => void setReaction(it, it.user_reaction === "dislike" ? "none" : "dislike")}
                      className={`h-8 w-8 rounded-full flex items-center justify-center shadow ${
                        it.user_reaction === "dislike" ? "bg-white text-neutral-900" : "bg-black/60 text-white hover:bg-black/80"
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1 z-10">
                    {it.status === "succeeded" && it.video_url && (
                      <button
                        type="button"
                        title="Edytuj w czacie"
                        onClick={() => openInAgent(it)}
                        className="h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      >
                        <MessageSquareText className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(it)}
                      className="h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                      aria-label="Usuń"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-medium line-clamp-3">{it.prompt}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(it.created_at).toLocaleString("pl-PL")} · {it.status}
                  </p>
                  <Link to="/agent" className="text-xs text-accent font-medium hover:opacity-80">
                    Otwórz czat →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
