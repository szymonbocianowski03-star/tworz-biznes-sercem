import { Loader2, SlidersHorizontal } from "lucide-react";
import type { LlmVisibilityAnalysis } from "@/lib/llmVisibilityAnalysis";
import type { LlmTrendPoint } from "@/lib/llmVisibilityTrend";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type LlmVisibilityPanelLayout = "tabs" | "steps";

const STEP_TO_TAB = ["przeglad", "prompty", "szanse", "plan"] as const;
type LlmVisTab = (typeof STEP_TO_TAB)[number];
const STEP_LABELS = ["Przegląd", "Prompty", "Szanse", "Plan"] as const;
const LAST_STEP_INDEX = STEP_TO_TAB.length - 1;

function sentimentClass(s: string): string {
  const x = s.toLowerCase();
  if (x.includes("positive") || x.includes("pozytyw")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (x.includes("negative") || x.includes("negatyw")) return "bg-red-500/15 text-red-700 dark:text-red-400";
  return "bg-muted text-muted-foreground";
}

function priorityClass(p: string): string {
  const x = p.toLowerCase();
  if (x.includes("high") || x.includes("wysok")) return "border-red-500/40 bg-red-500/5";
  if (x.includes("medium") || x.includes("średn")) return "border-amber-500/40 bg-amber-500/5";
  return "border-border bg-muted/30";
}

function bucketSentiment(s: string): "pozytywny" | "negatywny" | "neutralny" {
  const x = s.toLowerCase();
  if (x.includes("positive") || x.includes("pozytyw")) return "pozytywny";
  if (x.includes("negative") || x.includes("negatyw")) return "negatywny";
  return "neutralny";
}

function computePromptCoveragePct(data: LlmVisibilityAnalysis): number {
  const rows = data.brandMentions;
  if (!rows.length) return 0;
  const ok = rows.filter((r) => r.appears).length;
  return Math.round((ok / rows.length) * 100);
}

function computeDerivedMetrics(data: LlmVisibilityAnalysis) {
  const m = data.metrics;
  const coverage = m?.answeredPromptsPercent ?? computePromptCoveragePct(data);
  const withCites = data.brandMentions.filter((r) => r.appears && typeof r.citations === "number" && r.citations > 0);
  const appears = data.brandMentions.filter((r) => r.appears);
  let citationRate = m?.citationRate;
  if (citationRate == null && appears.length) {
    const avg = withCites.length ? withCites.reduce((a, r) => a + (r.citations ?? 0), 0) / withCites.length : 0;
    citationRate = Math.min(100, Math.round(avg * 18));
  }
  let sov = m?.shareOfVoicePercent;
  if (sov == null && data.competitors.length) {
    const scores = data.competitors.map((c) => c.visibilityScore ?? 0).filter((n) => n > 0);
    const maxC = scores.length ? Math.max(...scores) : 0;
    const brand = data.visibilityScore;
    const denom = Math.max(1, brand + maxC);
    sov = Math.min(100, Math.round((brand / denom) * 100));
  }
  return {
    answeredPromptsPercent: coverage,
    citationRate: citationRate ?? null,
    shareOfVoicePercent: sov ?? null,
  };
}

function sentimentBreakdown(data: LlmVisibilityAnalysis): { key: "pozytywny" | "negatywny" | "neutralny"; count: number }[] {
  const map: Record<"pozytywny" | "negatywny" | "neutralny", number> = {
    pozytywny: 0,
    negatywny: 0,
    neutralny: 0,
  };
  for (const row of data.brandMentions) {
    const b = bucketSentiment(row.sentiment);
    map[b] += 1;
  }
  return [
    { key: "pozytywny", count: map.pozytywny },
    { key: "negatywny", count: map.negatywny },
    { key: "neutralny", count: map.neutralny },
  ];
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const dash = pct * c;
  const color = score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-red-500";
  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg viewBox="0 0 120 120" className="h-32 w-32 sm:h-36 sm:w-36 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/25" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          className={color}
          style={{ strokeDasharray: `${dash} ${c}` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-3xl sm:text-4xl font-extrabold tabular-nums">{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  footnote,
}: {
  label: string;
  value: string;
  sub?: string;
  footnote?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-extrabold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      {footnote && <p className="mt-2 text-[10px] text-muted-foreground/80">{footnote}</p>}
    </div>
  );
}

function MiniBarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-xs">
        <span className="font-medium truncate">{label}</span>
        <span className="tabular-nums text-muted-foreground shrink-0">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-foreground/70 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DualTrendChart({
  modelTrend,
  history,
}: {
  modelTrend: { week: string; score: number }[];
  history: LlmTrendPoint[];
}) {
  const histPts = history.map((p) => ({
    label: new Date(p.at).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    score: p.score,
  }));
  const modelPts = modelTrend.map((p) => ({ label: p.week, score: p.score }));

  const W = 560;
  const H = 140;
  const pad = { t: 12, r: 12, b: 28, l: 12 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  function pathFor(points: { label: string; score: number }[], stroke: string) {
    if (points.length < 2) return null;
    const xs = (i: number) => pad.l + (i / (points.length - 1)) * innerW;
    const ys = (s: number) => pad.t + innerH - (Math.min(100, Math.max(0, s)) / 100) * innerH;
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xs(i).toFixed(1)} ${ys(p.score).toFixed(1)}`).join(" ");
    return <path d={d} fill="none" stroke={stroke} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />;
  }

  const hasHist = histPts.length >= 2;
  const hasModel = modelPts.length >= 2;

  if (!hasHist && !hasModel) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        Uruchom analizę kilka razy dla tej samej marki — zobaczysz linię trendu z zapisanych wyników. Model może też zwrócić
        serię tygodniową w polu „visibilityTrend”.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[320px] w-full h-auto text-foreground" role="img" aria-label="Wykres trendu widoczności">
          <rect x="0" y="0" width={W} height={H} fill="transparent" />
          {[0, 25, 50, 75, 100].map((g) => {
            const y = pad.t + innerH - (g / 100) * innerH;
            return (
              <g key={g}>
                <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="currentColor" className="text-border" strokeWidth={1} />
                <text x={4} y={y + 3} fontSize={9} className="fill-muted-foreground">
                  {g}
                </text>
              </g>
            );
          })}
          {hasModel && pathFor(modelPts, "#8b5cf6")}
          {hasHist && pathFor(histPts, "#0ea5e9")}
          {hasModel &&
            modelPts.map((p, i) => {
              const xs = (idx: number) => pad.l + (idx / (modelPts.length - 1)) * innerW;
              const ys = (s: number) => pad.t + innerH - (Math.min(100, Math.max(0, s)) / 100) * innerH;
              return <circle key={`m-${i}`} cx={xs(i)} cy={ys(p.score)} r={3.5} className="fill-violet-500" />;
            })}
          {hasHist &&
            histPts.map((p, i) => {
              const xs = (idx: number) => pad.l + (idx / (histPts.length - 1)) * innerW;
              const ys = (s: number) => pad.t + innerH - (Math.min(100, Math.max(0, s)) / 100) * innerH;
              return <circle key={`h-${i}`} cx={xs(i)} cy={ys(p.score)} r={3.5} className="fill-sky-500" />;
            })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {hasHist && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Historia uruchomień (ta przeglądarka)
          </span>
        )}
        {hasModel && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-500" /> Scenariusz tygodniowy (z analizy AI)
          </span>
        )}
      </div>
    </div>
  );
}

export function LlmVisibilityDashboard({
  data,
  historyTrend = [],
  lastScanAt = null,
  panelLayout = "tabs",
  activeStep = 0,
  onActiveStepChange,
  onRequestFullTabs,
}: {
  data: LlmVisibilityAnalysis;
  historyTrend?: LlmTrendPoint[];
  /** ISO zapisany po udanym skanie (lokalnie) */
  lastScanAt?: string | null;
  panelLayout?: LlmVisibilityPanelLayout;
  /** 0–3: przegląd, prompty, szanse, plan — steruje też zakładkami w widoku „zakładki” */
  activeStep?: number;
  onActiveStepChange?: (step: number) => void;
  onRequestFullTabs?: () => void;
}) {
  const modelTrend = Array.isArray(data.visibilityTrend) ? data.visibilityTrend : [];
  const derived = computeDerivedMetrics(data);
  const breakdown = sentimentBreakdown(data);
  const totalM = data.brandMentions.length;
  const maxCompScore = Math.max(data.visibilityScore, ...data.competitors.map((c) => c.visibilityScore ?? 0), 1);

  const citationDisplay =
    derived.citationRate != null ? `${Math.round(derived.citationRate)}%` : "—";
  const sovDisplay = derived.shareOfVoicePercent != null ? `${Math.round(derived.shareOfVoicePercent)}%` : "—";

  const citationFoot =
    data.metrics?.citationRate == null && derived.citationRate != null
      ? "Szacunek z cytowań w wierszach promptów (gdy model ich nie podał w metrics)."
      : undefined;
  const sovFoot =
    data.metrics?.shareOfVoicePercent == null && derived.shareOfVoicePercent != null
      ? "Szacunek z wyniku marki vs maks. wynik konkurentów z tabeli."
      : undefined;

  const clampedStep = Math.min(Math.max(0, activeStep ?? 0), LAST_STEP_INDEX);
  const effectiveTab: LlmVisTab = STEP_TO_TAB[clampedStep];

  const goStep = (n: number) => onActiveStepChange?.(Math.min(Math.max(0, n), LAST_STEP_INDEX));

  const onTabChange = (v: string) => {
    const t = v as LlmVisTab;
    if (!STEP_TO_TAB.includes(t)) return;
    const idx = STEP_TO_TAB.indexOf(t);
    if (idx >= 0) onActiveStepChange?.(idx);
  };

  return (
    <div className="space-y-6 min-w-0">
      {panelLayout === "steps" ? (
        <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Raport krok po kroku</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Na każdym kroku jedna sekcja panelu: metryki i skuteczność, prompty, szanse i konkurencja, na końcu plan działań oraz
              „co zmienić” w testach promptów. Raport zapiszesz lub odrzucisz przyciskami pod panelem.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kroki raportu">
            {STEP_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={clampedStep === i}
                onClick={() => goStep(i)}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  clampedStep === i
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="tabular-nums opacity-80">{i + 1}. </span>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Krok <span className="font-semibold text-foreground">{clampedStep + 1}</span> z {STEP_LABELS.length}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={clampedStep < 1}
                onClick={() => goStep(clampedStep - 1)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-35"
              >
                Wstecz
              </button>
              <button
                type="button"
                disabled={clampedStep >= LAST_STEP_INDEX}
                onClick={() => goStep(clampedStep + 1)}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-35"
              >
                Dalej
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Tabs value={effectiveTab} onValueChange={onTabChange} className="w-full min-w-0">
        {panelLayout === "tabs" ? (
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1 sm:inline-flex sm:h-9 sm:w-auto">
          <TabsTrigger value="przeglad" className="text-xs sm:text-sm">
            Przegląd
          </TabsTrigger>
          <TabsTrigger value="prompty" className="text-xs sm:text-sm">
            Prompty i modele
          </TabsTrigger>
          <TabsTrigger value="szanse" className="text-xs sm:text-sm">
            Szanse i konkurencja
          </TabsTrigger>
          <TabsTrigger value="plan" className="text-xs sm:text-sm">
            Plan i treści
          </TabsTrigger>
        </TabsList>
        ) : null}

        <TabsContent value="przeglad" className="mt-4 space-y-6">
          {lastScanAt && (
            <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="font-semibold text-foreground">Data ostatniego skanowania: </span>
              <time dateTime={lastScanAt}>{new Date(lastScanAt).toLocaleString("pl-PL")}</time>
            </p>
          )}
          <section className="rounded-2xl border border-border bg-card p-5 md:p-7 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Wynik i podsumowanie</h2>
            <div className="flex flex-col lg:flex-row lg:items-start gap-8">
              <ScoreRing score={data.visibilityScore} />
              <div className="flex-1 min-w-0 space-y-4">
                <p className="text-[15px] md:text-base leading-relaxed text-foreground">{data.summary}</p>
                <div className="h-2 rounded-full bg-muted overflow-hidden max-w-xl">
                  <div
                    className="h-full bg-foreground/80 transition-all rounded-full"
                    style={{ width: `${data.visibilityScore}%` }}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    label="Pokrycie promptów"
                    value={`${derived.answeredPromptsPercent}%`}
                    sub={`${data.brandMentions.filter((r) => r.appears).length} / ${totalM || "—"} zapytań z marką`}
                    footnote={data.metrics?.answeredPromptsPercent == null ? "Wyliczone z tabeli „Obecność”." : undefined}
                  />
                  <KpiCard label="Cytowalność (szac.)" value={citationDisplay} sub="Udźwięk w odpowiedziach z źródłami" footnote={citationFoot} />
                  <KpiCard label="Share of voice (AI)" value={sovDisplay} sub="Udział względem konkurencji" footnote={sovFoot} />
                  <KpiCard label="Wiersze promptów" value={String(totalM)} sub="Monitorowane zapytania w tej analizie" />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Trend widoczności</h2>
            <DualTrendChart modelTrend={modelTrend} history={historyTrend} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Rozkład sentymentu (prompty)</h2>
            {totalM === 0 ? (
              <p className="text-sm text-muted-foreground">Brak wierszy w brandMentions.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                {breakdown.map((b) => {
                  const pct = Math.round((b.count / totalM) * 100);
                  const color =
                    b.key === "pozytywny" ? "bg-emerald-500" : b.key === "negatywny" ? "bg-red-500" : "bg-muted-foreground/50";
                  return (
                    <div key={b.key} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize font-medium">{b.key}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {b.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="prompty" className="mt-4 space-y-6">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Obecność w zapytaniach</h2>
            <div className="rounded-xl border border-border overflow-x-auto shadow-sm">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="p-3 font-medium">Zapytanie</th>
                    <th className="p-3 font-medium">Model AI</th>
                    <th className="p-3 font-medium">Widoczna?</th>
                    <th className="p-3 font-medium">Pozycja</th>
                    <th className="p-3 font-medium">Cytowania</th>
                    <th className="p-3 font-medium">Sprawdzono</th>
                    <th className="p-3 font-medium">Sentyment</th>
                    <th className="p-3 font-medium min-w-[200px]">Komentarz</th>
                  </tr>
                </thead>
                <tbody>
                  {data.brandMentions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-4 text-muted-foreground">
                        Brak wpisów.
                      </td>
                    </tr>
                  ) : (
                    data.brandMentions.map((row, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="p-3 align-top font-medium max-w-[240px]">{row.query}</td>
                        <td className="p-3 align-top text-muted-foreground whitespace-nowrap">{row.aiModel ?? "—"}</td>
                        <td className="p-3 align-top">{row.appears ? "Tak" : "Nie"}</td>
                        <td className="p-3 align-top tabular-nums">{row.position ?? "—"}</td>
                        <td className="p-3 align-top tabular-nums">{row.citations ?? "—"}</td>
                        <td className="p-3 align-top text-muted-foreground whitespace-nowrap text-xs">{row.lastChecked ?? "—"}</td>
                        <td className="p-3 align-top">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sentimentClass(row.sentiment)}`}>
                            {row.sentiment}
                          </span>
                        </td>
                        <td className="p-3 align-top text-muted-foreground text-xs leading-snug">{row.comment}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="szanse" className="mt-4 space-y-8">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Niewykorzystane szanse</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {data.missingQueries.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-full">Brak wpisów.</p>
              ) : (
                data.missingQueries.map((m, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-sm">
                    <p className="font-semibold text-foreground">{m.query}</p>
                    <p className="text-sm text-muted-foreground">{m.reason}</p>
                    <p className="text-sm border-t border-border pt-2 mt-2">
                      <span className="font-medium text-foreground">Rekomendacja: </span>
                      {m.recommendedAction}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Konkurenci — wynik vs marka</h2>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <MiniBarRow label="Twoja marka (analiza)" value={data.visibilityScore} max={maxCompScore} />
                {data.competitors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brak konkurentów w danych.</p>
                ) : (
                  data.competitors.map((row, i) => (
                    <MiniBarRow key={i} label={row.name} value={row.visibilityScore ?? 0} max={maxCompScore} />
                  ))
                )}
              </div>
              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left">
                      <th className="p-3 font-medium">Marka</th>
                      <th className="p-3 font-medium">Wynik</th>
                      <th className="p-3 font-medium">Wzmianki</th>
                      <th className="p-3 font-medium">Sentyment</th>
                      <th className="p-3 font-medium min-w-[200px]">Przewaga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.competitors.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-muted-foreground">
                          Brak wpisów.
                        </td>
                      </tr>
                    ) : (
                      data.competitors.map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="p-3 align-top font-medium">{row.name}</td>
                          <td className="p-3 align-top tabular-nums">{row.visibilityScore ?? "—"}</td>
                          <td className="p-3 align-top tabular-nums">{row.mentions ?? "—"}</td>
                          <td className="p-3 align-top">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sentimentClass(row.sentiment)}`}>
                              {row.sentiment}
                            </span>
                          </td>
                          <td className="p-3 align-top text-muted-foreground text-xs">{row.advantage}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="plan" className="mt-4 space-y-10">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Rekomendowane działania</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {data.recommendedActions.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-full">Brak wpisów.</p>
              ) : (
                data.recommendedActions.map((a, i) => (
                  <div key={i} className={`rounded-xl border p-4 space-y-2 shadow-sm ${priorityClass(a.priority)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{a.priority}</span>
                    </div>
                    <p className="font-semibold">{a.action}</p>
                    <p className="text-sm text-muted-foreground">{a.reason}</p>
                    <p className="text-sm">
                      <span className="font-medium">Efekt: </span>
                      {a.expectedImpact}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pomysły na treści</h2>
            <ul className="space-y-3">
              {data.contentIdeas.length === 0 ? (
                <li className="text-sm text-muted-foreground">Brak wpisów.</li>
              ) : (
                data.contentIdeas.map((c, i) => (
                  <li key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.type} · <span className="italic">{c.targetQuery}</span>
                    </p>
                    <p className="text-sm mt-2 text-muted-foreground">{c.goal}</p>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Testy promptów</h2>
            <div className="space-y-4">
              {data.promptTests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak wpisów.</p>
              ) : (
                data.promptTests.map((t, i) => (
                  <div key={i} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prompt użytkownika</p>
                    <p className="text-sm font-medium">{t.userPrompt}</p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Prawdopodobna odpowiedź AI</p>
                    <p className="text-sm text-muted-foreground">{t.likelyAnswer}</p>
                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="inline-flex rounded-full bg-background border border-border px-2 py-0.5 text-xs">
                        Szansa marki: {t.brandInclusionChance}
                      </span>
                    </div>
                    <p className="text-sm border-t border-border pt-3 mt-2">
                      <span className="font-medium">Jak poprawić: </span>
                      {t.howToImprove}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>
      {panelLayout === "steps" && onRequestFullTabs ? (
        <p className="text-center">
          <button
            type="button"
            onClick={onRequestFullTabs}
            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Pokaż pełny panel (wszystkie sekcje naraz)
          </button>
        </p>
      ) : null}
    </div>
  );
}

/** Lewa kolumna strony: skrót metryk z odpowiedzi AI (bez formularza). */
export function LlmVisibilityInsightSidebar({
  data,
  brandName,
  websiteUrl,
  industry,
  lastScanAt,
  isLoading,
  onConfigureInputs,
}: {
  data: LlmVisibilityAnalysis | null;
  brandName: string;
  websiteUrl: string;
  industry: string;
  lastScanAt: string | null;
  isLoading: boolean;
  onConfigureInputs: () => void;
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center text-center shadow-sm">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">Model generuje dane…</p>
        <p className="text-xs text-muted-foreground mt-2 max-w-[240px]">
          Za chwilę pojawi się tu skrót wyników (wynik, procenty, sentyment).
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 space-y-4 shadow-sm">
        <p className="text-sm text-muted-foreground leading-relaxed">
          W tej kolumnie wyświetlamy zwizualizowane dane z analizy AI — nie formularz. Otwórz okno z danymi marki i uruchom analizę.
        </p>
        <button
          type="button"
          onClick={onConfigureInputs}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-foreground text-background py-3 text-sm font-semibold hover:opacity-90"
        >
          <SlidersHorizontal className="h-4 w-4" /> Dane wejściowe i uruchomienie
        </button>
      </div>
    );
  }

  const derived = computeDerivedMetrics(data);
  const breakdown = sentimentBreakdown(data);
  const totalM = data.brandMentions.length;
  const citationDisplay =
    derived.citationRate != null ? `${Math.round(derived.citationRate)}%` : "—";
  const sovDisplay = derived.shareOfVoicePercent != null ? `${Math.round(derived.shareOfVoicePercent)}%` : "—";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Podgląd z analizy AI</h2>
          <p className="mt-1 font-display text-lg font-bold tracking-tight truncate">{brandName.trim() || "Marka"}</p>
          {websiteUrl.trim() ? (
            <p className="text-xs text-muted-foreground truncate mt-0.5" title={websiteUrl}>
              {websiteUrl}
            </p>
          ) : null}
          {industry.trim() ? (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium text-foreground">Branża: </span>
              {industry}
            </p>
          ) : null}
          {lastScanAt ? (
            <p className="text-[11px] text-muted-foreground mt-2">
              Skan:{" "}
              <time dateTime={lastScanAt} className="font-medium text-foreground">
                {new Date(lastScanAt).toLocaleString("pl-PL")}
              </time>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onConfigureInputs}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted"
          title="Zmień dane wejściowe i ponów analizę"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Dane
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start gap-6">
        <ScoreRing score={data.visibilityScore} />
        <div className="flex-1 min-w-0 space-y-3">
          <p className="text-sm leading-snug text-foreground line-clamp-5">{data.summary}</p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden max-w-full">
            <div className="h-full bg-foreground/80 rounded-full" style={{ width: `${data.visibilityScore}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-2 grid-cols-2">
        <KpiCard
          label="Pokrycie promptów"
          value={`${derived.answeredPromptsPercent}%`}
          sub={`${data.brandMentions.filter((r) => r.appears).length}/${totalM || "—"}`}
        />
        <KpiCard label="Cytowalność" value={citationDisplay} sub="szac." />
        <KpiCard label="Share of voice" value={sovDisplay} sub="AI" />
        <KpiCard label="Prompty" value={String(totalM)} sub="w analizie" />
      </div>

      {totalM > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sentyment promptów</p>
          <div className="grid gap-2">
            {breakdown.map((b) => {
              const pct = Math.round((b.count / totalM) * 100);
              const color =
                b.key === "pozytywny" ? "bg-emerald-500" : b.key === "negatywny" ? "bg-red-500" : "bg-muted-foreground/50";
              return (
                <div key={b.key} className="flex items-center gap-2 text-xs">
                  <span className="capitalize font-medium w-24 shrink-0">{b.key}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="tabular-nums text-muted-foreground w-10 text-right shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
