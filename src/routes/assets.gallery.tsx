import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, Heart, MessageSquareText, Sparkles, ThumbsDown, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AssetsTabs } from "@/components/AssetsTabs";
import { AssetsToolbar } from "@/components/AssetsToolbar";
import { GeneratedImageToolbar } from "@/components/GeneratedImageToolbar";
import { ZasobyReactionFilter, type ZasobyReactionFilterValue } from "@/components/ZasobyReactionFilter";
import { supabase } from "@/integrations/supabase/client";
import { buildAssetAgentPrompt, setAssetAgentSeed } from "@/lib/assetAgentSeed";
import { toast } from "sonner";
import { toastSupabaseLoadError } from "@/lib/supabaseSchemaHint";

export const Route = createFileRoute("/assets/gallery")({
  head: () => ({ meta: [{ title: "Zasoby — obrazy — MarketingNow" }] }),
  component: GalleryPage,
});

type Reaction = "none" | "like" | "dislike";

type Item = {
  id: string;
  prompt: string;
  image_url: string;
  storage_path: string | null;
  size: string | null;
  created_at: string;
  product_name: string | null;
  campaign_name: string | null;
  feedback_note: string | null;
  report_reason: string | null;
  reported_at: string | null;
  user_reaction: Reaction;
};

function GalleryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ZasobyReactionFilterValue>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setItems([]);
      setLoading(false);
      return;
    }
    let q = supabase.from("generated_images").select("*").order("created_at", { ascending: false });
    if (filter === "all") q = q.neq("user_reaction", "dislike");
    else if (filter === "like") q = q.eq("user_reaction", "like");
    else q = q.eq("user_reaction", "dislike");
    const { data, error } = await q;
    if (error) {
      toastSupabaseLoadError(error, "obrazy / generated_images");
      setItems([]);
    } else {
      setItems((data as unknown as Item[]) ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const setReaction = async (it: Item, r: Reaction) => {
    const { error } = await supabase.from("generated_images").update({ user_reaction: r }).eq("id", it.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  };

  const openInAgent = (it: Item) => {
    setAssetAgentSeed({
      kind: "image",
      mediaUrl: it.image_url,
      text: buildAssetAgentPrompt("image", it.prompt, it.image_url),
    });
    void navigate({ to: "/agent" });
    toast.message("Otwarto czat — wiadomość z obrazem została dodana.");
  };

  const remove = async (it: Item) => {
    if (!confirm("Usunąć tę kreację na stałe?")) return;
    if (it.storage_path) {
      await supabase.storage.from("generations").remove([it.storage_path]);
    }
    const { error } = await supabase.from("generated_images").delete().eq("id", it.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Usunięto");
      setItems((prev) => prev.filter((x) => x.id !== it.id));
    }
  };

  return (
    <div className="px-6 md:px-10 py-10 max-w-6xl">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Zasoby</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Biblioteka grafik — podgląd, data, opis promptu, powiązany produkt i kampania.
      </p>
      <AssetsTabs />
      <ZasobyReactionFilter value={filter} onChange={setFilter} />
      <AssetsToolbar placeholder="Szukaj kreacji..." ctaLabel="Nowa kreacja" />

      {loading ? (
        <div className="mt-8 text-sm text-muted-foreground">Ładowanie…</div>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "dislike"
              ? "Brak pozycji w nielubianych."
              : filter === "like"
                ? "Brak polubionych. Użyj serca przy kreacji."
                : "Brak kreacji. Wygeneruj pierwszą w "}
            {filter === "all" && (
              <>
                <Link to="/agent" className="text-accent font-medium hover:opacity-80">
                  czacie z agentem
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((it) => (
            <div
              key={it.id}
              className="group rounded-2xl border border-border bg-surface-elevated overflow-hidden hover:shadow-elevated transition-all"
            >
              <div className="aspect-square relative bg-neutral-100">
                <img
                  src={it.image_url}
                  alt={it.prompt}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {it.size && (
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
                    {it.size}
                  </span>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="Polub"
                      onClick={() => void setReaction(it, it.user_reaction === "like" ? "none" : "like")}
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-sm shadow ${
                        it.user_reaction === "like" ? "bg-rose-500 text-white" : "bg-white/90 text-neutral-700 hover:bg-white"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${it.user_reaction === "like" ? "fill-current" : ""}`} />
                    </button>
                    <button
                      type="button"
                      title="Nielubiane — trafia do kosza"
                      onClick={() => void setReaction(it, it.user_reaction === "dislike" ? "none" : "dislike")}
                      className={`h-8 w-8 rounded-full flex items-center justify-center shadow ${
                        it.user_reaction === "dislike" ? "bg-neutral-800 text-white" : "bg-white/90 text-neutral-700 hover:bg-white"
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
                  <a
                    href={it.image_url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 w-9 rounded-full bg-white/95 text-black flex items-center justify-center hover:bg-white pointer-events-auto"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => openInAgent(it)}
                    className="h-9 w-9 rounded-full bg-white/95 text-black flex items-center justify-center hover:bg-white pointer-events-auto"
                    title="Edytuj w czacie"
                  >
                    <MessageSquareText className="h-4 w-4" />
                  </button>
                  <Link
                    to="/agent"
                    className="h-9 w-9 rounded-full bg-white/95 text-black flex items-center justify-center hover:bg-white pointer-events-auto"
                  >
                    <Sparkles className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => void remove(it)}
                    className="h-9 w-9 rounded-full bg-white/95 text-red-600 flex items-center justify-center hover:bg-white pointer-events-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-3 space-y-2">
                <p className="text-sm font-medium line-clamp-2">{it.prompt}</p>
                <div className="flex flex-wrap gap-1.5">
                  {it.feedback_note && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 border border-emerald-500/25">
                      Opinia
                    </span>
                  )}
                  {it.reported_at && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-900 border border-amber-500/25">
                      Zgłoszono
                    </span>
                  )}
                </div>
                <GeneratedImageToolbar
                  imageUrl={it.image_url}
                  dbId={it.id}
                  prompt={it.prompt}
                  productName={it.product_name}
                  onPromptUpdated={(next) => {
                    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, prompt: next } : x)));
                  }}
                />
                <p className="text-[11px] text-muted-foreground">
                  {new Date(it.created_at).toLocaleString("pl-PL")}
                  {it.product_name ? ` · ${it.product_name}` : ""}
                  {it.campaign_name ? ` · ${it.campaign_name}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
