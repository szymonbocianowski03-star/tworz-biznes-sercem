import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clapperboard, Download, FolderOpen, Heart, Loader2, MessageSquareText, ThumbsDown, Trash2, Type, Video } from "lucide-react";
import { GeneratedVideoToolbar } from "@/components/GeneratedVideoToolbar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssetsTabs } from "@/components/AssetsTabs";
import { ZasobyReactionFilter, type ZasobyReactionFilterValue } from "@/components/ZasobyReactionFilter";
import { useCreditsUpgrade } from "@/contexts/CreditsUpgradeContext";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { supabaseEdgeFunctionUrl } from "@/integrations/supabase/publicEnv";
import { supabaseFnHeaders } from "@/lib/supabaseFnHeaders";
import { buildAssetAgentPrompt, setAssetAgentSeed } from "@/lib/assetAgentSeed";
import { downloadMediaWithToast } from "@/lib/downloadMedia";
import { notifyCreditsRefresh } from "@/lib/creditsRefresh";
import { freeUsageCentsToCredits } from "@/lib/creditUsageDisplay";
import { checkVideoGenerationAffordability, getVideoUsageEstimate } from "@/lib/videoCreditsGate";
import { friendlyVideoError } from "@/lib/videoErrorDisplay";
import { saveVideoToProjectAssets, VIDEO_PROMPT_SEED_KEY } from "@/lib/saveProjectAsset";
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

const VIDEO_PROMPT_IDEAS: { label: string; prompt: string; style: (typeof STYLES)[number]["value"]; ratio: (typeof RATIOS)[number] }[] = [
  {
    label: "UGC TikTok — hook w 2 s",
    style: "ugc",
    ratio: "720:1280",
    prompt:
      "Kobieta 28 lat w kuchni, trzyma produkt do twarzy, mówi do kamery szczerze — hook: «przestałam ukrywać czerwone plamy». Naturalne światło, styl UGC. Bez napisów i bez czytelnego tekstu w samym wideo (tekst dodamy jako warstwę w aplikacji).",
  },
  {
    label: "Reklama produktu — close-up",
    style: "product",
    ratio: "720:1280",
    prompt:
      "Zbliżenie na produkt na jasnym blacie, ręce pokazują konsystencję i aplikację. Czyste tło, premium look. Bez napisów i bez CTA w samym wideo (tekst dodamy jako warstwę w aplikacji).",
  },
  {
    label: "Opinia klienta",
    style: "testimonial",
    ratio: "720:1280",
    prompt:
      "Osoba 35+ przed lustrem w łazience, pokazuje efekt po 7 dniach, mówi jednym zdaniem o zmianie. Autentyczny ton, selfie-style. Bez napisów w samym wideo (tekst dodamy jako warstwę w aplikacji).",
  },
  {
    label: "Viral hook — problem → rozwiązanie",
    style: "viral",
    ratio: "720:1280",
    prompt:
      "Pierwsze 2 sekundy: zaskoczony wyraz twarzy (bez napisów na ekranie). Potem szybkie ujęcia przed/po. Energetyczny montaż short-form. Bez czytelnego tekstu w samym wideo (tekst dodamy jako warstwę w aplikacji).",
  },
  {
    label: "Poziomy baner 16:9",
    style: "product",
    ratio: "1280:720",
    prompt:
      "Produkt na środku kadru, delikatny ruch kamery, minimalistyczne tło. Styl reklamy e-commerce. Bez nagłówków i CTA w samym wideo (tekst dodamy jako warstwę w aplikacji).",
  },
];

