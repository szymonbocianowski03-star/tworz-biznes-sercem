import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Copy, Sparkles, History, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppBackLink } from "@/components/AppBackLink";
import { SeoAuditDashboard } from "@/components/SeoAuditDashboard";
import { useCreditsUpgrade } from "@/contexts/CreditsUpgradeContext";
import { useAuthSession } from "@/hooks/useAuthSession";
import type { SeoAuditAnalysis } from "@/lib/seoAuditAnalysis";
import { parseSeoAuditAnalysis, quickWinAction, quickWinTitle } from "@/lib/seoAuditAnalysis";
import { runSeoAudit } from "@/lib/seoAudit.functions";
import { countFilledSections } from "@/lib/seoAuditComplete";
import {
  deleteSeoAuditHistoryEntry,
  getSeoAuditHistory,
  resolveSeoHistoryUserId,
  saveSeoAuditToHistory,
  type SeoAuditHistoryEntry,
} from "@/lib/seoAuditHistory";
import { scheduleCreditsRefresh } from "@/lib/creditsRefresh";
import { hasSupabasePublicEnv } from "@/integrations/supabase/publicEnv";

export const Route = createFileRoute("/seo")({
  head: () => ({ meta: [{ title: "Panel SEO — MarketingNow" }] }),
  component: SeoPanel,
});

const SESSION_KEY = "mn.seoAudit.session.v1";

type SeoSession = {
  url: string;
  targetKeywords: string;
  industry: string;
  analysis?: SeoAuditAnalysis;
};

function loadSeoSession(): SeoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as SeoSession;
    if (typeof o.url !== "string") return null;
    let analysis: SeoAuditAnalysis | undefined;
    if (o.analysis) {
      const parsed = parseSeoAuditAnalysis(o.analysis);
      if (parsed.ok) analysis = parsed.data;
    }
    return {
      url: o.url,
      targetKeywords: typeof o.targetKeywords === "string" ? o.targetKeywords : "",
      industry: typeof o.industry === "string" ? o.industry : "",
      analysis,
    };
  } catch {
    return null;
  }
}

function persistSeoSession(data: SeoSession): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

