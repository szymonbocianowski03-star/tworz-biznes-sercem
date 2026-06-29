import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  Copy,
  Crosshair,
  ExternalLink,
  Flame,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Megaphone,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useCreditsUpgrade } from "@/contexts/CreditsUpgradeContext";
import { AppBackLink } from "@/components/AppBackLink";
import {
  ViralShortCard,
  type SavedViralShortRow,
  type ViralShortItem,
} from "@/components/ViralShortCard";
import { useAuthSession } from "@/hooks/useAuthSession";
import { searchVirals } from "@/lib/apify.functions";
import { runCompetitorScan, type RunCompetitorScanResult } from "@/lib/competitorScan.functions";
import { scheduleCreditsRefresh } from "@/lib/creditsRefresh";
import { hasSupabasePublicEnv } from "@/integrations/supabase/publicEnv";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/konkurencja")({
  head: () => ({
    meta: [{ title: "Analiza konkurencji — MarketingNow" }],
  }),
  component: KonkurencjaPage,
});

/** Dopisuje https:// gdy użytkownik podaje samą domenę (tak samo normalizuje Edge). */
function normalizeHttpsUrl(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^\/\//.test(t)) return `https:${t}`;
  if (/^[a-z0-9][a-z0-9._/-]*\.[a-z]{2,}([/?#]|$)/i.test(t)) return `https://${t}`;
  return t;
}

const FOCUS_OPTIONS = [
  { id: "landing", label: "Landing page" },
  { id: "ads", label: "Reklamy Meta / Google / LinkedIn" },
  { id: "seo", label: "SEO" },
  { id: "social", label: "Social media" },
  { id: "shortVideo", label: "Pomysły na krótkie wideo" },
  { id: "llm", label: "LLM Visibility / AI Search" },
  { id: "copy", label: "Copywriting i oferta" },
] as const;

type FocusId = (typeof FOCUS_OPTIONS)[number]["id"];

type SocialRow = { label: string; url: string };

type ScanScores = {
  valueProp: number;
  seoSignals: number;
  socialPresence: number;
  aiVisibilityEst: number;
};

type ScanMetadata = {
  title: string;
  description: string;
  h1: string[];
  h2: string[];
  socialLinks: SocialRow[];
  detectedPixels: string[];
  schemaTypes: string[];
};

type ScanDataQuality = {
  scrapingStatus: "ok" | "partial" | "failed" | "manual" | "unknown";
  warnings: string[];
};

type ScanResult = {
  pageUrl: string;
  title: string;
  description: string;
  images: string[];
  socialLinks: SocialRow[];
  analysisMarkdown: string;
  viralQueries: string[];
  brandGuess: string;
  scores: ScanScores | null;
  summaryBullets: string[];
  landingBullets: string[];
  adsBullets: string[];
  seoBullets: string[];
  socialBullets: string[];
  llmBullets: string[];
  recommendationsBullets: string[];
  industry: string;
  metadata: ScanMetadata;
  dataQuality: ScanDataQuality;
};

type ViralItem = ViralShortItem;

type ResultTabId =
  | "summary"
  | "landing"
  | "ads"
  | "seo"
  | "social"
  | "llm"
  | "recommendations";

type BulletField =
  | "summaryBullets"
  | "landingBullets"
  | "adsBullets"
  | "seoBullets"
  | "socialBullets"
  | "llmBullets"
  | "recommendationsBullets";

const TABS: { id: ResultTabId; label: string; field: BulletField }[] = [
  { id: "summary", label: "Podsumowanie", field: "summaryBullets" },
  { id: "landing", label: "Landing page", field: "landingBullets" },
  { id: "ads", label: "Reklamy", field: "adsBullets" },
  { id: "seo", label: "SEO", field: "seoBullets" },
  { id: "social", label: "Social media", field: "socialBullets" },
  { id: "llm", label: "LLM Visibility", field: "llmBullets" },
  { id: "recommendations", label: "Rekomendacje", field: "recommendationsBullets" },
];

function defaultFocusState(): Record<FocusId, boolean> {
  return Object.fromEntries(FOCUS_OPTIONS.map((o) => [o.id, true])) as Record<FocusId, boolean>;
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];
}

function normalizeMetadata(raw: unknown): ScanMetadata {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const social = Array.isArray(m.socialLinks)
    ? (m.socialLinks as unknown[])
        .map((s) => {
          if (s && typeof s === "object") {
            const o = s as Record<string, unknown>;
            const url = typeof o.url === "string" ? o.url : "";
            const label = typeof o.label === "string" ? o.label : "Social";
            return url ? { label, url } : null;
          }
          if (typeof s === "string") return { label: "Social", url: s };
          return null;
        })
        .filter((x): x is SocialRow => x !== null)
    : [];
  return {
    title: typeof m.title === "string" ? m.title : "",
    description: typeof m.description === "string" ? m.description : "",
    h1: asStrings(m.h1),
    h2: asStrings(m.h2),
    socialLinks: social,
    detectedPixels: asStrings(m.detectedPixels),
    schemaTypes: asStrings(m.schemaTypes),
  };
}

function normalizeDataQuality(raw: unknown): ScanDataQuality {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const status = typeof d.scrapingStatus === "string" ? d.scrapingStatus : "unknown";
  const allowed = ["ok", "partial", "failed", "manual", "unknown"] as const;
  const scrapingStatus = (allowed as readonly string[]).includes(status)
    ? (status as ScanDataQuality["scrapingStatus"])
    : "unknown";
  return { scrapingStatus, warnings: asStrings(d.warnings) };
}

function normalizeScanResult(raw: Partial<ScanResult> & { error?: string }): ScanResult {
  return {
    pageUrl: typeof raw.pageUrl === "string" ? raw.pageUrl : "",
    title: typeof raw.title === "string" ? raw.title : "",
    description: typeof raw.description === "string" ? raw.description : "",
    images: Array.isArray(raw.images) ? raw.images : [],
    socialLinks: Array.isArray(raw.socialLinks) ? raw.socialLinks : [],
    analysisMarkdown: typeof raw.analysisMarkdown === "string" ? raw.analysisMarkdown : "",
    viralQueries: Array.isArray(raw.viralQueries) ? raw.viralQueries : [],
    brandGuess: typeof raw.brandGuess === "string" ? raw.brandGuess : "",
    scores: raw.scores && typeof raw.scores === "object" ? (raw.scores as ScanScores) : null,
    summaryBullets: Array.isArray(raw.summaryBullets) ? raw.summaryBullets.filter((x) => typeof x === "string") : [],
    landingBullets: Array.isArray(raw.landingBullets) ? raw.landingBullets.filter((x) => typeof x === "string") : [],
    adsBullets: Array.isArray(raw.adsBullets) ? raw.adsBullets.filter((x) => typeof x === "string") : [],
    seoBullets: Array.isArray(raw.seoBullets) ? raw.seoBullets.filter((x) => typeof x === "string") : [],
    socialBullets: Array.isArray(raw.socialBullets) ? raw.socialBullets.filter((x) => typeof x === "string") : [],
    llmBullets: Array.isArray(raw.llmBullets) ? raw.llmBullets.filter((x) => typeof x === "string") : [],
    recommendationsBullets: Array.isArray(raw.recommendationsBullets)
      ? raw.recommendationsBullets.filter((x) => typeof x === "string")
      : [],
    industry: typeof raw.industry === "string" ? raw.industry : "",
    metadata: normalizeMetadata(raw.metadata),
    dataQuality: normalizeDataQuality(raw.dataQuality),
  };
}

function ScoreMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${value}%` }} />
        </div>
        <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
      </div>
    </div>
  );
}

function InsightList({ items, emptyHint }: { items: string[]; emptyHint: string }) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{emptyHint}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-sm leading-snug text-foreground">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/70" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

/** Grafiki ze strony: absolutne URL, obsługa onError, max kilka najlepszych grafik. */
function SiteImages({ images }: { images: string[] }) {
  const candidates = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const src of images) {
      if (typeof src !== "string") continue;
      const url = src.trim();
      if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
      if (out.length >= 6) break;
    }
    return out;
  }, [images]);

  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const visible = candidates.filter((src) => !broken[src]);
  const allFailed = candidates.length > 0 && visible.length === 0;

  return (
    <section className="rounded-2xl border border-border bg-background p-5 md:p-6 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
        <ImageIcon className="h-4 w-4" />
        Grafiki ze strony
      </h2>
      {candidates.length === 0 || allFailed ? (
        <p className="text-sm text-muted-foreground">
          {candidates.length === 0
            ? "Nie znaleziono dostępnych grafik do wyświetlenia."
            : "Nie udało się wyświetlić tej grafiki — host może blokować hotlink albo adres obrazka jest niedostępny."}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Najważniejsze grafiki (logo, og:image, hero). Część hostów może blokować hotlink.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {visible.map((src, i) => (
              <a
                key={`${src}-${i}`}
                href={src}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border overflow-hidden bg-muted/30 aspect-video block hover:opacity-90"
              >
                <img
                  src={src}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setBroken((prev) => ({ ...prev, [src]: true }))}
                />
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function PreviewReportCards() {
  const cards = [
    {
      title: "Pozycjonowanie konkurenta",
      body: "Mocny nacisk na automatyzację kampanii i oszczędność czasu — mniej na transparentność danych.",
    },
    {
      title: "Główne obietnice marketingowe",
      body: "„Szybciej”, „bez agencji”, integracje z kalendarzem — brak wyraźnego komunikatu o widoczności w AI.",
    },
    { title: "Mocne strony", body: "Czytelny landing, social proof, spójny ton sprzedażowy." },
    { title: "Słabe strony", body: "Mało treści edukacyjnych SEO, słaba warstwa „dlaczego my” vs alternatywy." },
    {
      title: "Szanse dla Twojej marki",
      body: "Konkurent mocno komunikuje automatyzację kampanii, ale słabo pokazuje LLM Visibility. MarketingNow może wyróżnić się jako centrum pracy marketingowej łączące reklamy, SEO, maile, kalendarz i widoczność marki w AI.",
    },
    { title: "Pomysły na kampanie", body: "Kąt edukacyjny + case „przed/po”, test porównawczy narzędzi, lead magnet z audytem." },
    {
      title: "Co skopiować, czego unikać",
      body: "Warto skopiować hierarchię CTA; unikać przeładowania obietnic bez dowodów.",
    },
  ];
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Podgląd raportu</p>
      <div className="space-y-3 max-h-[min(70vh,720px)] overflow-y-auto pr-2 pb-3 mn-scrollbar [scrollbar-gutter:stable]">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-border bg-background p-4 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]"
          >
            <h3 className="text-sm font-semibold text-foreground">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function KonkurencjaPage() {
  const { openCreditsUpgrade } = useCreditsUpgrade();
  const { user } = useAuthSession();
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [compareUrl, setCompareUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [focus, setFocus] = useState<Record<FocusId, boolean>>(defaultFocusState);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTabId>("summary");

  type CompetitorRow = {
    id: string;
    name: string | null;
    url: string;
    created_at: string;
    updated_at: string;
  };
  type CompetitorReportRow = {
    id: string;
    competitor_id: string | null;
    competitor_url: string;
    industry: string | null;
    compare_url: string | null;
    focus: unknown | null;
    manual_text: string | null;
    result: unknown;
    created_at: string;
  };

  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [activeCompetitorId, setActiveCompetitorId] = useState<string | null>(null);
  const [reportsByCompetitor, setReportsByCompetitor] = useState<Record<string, CompetitorReportRow[]>>({});
  const competitorsWithReports = useMemo(
    () => competitors.filter((c) => (reportsByCompetitor[c.id]?.length ?? 0) > 0),
    [competitors, reportsByCompetitor],
  );
  const competitorsWithoutReports = useMemo(
    () => competitors.filter((c) => !(reportsByCompetitor[c.id]?.length ?? 0)),
    [competitors, reportsByCompetitor],
  );

  const viralFn = useServerFn(searchVirals);
  const competitorScanFn = useServerFn(runCompetitorScan);
  const [viralPlatform, setViralPlatform] = useState<"tiktok" | "instagram" | "youtube">("tiktok");
  const [viralQuery, setViralQuery] = useState("");
  const [viralLoading, setViralLoading] = useState(false);
  const [viralItems, setViralItems] = useState<ViralItem[]>([]);
  const [viralErr, setViralErr] = useState<string | null>(null);
  const [savedRows, setSavedRows] = useState<SavedViralShortRow[]>([]);

  const refreshSaved = useCallback(async () => {
    if (!user?.id) {
      setSavedRows([]);
      return;
    }
    const { data, error } = await supabase
      .from("saved_viral_shorts")
      .select("id,platform,url,title,author,thumbnail,views,likes,search_query,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) setSavedRows((data ?? []) as SavedViralShortRow[]);
  }, [user?.id]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const refreshCompetitors = useCallback(async () => {
    if (!user?.id) {
      setCompetitors([]);
      setActiveCompetitorId(null);
      return;
    }
    const { data, error } = await supabase
      .from("competitors")
      .select("id,name,url,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return;
    const list = (data ?? []) as CompetitorRow[];
    setCompetitors(list);
    if (!list.some((c) => c.id === activeCompetitorId)) {
      setActiveCompetitorId(list[0]?.id ?? null);
    } else if (!activeCompetitorId && list.length) {
      setActiveCompetitorId(list[0].id);
    }
  }, [user?.id, activeCompetitorId]);

  const refreshAllReports = useCallback(async () => {
    if (!user?.id) {
      setReportsByCompetitor({});
      return;
    }
    const { data, error } = await supabase
      .from("competitor_reports")
      .select("id,competitor_id,competitor_url,industry,compare_url,focus,manual_text,result,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return;
    const grouped: Record<string, CompetitorReportRow[]> = {};
    for (const row of (data ?? []) as CompetitorReportRow[]) {
      if (!row.competitor_id) continue;
      if (!grouped[row.competitor_id]) grouped[row.competitor_id] = [];
      grouped[row.competitor_id].push(row);
    }
    setReportsByCompetitor(grouped);
  }, [user?.id]);

  useEffect(() => {
    void refreshCompetitors();
    void refreshAllReports();
  }, [refreshCompetitors, refreshAllReports]);

  const viralSavedByUrl = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of savedRows) m.set(r.url, r.id);
    return m;
  }, [savedRows]);

  const focusAreas = useMemo(
    () => FOCUS_OPTIONS.filter((o) => focus[o.id]).map((o) => o.id),
    [focus],
  );

  const toggleFocus = (id: FocusId) => {
    setFocus((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const anyOn = FOCUS_OPTIONS.some((o) => next[o.id]);
      if (!anyOn) return prev;
      return next;
    });
  };

  const ensureCompetitorForUrl = useCallback(async (url: string): Promise<CompetitorRow | null> => {
    if (!user?.id) return null;
    const normalized = normalizeHttpsUrl(url);
    if (!normalized) return null;
    let hostname = "";
    try {
      hostname = new URL(normalized).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return null;
    }

    const { data: allForUser } = await supabase
      .from("competitors")
      .select("id,name,url,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const existing = (allForUser ?? []).find((row) => {
      try {
        return new URL(row.url).hostname.replace(/^www\./i, "").toLowerCase() === hostname;
      } catch {
        return row.url === normalized;
      }
    });
    if (existing) return existing as CompetitorRow;

    const guessName = (() => {
      try {
        const u = new URL(normalized);
        return u.hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    })();
    const { data: inserted, error } = await supabase
      .from("competitors")
      .insert({ user_id: user.id, url: normalized, name: guessName })
      .select("id,name,url,created_at,updated_at")
      .single();
    if (error) return null;
    return inserted as CompetitorRow;
  }, [user?.id]);

  const deleteCompetitor = useCallback(
    async (competitorId: string) => {
      if (!user?.id) {
        toast.error("Zaloguj się, aby usuwać konkurentów.");
        return;
      }
      const comp = competitors.find((c) => c.id === competitorId);
      if (!comp) return;
      const label = comp.name ?? comp.url.replace(/^https?:\/\//, "");
      if (!window.confirm(`Usunąć konkurenta „${label}” wraz z jego raportami?`)) return;

      const { error: reportsError } = await supabase
        .from("competitor_reports")
        .delete()
        .eq("competitor_id", competitorId)
        .eq("user_id", user.id);
      if (reportsError) {
        toast.error(`Nie udało się usunąć raportów: ${reportsError.message}`);
        return;
      }

      const { error, count } = await supabase
        .from("competitors")
        .delete({ count: "exact" })
        .eq("id", competitorId)
        .eq("user_id", user.id);
      if (error) {
        toast.error(`Nie udało się usunąć konkurenta: ${error.message}`);
        return;
      }
      if (count === 0) {
        toast.error("Konkurent nie został usunięty — brak uprawnień lub rekord już nie istnieje.");
        return;
      }

      if (activeCompetitorId === competitorId) {
        setActiveCompetitorId(null);
        setResult(null);
      }
      await refreshCompetitors();
      await refreshAllReports();
      toast.success(`Usunięto konkurenta „${label}”`);
    },
    [user?.id, competitors, activeCompetitorId, refreshCompetitors, refreshAllReports],
  );

  const saveReport = useCallback(async (opts: {
    competitorId: string | null;
    competitorUrl: string;
    industry: string;
    compareUrl: string;
    focus: string[];
    manualText: string;
    result: ScanResult;
  }) => {
    if (!user?.id) return;
    const { error } = await supabase.from("competitor_reports").insert({
      user_id: user.id,
      competitor_id: opts.competitorId,
      competitor_url: opts.competitorUrl,
      industry: opts.industry || null,
      compare_url: opts.compareUrl || null,
      focus: opts.focus,
      manual_text: opts.manualText || null,
      result: opts.result as unknown as never,
    });
    if (!error) void refreshAllReports();
  }, [user?.id, refreshAllReports]);

  const runScan = useCallback(async () => {
    const trimmedUrl = normalizeHttpsUrl(competitorUrl);
    const compareNorm = normalizeHttpsUrl(compareUrl);
    const manual = manualText.trim();
    if (manual.length < 40 && !trimmedUrl) {
      toast.error("Podaj adres strony (https://…) albo wklej treść konkurenta (min. ok. 40 znaków).");
      return;
    }
    if (!focusAreas.length) {
      toast.error("Zaznacz co najmniej jeden obszar analizy.");
      return;
    }
    if (!hasSupabasePublicEnv()) {
      toast.error("Brak konfiguracji Supabase (VITE_SUPABASE_URL / klucz).");
      setErr("Ustaw VITE_SUPABASE_URL i VITE_SUPABASE_PUBLISHABLE_KEY w środowisku aplikacji.");
      return;
    }
    const { data: authData } = await supabase.auth.getSession();
    if (!authData.session) {
      toast.error("Zaloguj się ponownie.");
      return;
    }

    setLoading(true);
    setErr(null);
    setConnectionError(false);
    setResult(null);

    try {
      const res = (await competitorScanFn({
        data: {
          url: trimmedUrl || undefined,
          manualText: manual.length >= 40 ? manual : undefined,
          industry: industry.trim() || undefined,
          compareUrl: compareNorm || undefined,
          focusAreas,
        },
      })) as RunCompetitorScanResult;

      if (!res.ok) {
        if (res.kind === "http") {
          if (res.status === 401) {
            const msg = "Sesja wygasła — zaloguj się ponownie.";
            toast.error(msg);
            setErr(msg);
            return;
          }
          if (res.status === 402) {
            const msg =
              typeof res.message === "string" && res.message.trim()
                ? res.message.trim()
                : "Brak kredytów lub limit planu Free.";
            openCreditsUpgrade(msg);
            setErr(msg);
            return;
          }
          setErr(res.error ?? "Nie udało się przeanalizować strony.");
          return;
        }
        if (res.kind === "fetch") {
          setConnectionError(true);
          setErr(
            "Brak połączenia z Supabase (Edge Functions) z poziomu serwera aplikacji. W hostingu ustaw SUPABASE_URL i SUPABASE_PUBLISHABLE_KEY (te same wartości co VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). Opublikuj funkcję: supabase functions deploy competitor-scan. Sprawdź też firewall po stronie hostingu.",
          );
          return;
        }
        setConnectionError(true);
        setErr(res.message);
        return;
      }

      const payload = (res.data ?? {}) as { error?: string; message?: string } & Partial<ScanResult>;
      if (payload.error) {
        setErr(payload.error);
        return;
      }
      const normalizedResult = normalizeScanResult(payload);
      setResult(normalizedResult);
      scheduleCreditsRefresh();
      setActiveTab("summary");
      const firstQ = payload.viralQueries?.[0];
      if (firstQ) setViralQuery(firstQ);

      // Auto-zapis raportu (jeśli mamy URL) — tworzy listę konkurentów i historię raportów.
      if (trimmedUrl) {
        const comp = await ensureCompetitorForUrl(trimmedUrl);
        if (comp) {
          setActiveCompetitorId(comp.id);
          void refreshCompetitors();
          void saveReport({
            competitorId: comp.id,
            competitorUrl: trimmedUrl,
            industry: industry.trim(),
            compareUrl: compareNorm,
            focus: focusAreas,
            manualText: manual,
            result: normalizedResult,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [
    competitorUrl,
    manualText,
    industry,
    compareUrl,
    focusAreas,
    openCreditsUpgrade,
    competitorScanFn,
    ensureCompetitorForUrl,
    refreshCompetitors,
    saveReport,
  ]);

  const runViral = async () => {
    const q = viralQuery.trim();
    if (!q) return;
    setViralLoading(true);
    setViralErr(null);
    setViralItems([]);
    const res = await viralFn({ data: { platform: viralPlatform, query: q, limit: 9 } });
    setViralItems(res.items as ViralItem[]);
    setViralErr(res.error);
    setViralLoading(false);
  };

  const tabBullets = useCallback(
    (id: ResultTabId): string[] => {
      if (!result) return [];
      const cfg = TABS.find((t) => t.id === id);
      const value = cfg ? result[cfg.field] : [];
      return Array.isArray(value) ? value : [];
    },
    [result],
  );

  // Debug tylko w trybie developerskim — pomaga wykryć przypadek A (dane są, UI ich nie pokazuje).
  useEffect(() => {
    if (!import.meta.env.DEV || !result) return;
    const cfg = TABS.find((t) => t.id === activeTab);
    // eslint-disable-next-line no-console
    console.log("Active tab:", activeTab);
    // eslint-disable-next-line no-console
    console.log("Mapped field:", cfg?.field);
    // eslint-disable-next-line no-console
    console.log("Bullets:", cfg ? result[cfg.field] : []);
  }, [activeTab, result]);

  /** Komunikat braku danych zależny od jakości scrapingu (B vs C). */
  const emptyMessageForTab = useCallback((): string => {
    const status = result?.dataQuality?.scrapingStatus;
    if (status === "failed" || status === "partial") {
      return "Nie udało się pobrać wystarczającej ilości danych z tej strony. Strona może ładować treści przez JavaScript, blokować pobieranie albo mieć ograniczone metadane.";
    }
    return "W dostępnych danych nie znaleziono wystarczających informacji dla tej sekcji.";
  }, [result]);

  const copyTab = (id: ResultTabId) => {
    if (!result) return;
    const lines = tabBullets(id);
    const parts: string[] = lines.map((l) => `• ${l}`);
    if (id === "summary" && result.scores) {
      parts.push("");
      parts.push("Wyniki analizy:");
      parts.push(`• Propozycja wartości: ${result.scores.valueProp}/100`);
      parts.push(`• Sygnały SEO: ${result.scores.seoSignals}/100`);
      parts.push(`• Obecność w social media: ${result.scores.socialPresence}/100`);
      parts.push(`• Szacowana widoczność w AI: ${result.scores.aiVisibilityEst}/100`);
    }
    if (id === "recommendations" && result.analysisMarkdown.trim()) {
      parts.push("");
      parts.push(result.analysisMarkdown.trim());
    }
    const text = parts.join("\n").trim();
    if (!text) {
      toast.error("Brak treści do skopiowania.");
      return;
    }
    void navigator.clipboard.writeText(text);
    toast.success("Skopiowano treść zakładki.");
  };

  const openReport = useCallback((r: CompetitorReportRow) => {
    const normalized = normalizeScanResult((r.result ?? {}) as Partial<ScanResult>);
    setResult(normalized);
    setActiveTab("summary");
    setCompetitorUrl(r.competitor_url);
    setIndustry(r.industry ?? "");
    setCompareUrl(r.compare_url ?? "");
    setManualText(r.manual_text ?? "");
    toast.message("Otworzono zapisany raport.");
  }, []);

  const renderCompetitorCard = (c: CompetitorRow) => {
    const active = c.id === activeCompetitorId;
    const label = c.name ?? c.url.replace(/^https?:\/\//, "");
    const competitorReports = reportsByCompetitor[c.id] ?? [];
    const reportCount = competitorReports.length;

    return (
      <li
        key={c.id}
        className={`rounded-xl border transition ${
          active ? "border-foreground bg-foreground/5" : "border-border bg-muted/10"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => {
              setActiveCompetitorId((prev) => (prev === c.id ? null : c.id));
              setCompetitorUrl(c.url);
              setResult(null);
            }}
            className="min-w-0 flex-1 text-left"
            title={c.url}
          >
            <div className="flex items-center gap-2">
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                  active ? "rotate-180" : ""
                }`}
              />
              <span className={`text-sm font-semibold truncate ${active ? "text-foreground" : ""}`}>{label}</span>
              {reportCount > 0 && (
                <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {reportCount} {reportCount === 1 ? "raport" : reportCount < 5 ? "raporty" : "raportów"}
                </span>
              )}
            </div>
            <span className="mt-0.5 pl-6 text-[11px] text-muted-foreground truncate block">{c.url}</span>
          </button>
          <button
            type="button"
            onClick={() => void deleteCompetitor(c.id)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-500/20 dark:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
            Usuń
          </button>
        </div>

        {active && (
          <div className="border-t border-border/60 px-3 py-2 space-y-2">
            {competitorReports.length ? (
              competitorReports.slice(0, 10).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <button type="button" onClick={() => openReport(r)} className="min-w-0 flex-1 text-left">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.competitor_url.replace(/^https?:\/\//, "")}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const { error } = await supabase.from("competitor_reports").delete().eq("id", r.id);
                      if (!error) void refreshAllReports();
                    }}
                    className="shrink-0 rounded-lg border border-border bg-muted/20 px-2.5 py-2 text-xs font-semibold hover:bg-muted/40"
                    title="Usuń raport"
                  >
                    Usuń
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-1">Brak raportów dla tego konkurenta.</p>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 md:px-8 py-8 md:py-10">
      <AppBackLink className="mb-6" />

      <header className="mb-8 max-w-3xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
            <Crosshair className="h-4 w-4 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Analiza konkurencji</h1>
            <p className="mt-2 text-sm md:text-[15px] text-muted-foreground leading-relaxed">
              Wklej stronę konkurenta i zobacz, jak komunikuje ofertę, jakie kanały wykorzystuje, jakie ma mocne strony
              oraz co Twoja marka może zrobić lepiej.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Landing page", "SEO", "Social media", "Reklamy", "LLM Visibility"].map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-background p-5 md:p-6 shadow-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Konkurenci</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Po analizie URL zapisujemy konkurenta i raport. Kliknij konkurenta na liście, żeby rozwinąć jego raporty.
              </p>
            </div>

            {competitors.length ? (
              <div className="mt-4 space-y-4">
                {competitorsWithReports.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Z raportami
                    </p>
                    <ul className="space-y-2">{competitorsWithReports.map(renderCompetitorCard)}</ul>
                  </div>
                )}
                {competitorsWithoutReports.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Pozostali
                    </p>
                    <ul className="space-y-2">{competitorsWithoutReports.map(renderCompetitorCard)}</ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Brak zapisanych konkurentów — uruchom analizę URL, a zapisze się automatycznie.
              </p>
            )}
          </section>

          <div className="rounded-2xl border border-border bg-muted/15 p-5 md:p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)]">
            <div className="flex items-center gap-2 mb-5">
              <LayoutGrid className="h-4 w-4 text-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">Rozpocznij analizę</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  URL konkurenta
                </label>
                <input
                  value={competitorUrl}
                  onChange={(e) => setCompetitorUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void runScan()}
                  placeholder="https://konkurent.pl"
                  disabled={loading}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm shadow-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Twoja branża / typ firmy
                </label>
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="Np. SaaS B2B, e-commerce, agencja"
                  disabled={loading}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm shadow-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Opcjonalnie: URL Twojej strony do porównania
                </label>
                <input
                  value={compareUrl}
                  onChange={(e) => setCompareUrl(e.target.value)}
                  placeholder="https://twoja-strona.pl"
                  disabled={loading}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm shadow-sm disabled:opacity-50"
                />
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Obszary analizy
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FOCUS_OPTIONS.map((o) => (
                    <label
                      key={o.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm hover:bg-muted/30"
                    >
                      <input
                        type="checkbox"
                        checked={focus[o.id]}
                        onChange={() => toggleFocus(o.id)}
                        className="rounded border-border"
                      />
                      <span className="leading-tight">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div
                id="competitor-manual-text"
                className="rounded-lg border border-dashed border-border bg-background/80 p-4 scroll-mt-28"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Treść ręczna (gdy URL nie działa)
                </p>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Wklej fragment strony lub opis oferty konkurenta (min. ok. 40 znaków)…"
                  disabled={loading}
                  rows={4}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Jeśli wkleisz treść, analiza opiera się na niej — pobieranie HTML z URL zostanie pominięte.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void runScan()}
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background px-6 py-3 text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-40"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? "Analizuję…" : "Przeanalizuj konkurenta"}
              </button>
            </div>
          </div>

          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50/90 px-4 py-4 text-sm text-red-900 shadow-sm">
              <p>{err}</p>
              {connectionError && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void runScan()}
                    className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-wide text-background"
                  >
                    Spróbuj ponownie
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("competitor-manual-text")?.scrollIntoView({ behavior: "smooth" });
                      toast.message("Wklej treść w polu „Treść ręczna”.");
                    }}
                    className="rounded-lg border border-red-300 bg-background px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-900"
                  >
                    Wklej tekst ręcznie
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24">
          <PreviewReportCards />
        </div>
      </div>

      {result && (
        <div className="mt-12 space-y-8">
          <div className="rounded-2xl border border-border bg-background p-5 md:p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Źródło</h2>
            {result.pageUrl.startsWith("http") ? (
              <a
                href={result.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
              >
                {result.title || result.pageUrl}
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
            ) : (
              <p className="text-sm font-medium text-foreground">{result.title || "Analiza z wklejonej treści"}</p>
            )}
            {result.description ? (
              <p className="mt-2 text-sm text-muted-foreground">{result.description}</p>
            ) : null}
            {result.brandGuess ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Marka / produkt (szacunek):{" "}
                <span className="font-medium text-foreground">{result.brandGuess}</span>
              </p>
            ) : null}
          </div>

          {result.scores && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <ScoreMini label="Propozycja wartości" value={result.scores.valueProp} />
              <ScoreMini label="Sygnały SEO" value={result.scores.seoSignals} />
              <ScoreMini label="Social" value={result.scores.socialPresence} />
              <ScoreMini label="Szac. widoczność AI" value={result.scores.aiVisibilityEst} />
            </div>
          )}

          <div className="rounded-2xl border border-border bg-muted/10 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="flex flex-wrap gap-1 border-b border-border bg-background px-2 py-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                    activeTab === t.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => copyTab(activeTab)}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/50"
              >
                <Copy className="h-3.5 w-3.5" />
                Kopiuj
              </button>
            </div>
            <div className="bg-background p-5 md:p-6">
              <InsightList items={tabBullets(activeTab)} emptyHint={emptyMessageForTab()} />
              {activeTab === "recommendations" && result.analysisMarkdown.trim() ? (
                <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Co warto poprawić
                  </p>
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.analysisMarkdown}</ReactMarkdown>
                  </div>
                </div>
              ) : null}
              {result.dataQuality.warnings.length > 0 ? (
                <p className="mt-4 text-[11px] text-muted-foreground">
                  Uwagi dot. danych: {result.dataQuality.warnings.join(" · ")}
                </p>
              ) : null}
              {import.meta.env.DEV ? (
                <p className="mt-3 text-[10px] font-mono text-muted-foreground/70">
                  Źródło danych: {TABS.find((t) => t.id === activeTab)?.field} · scrapingStatus:{" "}
                  {result.dataQuality.scrapingStatus}
                </p>
              ) : null}
            </div>
          </div>

          {result.socialLinks.length > 0 && (
            <section className="rounded-2xl border border-border bg-background p-5 md:p-6 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Wykryte profile
              </h2>
              <div className="flex flex-wrap gap-2">
                {result.socialLinks.map((s, i) => (
                  <a
                    key={`${s.url}-${i}`}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition"
                  >
                    {s.label}
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  </a>
                ))}
              </div>
            </section>
          )}

          <SiteImages images={result.images} />

          <section className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.06] p-5 md:p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-600" />
              Virale — inspiracje
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Hasła sugerowane przez AI — otwórz wyszukiwanie w Virale lub zobacz próbkę poniżej (wymaga Apify po
              stronie serwera).
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {result.viralQueries.map((q) => (
                <Link
                  key={q}
                  to="/viral-search"
                  search={{ q }}
                  className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/80 transition"
                >
                  Virale: „{q}”
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
                {(["tiktok", "instagram", "youtube"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setViralPlatform(p)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md ${
                      viralPlatform === p ? "bg-background shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {p === "tiktok" ? "TikTok" : p === "instagram" ? "IG" : "YT"}
                  </button>
                ))}
              </div>
              <input
                value={viralQuery}
                onChange={(e) => setViralQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runViral()}
                placeholder="Hasło do virali…"
                className="flex-1 min-w-[160px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void runViral()}
                disabled={viralLoading || !viralQuery.trim()}
                className="rounded-lg bg-foreground text-background px-4 py-2 text-sm font-semibold disabled:opacity-40"
              >
                {viralLoading ? "…" : "Szukaj"}
              </button>
            </div>
            {viralErr && <p className="text-sm text-red-700 mb-3">{viralErr}</p>}
            {viralItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {viralItems.map((it, i) => (
                  <ViralShortCard
                    key={`${it.url}-${i}`}
                    item={it}
                    platform={viralPlatform}
                    searchQuery={viralQuery.trim() || undefined}
                    savedRowId={viralSavedByUrl.get(it.url) ?? null}
                    onMutated={() => void refreshSaved()}
                    compact
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