function VideoAssetsPage() {
  const navigate = useNavigate();
  const { openCreditsUpgrade } = useCreditsUpgrade();
  const credits = useCredits();
  const { active: brandProduct } = useProducts();
  const generatorRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ZasobyReactionFilterValue>("all");
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<(typeof RATIOS)[number]>("720:1280");
  const [style, setStyle] = useState<(typeof STYLES)[number]["value"]>("ugc");
  const [duration, setDuration] = useState(5);
  const [starting, setStarting] = useState(false);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [overlayHeadline, setOverlayHeadline] = useState("");
  const [overlaySubheadline, setOverlaySubheadline] = useState("");
  const [overlayCta, setOverlayCta] = useState("");
  const [overlayPrice, setOverlayPrice] = useState("");
  const pollRef = useRef<number | null>(null);

  const usageEstimate = useMemo(
    () =>
      getVideoUsageEstimate({
        balance: credits.balance ?? 0,
        current_plan: credits.current_plan ?? "free",
        free_ai_usage_usd_cents: credits.free_ai_usage_usd_cents ?? null,
      }),
    [credits.balance, credits.current_plan, credits.free_ai_usage_usd_cents],
  );

  const isFreePlan = (credits.current_plan ?? "free") === "free";

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
          notifyCreditsRefresh();
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

  const startGenerate = async (opts?: { promptOverride?: string; useStoredPrompt?: boolean; replaceFailedId?: string }) => {
    const p = (opts?.promptOverride ?? prompt).trim();
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
    const affordability = checkVideoGenerationAffordability({
      balance: credits.balance ?? 0,
      current_plan: credits.current_plan ?? "free",
      free_ai_usage_usd_cents: credits.free_ai_usage_usd_cents ?? null,
    });
    if (!affordability.allowed) {
      openCreditsUpgrade(affordability.reason);
      toast.error(affordability.reason ?? "Brak kredytów na generację wideo.");
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
          ...(opts?.useStoredPrompt ? { use_stored_prompt: true } : {}),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
        details?: string;
      };
      if (!res.ok) {
        const msg = json.error ?? "Nie udało się uruchomić generacji wideo.";
        if (res.status === 402 || msg.toLowerCase().includes("kredyt") || msg.toLowerCase().includes("limit")) {
          openCreditsUpgrade(json.details ?? msg);
        }
        toast.error(msg, { description: json.details });
        return;
      }
      const id = json.id;
      if (!id) {
        toast.error("Brak identyfikatora zadania.");
        return;
      }
      if (opts?.replaceFailedId) {
        await supabase.from("generated_videos").delete().eq("id", opts.replaceFailedId);
        setItems((prev) => prev.filter((x) => x.id !== opts.replaceFailedId));
      }
      toast.message("Zadanie wideo w kolejce — przetwarzanie w tle…");
      if (!opts?.promptOverride) setPrompt("");
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

  function scrollToGenerator() {
    generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      const ta = generatorRef.current?.querySelector("textarea");
      ta?.focus();
    }, 400);
  }

  function applyPromptIdea(idea: (typeof VIDEO_PROMPT_IDEAS)[number]) {
    const product = brandProduct?.name?.trim();
    const base = idea.prompt;
    setPrompt(product ? base.replace(/produkt/gi, product).replace(/Produkt/g, product) : base);
    setStyle(idea.style);
    setRatio(idea.ratio);
    scrollToGenerator();
  }

  async function saveVideoToAssets(it: VideoRow) {
    if (!it.video_url) {
      toast.error("Brak pliku wideo — poczekaj na zakończenie generacji.");
      return;
    }
    const r = await saveVideoToProjectAssets({
      videoUrl: it.video_url,
      prompt: it.prompt,
      dbId: it.id,
      productName: brandProduct?.name ?? null,
    });
    if (r.error && !r.id) {
      toast.error(r.error);
      return;
    }
    if (r.url !== it.video_url) {
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, video_url: r.url, status: "succeeded" } : x)));
    }
    toast.success(r.alreadySaved ? "Już w zasobach" : "Zapisano w zasobach");
  }

  function retryFailedVideo(it: VideoRow) {
    if (generating) {
      toast.message("Poczekaj na zakończenie bieżącej generacji.");
      return;
    }
    void startGenerate({
      promptOverride: it.prompt,
      useStoredPrompt: true,
      replaceFailedId: it.id,
    });
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-6xl">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Zasoby</h1>
      <p className="mt-2 text-sm text-muted-foreground">Wideo z galerii — polubienia, nielubienia i edycja w czacie.</p>
      <AssetsTabs />
      <ZasobyReactionFilter value={filter} onChange={setFilter} />

      <div
        ref={generatorRef}
        id="video-generator"
        className="mt-8 rounded-2xl border border-border bg-surface-elevated p-5 md:p-6 shadow-soft space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clapperboard className="h-4 w-4" />
          Generator wideo (wideo bez napisów → tekst jako warstwa)
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Type className="h-4 w-4" /> Tekst jako warstwa (czytelny, ostry)
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={overlayEnabled} onChange={(e) => setOverlayEnabled(e.target.checked)} />
              Włącz
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground">Nagłówek</span>
              <input
                value={overlayHeadline}
                onChange={(e) => setOverlayHeadline(e.target.value)}
                disabled={!overlayEnabled}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Np. Zobacz efekty po 7 dniach"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground">Podtytuł</span>
              <input
                value={overlaySubheadline}
                onChange={(e) => setOverlaySubheadline(e.target.value)}
                disabled={!overlayEnabled}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Np. Naturalnie. Bez filtrów."
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground">CTA</span>
              <input
                value={overlayCta}
                onChange={(e) => setOverlayCta(e.target.value)}
                disabled={!overlayEnabled}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Np. Sprawdź teraz"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground">Cena (opcjonalnie)</span>
              <input
                value={overlayPrice}
                onChange={(e) => setOverlayPrice(e.target.value)}
                disabled={!overlayEnabled}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Np. 49 zł"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Wideo generujemy bez napisów, a tekst nakładamy w aplikacji jako warstwy (podgląd i eksport ekranu).
          </p>
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
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Propozycje promptów — kliknij, aby wstawić</p>
          <div className="flex flex-wrap gap-2">
            {VIDEO_PROMPT_IDEAS.map((idea) => (
              <button
                key={idea.label}
                type="button"
                disabled={generating}
                onClick={() => applyPromptIdea(idea)}
                className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40 disabled:opacity-50 transition-colors"
              >
                {idea.label}
              </button>
            ))}
          </div>
        </div>
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
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) === 10 ? 10 : 5)}
              disabled={generating}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value={5}>5 sekund</option>
              <option value={10}>10 sekund</option>
            </select>
            <span className="text-[11px] text-muted-foreground">Higgsfield obsługuje tylko 5 lub 10 sekund.</span>
          </label>
        </div>
        <div
          className={`rounded-xl border px-3 py-2.5 text-xs space-y-1.5 ${
            usageEstimate.canAfford
              ? "border-border bg-muted/30 text-muted-foreground"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          <p className="font-semibold text-foreground">Estymacja zużycia AI</p>
          <p>
            Ta generacja: <span className="font-semibold text-foreground">{usageEstimate.creditsCost} kredytów</span>{" "}
            (1 klip · {duration} s)
          </p>
          {credits.loading ? (
            <p>Ładowanie salda…</p>
          ) : isFreePlan ? (
            <p>
              Plan Free — pozostało:{" "}
              <span className="font-medium text-foreground">
                {freeUsageCentsToCredits(usageEstimate.freeRemainingCents ?? 0).toLocaleString("pl-PL")} kred.
              </span>
              {usageEstimate.canAfford && usageEstimate.remainingAfter != null ? (
                <>
                  {" "}
                  → po sukcesie ok.{" "}
                  <span className="font-medium text-foreground">{usageEstimate.remainingAfter} kred.</span>
                </>
              ) : null}
            </p>
          ) : (
            <p>
              Saldo: <span className="font-medium text-foreground">{credits.balance ?? 0} kred.</span>
              {usageEstimate.canAfford && usageEstimate.remainingAfter != null ? (
                <>
                  {" "}
                  → po sukcesie ok.{" "}
                  <span className="font-medium text-foreground">{usageEstimate.remainingAfter} kred.</span>
                </>
              ) : null}
            </p>
          )}
          <p className="text-[11px] leading-relaxed opacity-90">
            Kredyty odejmujemy dopiero po udanej generacji. Nieudana próba nie zużywa limitu.
          </p>
          {!usageEstimate.canAfford && usageEstimate.reason ? (
            <p className="font-medium">{usageEstimate.reason}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void startGenerate()}
          disabled={generating || !prompt.trim() || !usageEstimate.canAfford}
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
                    <>
                      <video
                        src={it.video_url}
                        controls
                        playsInline
                        className="absolute inset-0 w-full h-full object-contain"
                      />
                      {overlayEnabled && (overlayHeadline || overlaySubheadline || overlayCta || overlayPrice) && (
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/65" />
                          <div className="absolute left-3 right-3 top-3 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
                            {overlayHeadline ? <div className="text-lg font-extrabold leading-tight">{overlayHeadline}</div> : null}
                            {overlaySubheadline ? <div className="mt-1 text-sm opacity-90">{overlaySubheadline}</div> : null}
                          </div>
                          <div className="absolute left-3 right-3 bottom-3 flex items-center justify-between gap-3 text-white">
                            <div className="text-base font-extrabold">{overlayPrice}</div>
                            {overlayCta ? (
                              <div className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-extrabold text-black">
                                {overlayCta}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center px-4 py-8 text-muted-foreground text-sm">
                      {it.status === "failed" ? (
                        <div className="space-y-2">
                          <span className="text-destructive block text-left">{friendlyVideoError(it.error_detail)}</span>
                          <span className="text-xs text-muted-foreground block text-left">
                            Nie ma pliku wideo do zapisania — tylko udana generacja trafia do zasobów. Usuń wpis lub
                            spróbuj ponownie.
                          </span>
                        </div>
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
                      <>
                        <button
                          type="button"
                          title="Zapisz do zasobów"
                          onClick={() => void saveVideoToAssets(it)}
                          className="h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                        >
                          <FolderOpen className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Pobierz na dysk"
                          onClick={() =>
                            void downloadMediaWithToast(it.video_url!, {
                              filenameBase: `wideo-${it.id.slice(0, 8)}`,
                              kind: "video",
                            })
                          }
                          className="h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Edytuj w czacie"
                          onClick={() => openInAgent(it)}
                          className="h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                        >
                          <MessageSquareText className="h-4 w-4" />
                        </button>
                      </>
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
                <div className="p-3 space-y-2">
                  <p className="text-sm font-medium line-clamp-3">{it.prompt}</p>
                  <GeneratedVideoToolbar
                    videoUrl={it.video_url}
                    dbId={it.id}
                    prompt={it.prompt}
                    status={it.status}
                    productName={brandProduct?.name ?? null}
                    onOpenInAgent={() => openInAgent(it)}
                    onSaved={({ url }) => {
                      setItems((prev) =>
                        prev.map((x) => (x.id === it.id ? { ...x, video_url: url, status: "succeeded" } : x)),
                      );
                    }}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(it.created_at).toLocaleString("pl-PL")} · {it.status}
                  </p>
                  {it.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => retryFailedVideo(it)}
                      disabled={generating}
                      className="inline-flex items-center gap-1 text-xs text-accent font-medium hover:opacity-80 disabled:opacity-50"
                    >
                      <Video className="h-3 w-3" />
                      Spróbuj ponownie
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
