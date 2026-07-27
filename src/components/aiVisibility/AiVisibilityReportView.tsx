import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AiVisibilityReport } from "@/lib/aiVisibility/types";
import { getVisibilityStatus, type VisibilityStatusTone } from "@/lib/aiVisibility/executiveSummary";
import { t } from "@/lib/aiVisibility/translations";

type ViewMode = "summary" | "full";

function toneClass(tone: VisibilityStatusTone): string {
  switch (tone) {
    case "danger":
      return "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400";
    case "warning":
      return "bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-400";
    case "success":
      return "bg-emerald-500/10 text-emerald-800 border-emerald-500/30 dark:text-emerald-400";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function confidenceClass(level: string): string {
  const x = level.toLowerCase();
  if (x.includes("wysok") || x.includes("high")) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400";
  if (x.includes("nisk") || x.includes("low")) return "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400";
  return "bg-amber-500/10 text-amber-800 border-amber-500/30 dark:text-amber-400";
}

function priorityLabel(value: string): string {
  const x = (value || "").toLowerCase();
  if (x.includes("high") || x.includes("wysok")) return "wysoki";
  if (x.includes("low") || x.includes("nisk")) return "niski";
  if (x.includes("medium") || x.includes("średn") || x.includes("sredn")) return "średni";
  return value;
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const color = score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-red-500";
  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90" aria-hidden>
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
          style={{ strokeDasharray: `${pct * c} ${c}` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-extrabold tabular-nums">{score}</span>
        <span className="text-[10px] uppercase text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{hint}</p>}
      {delta != null && delta !== 0 && (
        <p className={`mt-2 text-xs font-semibold ${delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
          {delta > 0 ? "+" : ""}
          {delta} {t().changeVsPrevious}
        </p>
      )}
    </div>
  );
}

type Props = {
  report: AiVisibilityReport;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  previousReport?: AiVisibilityReport | null;
};

export function AiVisibilityReportView({ report, viewMode, onViewModeChange, previousReport }: Props) {
  const tr = t();
  const status = getVisibilityStatus(report.score);
  const [inputsOpen, setInputsOpen] = useState(false);
  const deltaScore = previousReport ? report.score - previousReport.score : null;

  if (report.blocked) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 md:p-8">
          <h2 className="text-lg font-bold text-destructive">{tr.blockedReportTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed">{report.blockReason ?? report.executiveSummary}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tr.validationProblems}</p>
          <ul className="mt-2 space-y-2 text-sm">
            {(report.validationIssues.length > 0 ? report.validationIssues : report.limitations).map((issue, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>{typeof issue === "string" ? issue : issue.message}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 min-w-0">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onViewModeChange("summary")}
          className={`rounded-lg px-3 py-2 text-xs font-semibold border ${
            viewMode === "summary" ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"
          }`}
        >
          {tr.summaryView}
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("full")}
          className={`rounded-lg px-3 py-2 text-xs font-semibold border ${
            viewMode === "full" ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"
          }`}
        >
          {tr.fullReport}
        </button>
      </div>

      {report.lowConfidenceAlert && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {report.lowConfidenceAlert}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/20 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          <ScoreRing score={report.score} />
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass(status.tone)}`}>
                {status.label}
              </span>
              {report.confidence && (
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${confidenceClass(report.confidence.level)}`}
                  title={report.confidence.rationale || undefined}
                >
                  Pewność analizy: {report.confidence.level}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{status.description}</p>
            {report.confidence?.rationale && (
              <p className="text-xs text-muted-foreground leading-relaxed">{report.confidence.rationale}</p>
            )}
            <p className="text-sm md:text-base leading-relaxed text-foreground">{report.executiveSummary}</p>
            {report.topActions.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{tr.topActions}</p>
                <ol className="space-y-1.5 text-sm">
                  {report.topActions.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-semibold text-foreground shrink-0">{i + 1}.</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {deltaScore != null && (
              <p className="text-xs text-muted-foreground">
                {tr.changeVsPrevious}:{" "}
                <span className={deltaScore >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                  {deltaScore >= 0 ? "+" : ""}
                  {deltaScore} pkt.
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-foreground mb-4">{tr.metrics}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <MetricCard
            label={tr.visibilityInQueries}
            value={`${report.metrics.visibilityInQueries}%`}
            hint="Odsetek zapytań, w których marka została wspomniana."
            delta={
              previousReport
                ? report.metrics.visibilityInQueries - previousReport.metrics.visibilityInQueries
                : null
            }
          />
          <MetricCard
            label={tr.mentionsWithSources}
            value={String(report.metrics.mentionsWithSources)}
            hint="Liczba odpowiedzi ze wskazaniem źródła."
            delta={
              previousReport ? report.metrics.mentionsWithSources - previousReport.metrics.mentionsWithSources : null
            }
          />
          <MetricCard
            label={tr.aiShareOfVoice}
            value={`${report.metrics.aiShareOfVoice}%`}
            hint="Udział marki na tle konkurentów w odpowiedziach."
            delta={previousReport ? report.metrics.aiShareOfVoice - previousReport.metrics.aiShareOfVoice : null}
          />
          <MetricCard label={tr.analyzedQueries} value={String(report.metrics.totalQueries)} />
          <MetricCard
            label={tr.sentiment}
            value={`+${report.metrics.sentiment.positive} / ~${report.metrics.sentiment.neutral} / −${report.metrics.sentiment.negative}`}
            hint={`${tr.positive}, ${tr.neutral}, ${tr.negative}`}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold mb-1">{tr.scoringBreakdown}</h2>
        <p className="text-xs text-muted-foreground mb-3">Wynik {report.score}/100 obliczony według reguł, nie przez arbitralną ocenę AI.</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] uppercase text-muted-foreground">{tr.brandMentionRate} (35%)</p>
            <p className="font-bold tabular-nums">{report.scoringBreakdown.brandMentionRate}%</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] uppercase text-muted-foreground">{tr.answerShare} (25%)</p>
            <p className="font-bold tabular-nums">{report.scoringBreakdown.answerShare}%</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] uppercase text-muted-foreground">{tr.positionScore} (20%)</p>
            <p className="font-bold tabular-nums">{report.scoringBreakdown.averagePositionScore}%</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] uppercase text-muted-foreground">{tr.sourcePresence} (10%)</p>
            <p className="font-bold tabular-nums">{report.scoringBreakdown.sourcePresence}%</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] uppercase text-muted-foreground">{tr.sentimentQuality} (10%)</p>
            <p className="font-bold tabular-nums">{report.scoringBreakdown.sentimentQuality}%</p>
          </div>
        </div>
      </section>

      <QueriesSection report={report} />

      {report.limitations?.length > 0 && (
        <section className="rounded-xl border border-border bg-muted/20 p-5">
          <h2 className="text-sm font-bold text-foreground mb-1">Ograniczenia analizy</h2>
          <ul className="space-y-1.5 text-sm">
            {report.limitations.map((l, i) => (
              <li key={i} className="flex gap-2 text-muted-foreground">
                <span className="shrink-0 text-foreground">•</span>
                <span className="leading-relaxed">{l}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setInputsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50"
        >
          {tr.analysisSettings}
          <ChevronDown className={`h-4 w-4 transition-transform ${inputsOpen ? "rotate-180" : ""}`} />
        </button>
        {inputsOpen && (
          <div className="px-4 pb-4 pt-0 grid sm:grid-cols-2 gap-3 text-sm border-t border-border">
            <div>
              <span className="text-xs text-muted-foreground">{tr.domain}</span>
              <p className="font-medium break-all">{report.normalizedUrl}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">{tr.brandName}</span>
              <p className="font-medium">{report.brandName}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">{tr.industry}</span>
              <p>{report.industry || "—"}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">{tr.targetAudience}</span>
              <p>{report.targetAudience || "—"}</p>
            </div>
            {report.competitors.length > 0 ? (
              <div className="sm:col-span-2">
                <span className="text-xs text-muted-foreground">{tr.competitors}</span>
                <p>{report.competitors.join(", ")}</p>
              </div>
            ) : (
              <p className="sm:col-span-2 text-xs text-muted-foreground italic">{tr.noCompetitors}</p>
            )}
          </div>
        )}
      </section>

      {viewMode === "full" && (
        <>
          <section>
            <h2 className="text-sm font-bold mb-3">{tr.competitorsSection}</h2>
            {report.competitorsAnalysis.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-6">{tr.noCompetitors}</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {report.competitorsAnalysis.map((c, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-4">
                    <p className="font-semibold">{c.competitor}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {tr.mentions}: {c.mentions} · {tr.shareOfVoice}: {c.shareOfVoice}%
                    </p>
                    {c.strengths[0] && (
                      <p className="mt-2 text-sm">
                        <span className="font-medium">{tr.advantage}: </span>
                        {c.strengths.join(" ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-bold mb-3">{tr.recommendations}</h2>
            <div className="space-y-3">
              {report.recommendations.map((r, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex flex-wrap gap-2 items-center">
                    <p className="font-semibold text-sm">{r.title}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted">
                      {tr.priorityLabel}: {priorityLabel(r.priority)}
                    </span>
                  </div>
                  <p className="text-xs">
                    <span className="font-medium">{tr.problem}: </span>
                    {r.problem}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{tr.why}: </span>
                    {r.whyItMatters}
                  </p>
                  <p className="text-xs">
                    <span className="font-medium">{tr.howToFix}: </span>
                    {r.howToFix}
                  </p>
                  {r.basedOnQueries && r.basedOnQueries.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{tr.basedOnQueries}: </span>
                      {r.basedOnQueries.join("; ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold mb-3">{tr.thirtyDayPlan}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  [tr.week1, report.thirtyDayPlan.week1],
                  [tr.week2, report.thirtyDayPlan.week2],
                  [tr.week3, report.thirtyDayPlan.week3],
                  [tr.week4, report.thirtyDayPlan.week4],
                ] as const
              ).map(([label, tasks]) => (
                <div key={label} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {tasks.length ? (
                      tasks.map((task, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="shrink-0 font-medium">{j + 1}.</span>
                          <span>{task}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-muted-foreground text-xs">{tr.noData}</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold mb-3">{tr.contentIdeas}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {report.contentIdeas.map((idea, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-1">
                  <p className="font-semibold text-sm">{idea.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {idea.format} · {idea.targetQuery}
                  </p>
                  <p className="text-xs">{idea.whyItHelps}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function QueriesSection({ report }: { report: AiVisibilityReport }) {
  const tr = t();
  return (
    <section>
      <h2 className="text-sm font-bold mb-3">{tr.queriesUsedInAnalysis}</h2>
      {report.analyzedQueries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr.noQueries}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3 font-semibold">{tr.query}</th>
                <th className="p-3 font-semibold">{tr.model}</th>
                <th className="p-3 font-semibold">{tr.brandAppeared}</th>
                <th className="p-3 font-semibold">{tr.position}</th>
                <th className="p-3 font-semibold">{tr.sourceMentioned}</th>
                <th className="p-3 font-semibold">{tr.sourceLinks}</th>
                <th className="p-3 font-semibold">{tr.sentiment}</th>
                <th className="p-3 font-semibold min-w-[180px]">{tr.comment}</th>
              </tr>
            </thead>
            <tbody>
              {report.analyzedQueries.map((q, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-medium align-top">{q.query}</td>
                  <td className="p-3 text-muted-foreground align-top">{q.model}</td>
                  <td className="p-3 align-top">{q.brandMentioned ? tr.yes : tr.no}</td>
                  <td className="p-3 align-top tabular-nums">{q.brandPosition ?? "—"}</td>
                  <td className="p-3 align-top">{q.sourceMentioned ? tr.yes : tr.no}</td>
                  <td className="p-3 align-top text-xs">
                    {(q.sourceUrls ?? []).length > 0 ? (
                      <ul className="space-y-1">
                        {q.sourceUrls.map((url, j) => (
                          <li key={j}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-foreground underline break-all">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 align-top capitalize">{q.sentiment}</td>
                  <td className="p-3 text-muted-foreground align-top text-xs leading-relaxed">{q.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
