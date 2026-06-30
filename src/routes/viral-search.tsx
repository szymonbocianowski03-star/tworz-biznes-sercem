import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Search } from "lucide-react";
import { AppBackLink } from "@/components/AppBackLink";
import {
  ViralShortCard,
  type SavedViralShortRow,
  type ViralPlatform,
  type ViralShortItem,
} from "@/components/ViralShortCard";
import { ViralFiltersBar } from "@/components/virals/ViralFiltersBar";
import { useAuthSession } from "@/hooks/useAuthSession";
import { supabase } from "@/integrations/supabase/client";
import { searchVirals } from "@/lib/apify.functions";
import {
  applyViralFilters,
  DEFAULT_VIRAL_FILTERS,
  type ViralSearchFilters,
} from "@/lib/viralFilters";

type ViralSearchParams = { q?: string; tab?: "search" | "saved" };
type ResultsView = "all" | "winners";

export const Route = createFileRoute("/viral-search")({
  head: () => ({
    meta: [{ title: "Virale — MarketingNow" }],
  }),
  validateSearch: (raw: Record<string, unknown>): ViralSearchParams => {
    const q = raw.q;
    const t = raw.tab;
    const tab = t === "saved" ? "saved" : "search";
    const out: ViralSearchParams = { tab };
    if (typeof q === "string" && q.trim()) out.q = q.trim();
    return out;
  },
  component: ViralSearchPage,
});

function savedToItem(row: SavedViralShortRow): ViralShortItem {
  return {
    title: row.title,
    author: row.author,
    url: row.url,
    thumbnail: row.thumbnail,
    views: row.views,
    likes: row.likes,
    createdAt: row.created_at,
    mediaType: "video",
  };
}

