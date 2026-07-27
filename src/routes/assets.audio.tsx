import { createFileRoute } from "@tanstack/react-router";
import { Download, Heart, Loader2, Mic, Music, ThumbsDown, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AssetsTabs } from "@/components/AssetsTabs";
import { ZasobyReactionFilter, type ZasobyReactionFilterValue } from "@/components/ZasobyReactionFilter";
import { useCreditsUpgrade } from "@/contexts/CreditsUpgradeContext";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { supabaseEdgeFunctionUrl } from "@/integrations/supabase/publicEnv";
import { supabaseFnHeaders } from "@/lib/supabaseFnHeaders";
import { downloadMediaWithToast } from "@/lib/downloadMedia";
import { notifyCreditsRefresh } from "@/lib/creditsRefresh";
import { freeUsageCentsToCredits } from "@/lib/creditUsageDisplay";
import { checkAudioGenerationAffordability, getAudioUsageEstimate } from "@/lib/audioCreditsGate";
import { useProducts } from "@/hooks/useProducts";
import { toast } from "sonner";
import { toastSupabaseLoadError } from "@/lib/supabaseSchemaHint";

export const Route = createFileRoute("/assets/audio")({
  head: () => ({ meta: [{ title: "Zasoby — dźwięk — MarketingNow" }] }),
  component: AudioAssetsPage,
});

const AUDIO_FN = supabaseEdgeFunctionUrl("generate-audio");

type Reaction = "none" | "like" | "dislike";

type AudioRow = {
  id: string;
  prompt: string;
  audio_url: string | null;
  voice: string | null;
  voice_name: string | null;
  status: string;
  error_detail: string | null;
  created_at: string;
  user_reaction: Reaction;
};

// Wielojęzyczne głosy ElevenLabs (obsługują polski).
const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (kobieta, ciepły)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah (kobieta, młody)" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura (kobieta, energiczny)" },
  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria (kobieta, ekspresyjny)" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George (mężczyzna, dojrzały)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam (mężczyzna, narrator)" },
  { id: "bIHbv24MWmeRgasZH58", name: "Will (mężczyzna, swobodny)" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie (mężczyzna, naturalny)" },
] as const;

