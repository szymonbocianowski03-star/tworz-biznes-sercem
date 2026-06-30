import { Download } from "lucide-react";
import type { SeoAuditAnalysis } from "@/lib/seoAuditAnalysis";
import { checklistTitle, quickWinAction, quickWinTitle } from "@/lib/seoAuditAnalysis";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Pole CSV bezpieczne dla Excela (cudzysłowy, średniki, nowe linie). */
function csvCell(value: string): string {
  const v = value ?? "";
  if (/[";\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Pobiera plan 30 dni jako CSV otwierany w Excelu (UTF-8 BOM, separator ;). */
function downloadThirtyDayPlanCsv(plan: SeoAuditAnalysis["thirtyDayPlan"], url?: string): void {
  if (typeof window === "undefined") return;
  const weeks: [string, string[]][] = [
    ["Tydzień 1", plan.week1],
    ["Tydzień 2", plan.week2],
    ["Tydzień 3", plan.week3],
    ["Tydzień 4", plan.week4],
  ];
  const rows: string[] = [];
  if (url) rows.push(`Plan SEO 30 dni;${csvCell(url)}`, "");
  rows.push("Tydzień;Nr;Zadanie");
  for (const [label, tasks] of weeks) {
    tasks.forEach((task, i) => {
      rows.push(`${csvCell(label)};${i + 1};${csvCell(task)}`);
    });
  }
  const csv = "\uFEFF" + rows.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = href;
  a.download = `plan-seo-30-dni-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

function ScoreRing({ score, label }: { score: number; label?: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const dash = pct * c;
  const color = score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-red-500";
  return (
    <div className="relative inline-flex flex-col items-center justify-center shrink-0">
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
      {label && (
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-extrabold tabular-nums tracking-tight">{value}%</p>
    </div>
  );
}

function priorityClass(level: string): string {
  const x = level.toLowerCase();
  if (x === "high") return "bg-red-500/15 text-red-700 dark:text-red-400";
  if (x === "low") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
}

function RecList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((t, i) => (
          <li key={i} className="text-sm text-muted-foreground flex gap-2">
            <span className="text-foreground font-medium shrink-0">{i + 1}.</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SeoAuditDashboard({ data }: { data: SeoAuditAnalysis }) {
  const snap = data.pageOverview;
  const cats = data.scores;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 md:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center">
          <ScoreRing score={data.overallScore} label="Wynik SEO" />
          <div className="flex-1 min-w-0 space-y-4">
            <p className="text-sm md:text-base text-foreground leading-relaxed">{data.summary}</p>
            {snap.fetchedUrl && (
              <p className="text-xs text-muted-foreground truncate" title={snap.fetchedUrl}>
                Audytowana strona: <span className="font-medium text-foreground">{snap.fetchedUrl}</span>
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Techniczne" value={cats.technical} />
          <KpiCard label="On-page" value={cats.onPage} />
          <KpiCard label="Treści" value={cats.content} />
          <KpiCard label="Autorytet" value={cats.authority} />
        </div>
      </div>

      <Tabs defaultValue="przeglad" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="przeglad" className="text-xs sm:text-sm">
            Przegląd
          </TabsTrigger>
          <TabsTrigger value="problemy" className="text-xs sm:text-sm">
            Problemy
          </TabsTrigger>
          <TabsTrigger value="checklist" className="text-xs sm:text-sm">
            Checklista
          </TabsTrigger>
          <TabsTrigger value="quickwins" className="text-xs sm:text-sm">
            Szybkie zmiany
          </TabsTrigger>
          <TabsTrigger value="plan" className="text-xs sm:text-sm">
            Plan 30 dni
          </TabsTrigger>
          <TabsTrigger value="rekomendacje" className="text-xs sm:text-sm">
            Role
          </TabsTrigger>
        </TabsList>

        <TabsContent value="przeglad" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Title</p>
              <p className="mt-1 font-medium break-words">{snap.title || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Meta description</p>
              <p className="mt-1 text-muted-foreground break-words">{snap.metaDescription || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">H1</p>
              <p className="mt-1 font-medium break-words">{snap.h1 || "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Liczba H1: {snap.h1Count} · H2: {snap.h2Count}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Canonical / indeks</p>
              <p className="mt-1 break-words">{snap.canonical || "Brak tagu canonical"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Status indeksacji: {snap.indexStatus || "—"} · ~{snap.wordCount ?? 0} słów
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Schema JSON-LD</p>
              <p className="mt-1 text-xs text-muted-foreground break-words whitespace-pre-wrap font-mono leading-relaxed">
                {snap.schemaJsonLd || "—"}
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="problemy" className="mt-4 space-y-3">
          {data.keyProblems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak zidentyfikowanych problemów w raporcie.</p>
          ) : (
            data.keyProblems.map((p, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <p className="text-sm font-semibold text-foreground">{p.problem}</p>
                  <span className={`text-[10px] font-bold uppercase rounded px-2 py-0.5 ${priorityClass(p.priority)}`}>
                    {p.priority}
                  </span>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    trudność: {p.difficulty} · wpływ: {p.estimatedImpact}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Dlaczego: </span>
                  {p.whyItMatters}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Jak naprawić: </span>
                  {p.howToFix}
                </p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="checklist" className="mt-4">
          <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm space-y-2">
            {data.checklist.map((item, i) => {
              const title = checklistTitle(item);
              const detail = typeof item === "object" && item.detail ? item.detail : null;
              const status = typeof item === "object" && item.status ? item.status : null;
              return (
                <div key={i} className="flex gap-3 py-2 border-b border-border last:border-0">
                  <span className="text-xs font-medium text-muted-foreground shrink-0 w-6">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-foreground">{title}</p>
                      {status && (
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">{status}</span>
                      )}
                    </div>
                    {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="quickwins" className="mt-4 space-y-6">
          {data.tenQuickChanges.length === 0 && data.quickWins.length === 0 && (
            <p className="text-sm text-muted-foreground">Brak szybkich zmian w raporcie — uruchom audyt ponownie.</p>
          )}
          {data.tenQuickChanges.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-3">10 szybkich zmian</h3>
              <ol className="space-y-2">
                {data.tenQuickChanges.map((t, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="font-medium text-foreground shrink-0">{i + 1}.</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {data.quickWins.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.quickWins.map((w, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground">{quickWinTitle(w)}</p>
                  {quickWinAction(w) && (
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{quickWinAction(w)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          <div className="space-y-4">
            {!(
              data.thirtyDayPlan.week1.length ||
              data.thirtyDayPlan.week2.length ||
              data.thirtyDayPlan.week3.length ||
              data.thirtyDayPlan.week4.length
            ) ? (
              <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-6">
                Plan 30 dni nie został wygenerowany — uruchom audyt ponownie.
              </p>
            ) : (
              <>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => downloadThirtyDayPlanCsv(data.thirtyDayPlan, data.pageOverview.fetchedUrl)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Pobierz w Excelu
                  </button>
                </div>
                {(
                  [
                    ["Tydzień 1", data.thirtyDayPlan.week1],
                    ["Tydzień 2", data.thirtyDayPlan.week2],
                    ["Tydzień 3", data.thirtyDayPlan.week3],
                    ["Tydzień 4", data.thirtyDayPlan.week4],
                  ] as const
                ).map(([label, tasks]) => (
                  <div key={label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-foreground">{label}</h3>
                    {tasks.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">Brak zadań na ten tydzień.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {tasks.map((t, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex gap-2">
                            <span className="text-foreground font-medium shrink-0">{i + 1}.</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rekomendacje" className="mt-4 space-y-4">
          {!data.recommendations.seoSpecialist.length &&
          !data.recommendations.contentMarketer.length &&
          !data.recommendations.developer.length ? (
            <p className="text-sm text-muted-foreground">Brak rekomendacji per rola — uruchom audyt ponownie.</p>
          ) : null}
          <RecList title="Specjalista SEO" items={data.recommendations.seoSpecialist} />
          <RecList title="Content marketer" items={data.recommendations.contentMarketer} />
          <RecList title="Developer" items={data.recommendations.developer} />
          {data.agentBrief && (
            <div className="rounded-2xl border border-border bg-muted/20 p-5">
              <h3 className="text-sm font-bold text-foreground mb-2">Brief do agenta</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{data.agentBrief}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