function ViralSearchPage() {
  const { q: qFromUrl, tab: tabFromUrl } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const fn = useServerFn(searchVirals);
  const [platform, setPlatform] = useState<ViralPlatform>("tiktok");
  const [query, setQuery] = useState("");
  const [resultsView, setResultsView] = useState<ResultsView>("all");
  const [filters, setFilters] = useState<ViralSearchFilters>(DEFAULT_VIRAL_FILTERS);
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  const tab = tabFromUrl === "saved" ? "saved" : "search";

  useEffect(() => {
    if (qFromUrl) setQuery(qFromUrl);
  }, [qFromUrl]);

  const setTab = useCallback(
    (next: "search" | "saved") => {
      const q = query.trim();
      navigate({
        to: "/viral-search",
        search: {
          tab: next,
          ...(q ? { q } : {}),
        },
      });
    },
    [navigate, query],
  );

  const [rawItems, setRawItems] = useState<ViralShortItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedRows, setSavedRows] = useState<SavedViralShortRow[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  const refreshSaved = useCallback(async () => {
    if (!user?.id) {
      setSavedRows([]);
      return;
    }
    setSavedLoading(true);
    try {
      const { data, error } = await supabase
        .from("saved_viral_shorts")
        .select("id,platform,url,title,author,thumbnail,views,likes,search_query,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) {
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          setSavedRows([]);
        }
        return;
      }
      setSavedRows((data ?? []) as SavedViralShortRow[]);
    } finally {
      setSavedLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved, tab]);

  const savedByUrl = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of savedRows) m.set(r.url, r.id);
    return m;
  }, [savedRows]);

  const filteredSearchItems = useMemo(
    () =>
      applyViralFilters(rawItems, filters, {
        winnersOnly: resultsView === "winners",
        searchQuery: query.trim(),
      }),
    [rawItems, filters, resultsView, query],
  );

  const filteredSavedItems = useMemo(() => {
    const asItems = savedRows.map(savedToItem);
    return applyViralFilters(asItems, filters, { winnersOnly: resultsView === "winners" });
  }, [savedRows, filters, resultsView]);

  const displayItems = tab === "search" ? filteredSearchItems : filteredSavedItems;
  const displayCount = displayItems.length;

  const search = async () => {
    if (!query.trim()) return;
    navigate({ to: "/viral-search", search: { tab: "search", q: query.trim() } });
    setLoading(true);
    setErr(null);
    setRawItems([]);
    const res = await fn({ data: { platform, query: query.trim(), limit: 30 } });
    setRawItems(res.items as ViralShortItem[]);
    setErr(res.error);
    setLoading(false);
  };

  const gridClass =
    layout === "grid"
      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      : "flex flex-col gap-3 max-w-3xl";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-6 py-8">
      <AppBackLink className="mb-4" />

      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-500" /> Virale
            {tab === "search" && rawItems.length > 0 ? (
              <span className="text-base font-semibold text-muted-foreground tabular-nums">
                {filteredSearchItems.length}
                {filteredSearchItems.length !== rawItems.length ? ` / ${rawItems.length}` : ""}
              </span>
            ) : null}
            {tab === "saved" && savedRows.length > 0 ? (
              <span className="text-base font-semibold text-muted-foreground tabular-nums">
                {filteredSavedItems.length}
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Szukaj w TikTok, Instagram i YouTube Shorts. Filtruj po wyświetleniach, długości, wieku publikacji i słowach w
            opisie — jak w bibliotece reklam, na danych z sociali.
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tab === "search" && void search()}
            placeholder={
              platform === "youtube"
                ? "Szukaj filmów… np. AI marketing tips"
                : "Szukaj hashtag / słów kluczowych…"
            }
            className="w-full rounded-full border border-border bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        {tab === "search" ? (
          <button
            type="button"
            onClick={() => void search()}
            disabled={loading || !query.trim()}
            className="shrink-0 inline-flex items-center justify-center gap-1 rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Szukam…" : "Szukaj"}
          </button>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-border p-0.5 bg-muted/40">
          <button
            type="button"
            onClick={() => setTab("search")}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
              tab === "search" ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Wszystkie
          </button>
          <button
            type="button"
            onClick={() => setTab("saved")}
            className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors inline-flex items-center gap-2 ${
              tab === "saved" ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Zapisane
            {savedRows.length > 0 ? (
              <span
                className={`tabular-nums rounded-full px-2 py-0.5 text-[11px] ${
                  tab === "saved" ? "bg-white/20" : "bg-foreground/10"
                }`}
              >
                {savedRows.length}
              </span>
            ) : null}
          </button>
        </div>

        <div className="inline-flex rounded-full border border-border p-0.5 bg-muted/40">
          <button
            type="button"
            onClick={() => setResultsView("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
              resultsView === "all" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Wszystkie wyniki
          </button>
          <button
            type="button"
            onClick={() => setResultsView("winners")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
              resultsView === "winners" ? "bg-emerald-500/15 text-emerald-800 border border-emerald-500/30" : "text-muted-foreground"
            }`}
          >
            Top virale
          </button>
        </div>

        <div className="inline-flex rounded-full border border-border p-0.5 bg-muted/40 ml-auto">
          {(["tiktok", "instagram", "youtube"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
                platform === p ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              {p === "tiktok" ? "TikTok" : p === "instagram" ? "Instagram" : "YouTube"}
            </button>
          ))}
        </div>
      </div>

      <ViralFiltersBar
        filters={filters}
        onChange={setFilters}
        resultCount={displayCount}
        layout={layout}
        onLayoutChange={setLayout}
      />

      {err && (
        <div className="rounded-md border border-red-500/30 bg-red-50 text-red-800 px-4 py-3 text-sm mb-4">{err}</div>
      )}

      {tab === "search" ? (
        <>
          {rawItems.length === 0 && !loading && !err && (
            <p className="text-sm text-muted-foreground mt-4">
              Wpisz frazę i naciśnij Szukaj. Użyj filtrów, że zawęzić wyniki — np. min. 10k wyświetleń, max. 60 s wideo.
            </p>
          )}

          {rawItems.length > 0 && filteredSearchItems.length === 0 && !loading && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-4 py-3 mt-4">
              Brak wyników po filtrach ({rawItems.length} pobrano). Poluzuj filtry lub zmień widok „Top virale”.
            </p>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Pobieram virale z {platform}…</p>
          ) : (
            <div className={`mt-6 ${gridClass}`}>
              {filteredSearchItems.map((it, i) => (
                <ViralShortCard
                  key={`${it.url}-${i}`}
                  item={it}
                  platform={platform}
                  searchQuery={query.trim() || undefined}
                  savedRowId={savedByUrl.get(it.url) ?? null}
                  onMutated={() => void refreshSaved()}
                  afterSave={() => setTab("saved")}
                  compact={layout === "list"}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <section className="mt-6 rounded-xl border border-border bg-muted/15 p-4 md:p-6">
          {!user ? (
            <div className="text-center py-10 max-w-md mx-auto">
              <p className="text-sm text-muted-foreground">
                Zaloguj się, żeby zapisywać virale z wyszukiwania i widzieć je tutaj.
              </p>
              <Link
                to="/auth"
                className="mt-4 inline-flex rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90"
              >
                Zaloguj się
              </Link>
            </div>
          ) : savedLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Ładowanie zapisanych…</p>
          ) : savedRows.length === 0 ? (
            <div className="text-center py-10 max-w-md mx-auto">
              <p className="text-sm text-muted-foreground">
                Nie masz jeszcze zapisanych virali. Wyszukaj rolki i kliknij zakładkę na karcie.
              </p>
              <button
                type="button"
                onClick={() => setTab("search")}
                className="mt-4 text-sm font-semibold text-foreground underline-offset-2 hover:underline"
              >
                Przejdź do wyszukiwania
              </button>
            </div>
          ) : filteredSavedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Żaden zapisany viral nie pasuje do filtrów. Wyczyść filtry powyżej.
            </p>
          ) : (
            <div className={gridClass}>
              {savedRows
                .filter((row) => filteredSavedItems.some((it) => it.url === row.url))
                .map((row) => (
                  <ViralShortCard
                    key={row.id}
                    item={savedToItem(row)}
                    platform={row.platform}
                    searchQuery={row.search_query ?? undefined}
                    savedRowId={row.id}
                    onMutated={() => void refreshSaved()}
                    compact={layout === "list"}
                  />
                ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