const MODELS = [
  { id: "eleven_multilingual_v2", label: "Multilingual v2 (najlepsza jakość, PL)" },
  { id: "eleven_turbo_v2_5", label: "Turbo v2.5 (szybki, PL)" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5 (najszybszy)" },
] as const;

const AUDIO_IDEAS: { label: string; text: string }[] = [
  {
    label: "Lektor reklamy produktu",
    text:
      "Poznaj nasze nowe serum, które wygładza skórę już po siedmiu dniach. Naturalne składniki, widoczne efekty. Sprawdź sam i poczuj różnicę.",
  },
  {
    label: "Hook do reelsa / TikToka",
    text:
      "Przestań marnować pieniądze na kosmetyki, które nie działają. Mam dla ciebie coś, co naprawdę zmieni twoją pielęgnację.",
  },
  {
    label: "Spot promocyjny",
    text:
      "Tylko w ten weekend! Wszystkie produkty taniej o trzydzieści procent. Nie przegap okazji — wejdź na naszą stronę już teraz.",
  },
];

function AudioAssetsPage() {
  const { openCreditsUpgrade } = useCreditsUpgrade();
  const credits = useCredits();
  const { active: brandProduct } = useProducts();
  const generatorRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<AudioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ZasobyReactionFilterValue>("all");
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState<string>(VOICES[0].id);
  const [modelId, setModelId] = useState<string>(MODELS[0].id);
  const [generating, setGenerating] = useState(false);

  const usageEstimate = useMemo(
    () =>
      getAudioUsageEstimate({
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
      .from("generated_audios")
      .select("id,prompt,audio_url,voice,voice_name,status,error_detail,created_at,user_reaction")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false });
    if (filter === "all") q = q.or("user_reaction.is.null,user_reaction.eq.none,user_reaction.eq.like");
    else if (filter === "like") q = q.eq("user_reaction", "like");
    else q = q.eq("user_reaction", "dislike");
    const { data, error } = await q;
    if (error) {
      toastSupabaseLoadError(error, "dźwięk / generated_audios");
      setItems([]);
    } else {
      setItems((data as AudioRow[]) ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const setReaction = async (it: AudioRow, r: Reaction) => {
    const { error } = await supabase.from("generated_audios").update({ user_reaction: r }).eq("id", it.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  };

  const startGenerate = async (override?: string) => {
    const t = (override ?? text).trim();
    if (!t) {
      toast.error("Wpisz tekst do wygenerowania głosu.");
      return;
    }
    if (!AUDIO_FN) {
      toast.error("Brak adresu Supabase — nie można uruchomić generacji.");
      return;
    }
    const headers = await supabaseFnHeaders();
    if (!headers) {
      toast.error("Zaloguj się, aby generować dźwięk.");
      return;
    }
    const affordability = checkAudioGenerationAffordability({
      balance: credits.balance ?? 0,
      current_plan: credits.current_plan ?? "free",
      free_ai_usage_usd_cents: credits.free_ai_usage_usd_cents ?? null,
    });
    if (!affordability.allowed) {
      openCreditsUpgrade(affordability.reason);
      toast.error(affordability.reason ?? "Brak kredytów na generację dźwięku.");
      return;
    }
    setGenerating(true);
    try {
      const voiceName = VOICES.find((v) => v.id === voiceId)?.name ?? null;
      const res = await fetch(AUDIO_FN, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: t,
          voiceId,
          voiceName,
          modelId,
          productName: brandProduct?.name ?? null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { audio?: AudioRow; error?: string; details?: string };
      if (!res.ok) {
        const msg = json.error ?? "Nie udało się wygenerować dźwięku.";
        if (res.status === 402 || msg.toLowerCase().includes("kredyt") || msg.toLowerCase().includes("limit")) {
          openCreditsUpgrade(json.details ?? msg);
        }
        toast.error(msg, { description: json.details });
        await load();
        return;
      }
      if (json.audio?.status === "succeeded") {
        toast.success("Dźwięk gotowy.");
      } else {
        toast.error(json.audio?.error_detail ?? "Generacja nie powiodła się.");
      }
      notifyCreditsRefresh();
      if (!override) setText("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd sieci.");
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (it: AudioRow) => {
    if (!confirm("Usunąć ten dźwięk z biblioteki?")) return;
    if (it.audio_url && it.id) {
      const pathMatch = /\/generations\/(.+)$/.exec(it.audio_url);
      const path = pathMatch?.[1];
      if (path) await supabase.storage.from("generations").remove([decodeURIComponent(path)]);
    }
    const { error } = await supabase.from("generated_audios").delete().eq("id", it.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Usunięto");
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    }
  };

  function applyIdea(idea: (typeof AUDIO_IDEAS)[number]) {
    const product = brandProduct?.name?.trim();
    setText(product ? idea.text.replace(/serum|produkt(y|ów)?/gi, product) : idea.text);
    generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="px-6 md:px-10 py-10 max-w-6xl">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Zasoby</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Generuj lektora i głos do reklam (ElevenLabs) — polubienia, pobieranie i ponowne użycie.
      </p>
      <AssetsTabs />
      <ZasobyReactionFilter value={filter} onChange={setFilter} />

      <div
        ref={generatorRef}
        id="audio-generator"
        className="mt-8 rounded-2xl border border-border bg-surface-elevated p-5 md:p-6 shadow-soft space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Mic className="h-4 w-4" />
          Generator dźwięku (text-to-speech)
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium">Tekst do przeczytania</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={generating}
            maxLength={5000}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[110px]"
            placeholder="Np. Poznaj nasze nowe serum, które wygładza skórę już po 7 dniach…"
          />
          <span className="text-[11px] text-muted-foreground">{text.length}/5000 znaków</span>
        </label>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Propozycje tekstów — kliknij, aby wstawić</p>
          <div className="flex flex-wrap gap-2">
            {AUDIO_IDEAS.map((idea) => (
              <button
                key={idea.label}
                type="button"
                disabled={generating}
                onClick={() => applyIdea(idea)}
                className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/40 disabled:opacity-50 transition-colors"
              >
                {idea.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">Głos</span>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              disabled={generating}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">Model</span>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              disabled={generating}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
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
            (1 nagranie)
          </p>
          {credits.loading ? (
            <p>Ładowanie salda…</p>
          ) : isFreePlan ? (
            <p>
              Plan Free — pozostało:{" "}
              <span className="font-medium text-foreground">
                {freeUsageCentsToCredits(usageEstimate.freeRemainingCents ?? 0).toLocaleString("pl-PL")} kred.
              </span>
            </p>
          ) : (
            <p>
              Saldo: <span className="font-medium text-foreground">{credits.balance ?? 0} kred.</span>
              {usageEstimate.canAfford && usageEstimate.remainingAfter != null ? (
                <> → po sukcesie ok. <span className="font-medium text-foreground">{usageEstimate.remainingAfter} kred.</span></>
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
          disabled={generating || !text.trim() || !usageEstimate.canAfford}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Trwa generowanie…
            </>
          ) : (
            <>
              <Music className="h-4 w-4" />
              Generuj dźwięk
            </>
          )}
        </button>
      </div>

      {loading ? (
        <div className="mt-8 text-sm text-muted-foreground">Ładowanie biblioteki…</div>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "dislike"
              ? "Brak pozycji w nielubianych."
              : filter === "like"
                ? "Brak polubionych nagrań."
                : "Brak nagrań. Wygeneruj pierwszy dźwięk powyżej."}
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Biblioteka dźwięku</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((it) => (
              <div key={it.id} className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-soft space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium line-clamp-3">{it.prompt}</p>
                    {it.voice_name ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">Głos: {it.voice_name}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      title="Polub"
                      onClick={() => void setReaction(it, it.user_reaction === "like" ? "none" : "like")}
                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        it.user_reaction === "like" ? "bg-rose-500 text-white" : "bg-muted text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${it.user_reaction === "like" ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      title="Nielubiane"
                      onClick={() => void setReaction(it, it.user_reaction === "dislike" ? "none" : "dislike")}
                      className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        it.user_reaction === "dislike" ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(it)}
                      className="h-8 w-8 rounded-full bg-muted text-foreground flex items-center justify-center hover:bg-muted/70"
                      aria-label="Usuń"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {it.status === "succeeded" && it.audio_url ? (
                  <div className="space-y-2">
                    <audio src={it.audio_url} controls className="w-full" />
                    <button
                      type="button"
                      onClick={() =>
                        void downloadMediaWithToast(it.audio_url!, {
                          filenameBase: `dzwiek-${it.id.slice(0, 8)}`,
                          kind: "audio",
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Pobierz MP3
                    </button>
                  </div>
                ) : it.status === "failed" ? (
                  <p className="text-xs text-destructive">{it.error_detail ?? "Generacja nie powiodła się."}</p>
                ) : (
                  <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Przetwarzanie…
                  </p>
                )}

                <p className="text-[11px] text-muted-foreground">
                  {new Date(it.created_at).toLocaleString("pl-PL")} · {it.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