function normalizeHttpsUrl(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^\/\//.test(t)) return `https:${t}`;
  if (/^[a-z0-9][a-z0-9._/-]*\.[a-z]{2,}([/?#]|$)/i.test(t)) return `https://${t}`;
  return t;
}

function SeoPanel() {
  const { openCreditsUpgrade } = useCreditsUpgrade();
  const { user } = useAuthSession();
  const userId = resolveSeoHistoryUserId(user?.id);
  const saved = useMemo(() => loadSeoSession(), []);
  const [url, setUrl] = useState(saved?.url ?? "");
  const [targetKeywords, setTargetKeywords] = useState(saved?.targetKeywords ?? "");
  const [industry, setIndustry] = useState(saved?.industry ?? "");
  const [analysis, setAnalysis] = useState<SeoAuditAnalysis | null>(saved?.analysis ?? null);
  const [history, setHistory] = useState<SeoAuditHistoryEntry[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSec, setLoadingSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [restoredHint, setRestoredHint] = useState(Boolean(saved?.analysis || saved?.url));
  const resultsRef = useRef<HTMLDivElement>(null);
  const normalized = useMemo(() => normalizeHttpsUrl(url), [url]);

  const refreshHistory = useCallback(() => {
    setHistory(getSeoAuditHistory(userId));
  }, [userId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    persistSeoSession({
      url,
      targetKeywords,
      industry,
      analysis: analysis ?? undefined,
    });
  }, [url, targetKeywords, industry, analysis]);

  useEffect(() => {
    if (!loading) {
      setLoadingSec(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setLoadingSec(Math.floor((Date.now() - t0) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!loading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [loading]);

  const agentBrief = useMemo(() => {
    if (!analysis) return "";
    if (analysis.agentBrief.trim()) return analysis.agentBrief.trim();
    const url = analysis.pageOverview.fetchedUrl ?? normalized ?? "";
    const s = analysis.scores;
    const wins = analysis.quickWins
      .slice(0, 5)
      .map((w) => {
        const title = quickWinTitle(w);
        const action = quickWinAction(w);
        return action ? `- ${title}: ${action}` : `- ${title}`;
      })
      .join("\n");
    return (
      `Audyt SEO — ${url}\n` +
      `Wynik: ${analysis.overallScore}/100 (tech ${s.technical}, on-page ${s.onPage}, treści ${s.content}, autorytet ${s.authority})\n\n` +
      `${analysis.summary}\n\n` +
      (wins ? `Top quick wins:\n${wins}\n\n` : "") +
      `Przygotuj plan wdrożenia i kolejne kroki w agencie MarketingNow.`
    );
  }, [analysis, normalized]);

  const runAudit = useCallback(async () => {
    const u = normalized;
    if (!u) {
      setError("Podaj poprawny adres strony (np. https://twoja-strona.pl).");
      return;
    }
    if (!hasSupabasePublicEnv()) {
      setError("Brak konfiguracji Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).");
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const res = await runSeoAudit({
        url: u,
        targetKeywords: targetKeywords.trim() || undefined,
        industry: industry.trim() || undefined,
      });

      if (!res.ok) {
        if (res.kind === "http" && res.status === 402) {
          const msg =
            typeof res.message === "string" && res.message.trim()
              ? res.message.trim()
              : "Brak kredytów — otwórz Plan i kredyty.";
          openCreditsUpgrade(msg);
          setError(msg);
          return;
        }
        const msg =
          res.kind === "http"
            ? res.message ?? res.error ?? `Błąd serwera (${res.status}).`
            : res.message;
        setError(msg);
        return;
      }

      const completed = res.data;
      setAnalysis(completed);
      const entry = saveSeoAuditToHistory({
        userId,
        url: u,
        normalizedUrl: u,
        targetKeywords: targetKeywords.trim(),
        industry: industry.trim(),
        analysis: completed,
      });
      setActiveHistoryId(entry.id);
      refreshHistory();
      scheduleCreditsRefresh();
      const sections = countFilledSections(completed);
      if (sections.missing.length > 0) {
        toast.message(`Audyt gotowy — uzupełniono brakujące sekcje: ${sections.missing.join(", ")}`);
      } else {
        toast.success("Audyt SEO gotowy");
      }
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nie udało się uruchomić audytu.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [normalized, targetKeywords, industry, openCreditsUpgrade, userId, refreshHistory]);

  const loadFromHistory = useCallback(
    (entry: SeoAuditHistoryEntry) => {
      setUrl(entry.url);
      setTargetKeywords(entry.targetKeywords);
      setIndustry(entry.industry);
      const reparsed = parseSeoAuditAnalysis(entry.analysis);
      setAnalysis(reparsed.ok ? reparsed.data : entry.analysis);
      setActiveHistoryId(entry.id);
      setError(null);
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [],
  );

  const handleDeleteHistory = useCallback(
    (id: string) => {
      if (!window.confirm("Usunąć ten skan z historii?")) return;
      deleteSeoAuditHistoryEntry(userId, id);
      if (activeHistoryId === id) setActiveHistoryId(null);
      refreshHistory();
      toast.success("Usunięto z historii");
    },
    [userId, activeHistoryId, refreshHistory],
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 md:px-8 py-8 md:py-10">
      <AppBackLink className="mb-6" />

      <header className="mb-8 max-w-3xl">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Panel SEO</h1>
        <p className="mt-2 text-sm md:text-[15px] text-muted-foreground leading-relaxed">
          Wpisz URL — serwer pobierze stronę (bez CORS w przeglądarce), a model wygeneruje wynik z procentami,
          checklistą, 10 szybkimi zmianami i planem na 30 dni — podobnie jak w panelu widoczności AI.
        </p>
        {restoredHint && (
          <p className="mt-2 text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
            Przywrócono ostatnią sesję w tej karcie przeglądarki (URL i wynik, jeśli był gotowy).
            <button
              type="button"
              className="ml-2 underline hover:opacity-80"
              onClick={() => setRestoredHint(false)}
            >
              Ukryj
            </button>
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        <section className="lg:col-span-4 rounded-2xl border border-border bg-background p-5 md:p-6 shadow-sm space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">URL strony</p>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://twoja-strona.pl"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm shadow-sm"
              disabled={loading}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Znormalizowany: <span className="font-medium text-foreground">{normalized || "—"}</span>
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Frazy docelowe (opcjonalnie)
            </p>
            <input
              value={targetKeywords}
              onChange={(e) => setTargetKeywords(e.target.value)}
              placeholder="np. marketing automation, CRM"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm shadow-sm"
              disabled={loading}
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Branża (opcjonalnie)
            </p>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="np. SaaS B2B"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm shadow-sm"
              disabled={loading}
            />
          </div>

          <button
            type="button"
            onClick={() => void runAudit()}
            disabled={loading || !normalized}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Pobieram stronę i analizuję…
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Uruchom audyt SEO
              </>
            )}
          </button>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              {error}
            </p>
          )}

          <div className="rounded-xl border border-border bg-muted/10 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Historia skanów SEO
              </p>
              {history.length > 0 && (
                <span className="text-[10px] text-muted-foreground">{history.length}</span>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Po pierwszym audycie zapiszemy wynik tutaj — możesz wrócić do poprzednich skanów tej samej lub innej domeny.
              </p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      activeHistoryId === entry.id ? "border-foreground bg-muted/40" : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => loadFromHistory(entry)}
                        className="text-left flex-1 min-w-0 hover:opacity-80"
                      >
                        <p className="font-medium truncate" title={entry.normalizedUrl}>
                          {entry.normalizedUrl.replace(/^https?:\/\//, "")}
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          {new Date(entry.createdAt).toLocaleString("pl-PL")} · wynik {entry.overallScore}/100
                        </p>
                      </button>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => loadFromHistory(entry)}
                          title="Otwórz raport"
                          className="p-1 rounded hover:bg-muted"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistory(entry.id)}
                          title="Usuń"
                          className="p-1 rounded hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {analysis && agentBrief && (
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Brief do agenta
              </p>
              <textarea
                value={agentBrief}
                readOnly
                rows={6}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed"
              />
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(agentBrief);
                  toast.success("Skopiowano brief");
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted/50"
              >
                <Copy className="h-3.5 w-3.5" />
                Kopiuj brief
              </button>
            </div>
          )}
        </section>

        <section ref={resultsRef} className="lg:col-span-8">
          {!analysis && !loading && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-8 md:p-12 text-center">
              <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/60 mb-4" />
              <p className="text-sm font-medium text-foreground">Wynik audytu pojawi się tutaj</p>
              <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                Zobaczysz wynik ogólny (0–100), cztery kategorie, checklistę ze statusami ok/warn/fail, 10 quick
                wins oraz plan 4 tygodni.
              </p>
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-border bg-card p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Pobieranie HTML i generowanie raportu…</p>
              <p className="text-xs text-muted-foreground text-center max-w-sm leading-relaxed">
                Audyt zwykle trwa 1–3 minuty{loadingSec > 0 ? ` (${loadingSec} s)` : ""}. Nie zamykaj karty — postęp
                formularza jest zapisywany automatycznie.
              </p>
            </div>
          )}

          {analysis && !loading && <SeoAuditDashboard data={analysis} />}
        </section>
      </div>
    </div>
  );
}
