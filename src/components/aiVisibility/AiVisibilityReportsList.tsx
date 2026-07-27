import { useMemo, useState } from "react";
import { FileText, GitCompare, Trash2 } from "lucide-react";
import type { AiVisibilityReport } from "@/lib/aiVisibility/types";
import { getPreviousReportForDomain } from "@/lib/aiVisibility/reportService";
import { t } from "@/lib/aiVisibility/translations";

type SortKey = "newest" | "oldest" | "scoreHigh" | "scoreLow" | "growth" | "drop";

type Props = {
  userId: string;
  reports: AiVisibilityReport[];
  onOpen: (id: string) => void;
  onCompare: (idA: string, idB: string) => void;
  onDelete: (id: string) => void;
  onNewAnalysis: () => void;
};

export function AiVisibilityReportsList({
  userId,
  reports,
  onOpen,
  onCompare,
  onDelete,
  onNewAnalysis,
}: Props) {
  const tr = t();
  const [qDomain, setQDomain] = useState("");
  const [qBrand, setQBrand] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [compareA, setCompareA] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = reports.filter((r) => r.status !== "archived");
    if (qDomain.trim()) list = list.filter((r) => r.domain.toLowerCase().includes(qDomain.toLowerCase()));
    if (qBrand.trim()) list = list.filter((r) => r.brandName.toLowerCase().includes(qBrand.toLowerCase()));

    const withDelta = list.map((r) => {
      const prev = getPreviousReportForDomain(userId, r.domain, r.id);
      return { r, delta: prev ? r.score - prev.score : 0 };
    });

    switch (sort) {
      case "oldest":
        withDelta.sort((a, b) => new Date(a.r.createdAt).getTime() - new Date(b.r.createdAt).getTime());
        break;
      case "scoreHigh":
        withDelta.sort((a, b) => b.r.score - a.r.score);
        break;
      case "scoreLow":
        withDelta.sort((a, b) => a.r.score - b.r.score);
        break;
      case "growth":
        withDelta.sort((a, b) => b.delta - a.delta);
        break;
      case "drop":
        withDelta.sort((a, b) => a.delta - b.delta);
        break;
      default:
        withDelta.sort((a, b) => new Date(b.r.createdAt).getTime() - new Date(a.r.createdAt).getTime());
    }
    return withDelta;
  }, [reports, qDomain, qBrand, sort, userId]);

  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-12 text-center max-w-lg mx-auto">
        <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">{tr.noReportsTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{tr.noReportsDesc}</p>
        <button
          type="button"
          onClick={onNewAnalysis}
          className="mt-6 rounded-full bg-foreground text-background px-6 py-2.5 text-sm font-semibold hover:opacity-90"
        >
          {tr.createFirstAnalysis}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <input
          value={qDomain}
          onChange={(e) => setQDomain(e.target.value)}
          placeholder={tr.filterDomain}
          className="rounded-lg border border-border px-3 py-2 text-sm min-w-[140px]"
        />
        <input
          value={qBrand}
          onChange={(e) => setQBrand(e.target.value)}
          placeholder={tr.filterBrand}
          className="rounded-lg border border-border px-3 py-2 text-sm min-w-[140px]"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          <option value="newest">{tr.sortNewest}</option>
          <option value="oldest">{tr.sortOldest}</option>
          <option value="scoreHigh">{tr.sortScoreHigh}</option>
          <option value="scoreLow">{tr.sortScoreLow}</option>
          <option value="growth">{tr.sortGrowth}</option>
          <option value="drop">{tr.sortDrop}</option>
        </select>
      </div>

      {compareA && (
        <p className="text-xs text-muted-foreground">
          Wybierz drugi raport tej samej domeny do porównania z:{" "}
          <span className="font-medium text-foreground">{reports.find((r) => r.id === compareA)?.domain}</span>
        </p>
      )}

      <div className="space-y-3">
        {filtered.map(({ r, delta }) => (
          <div
            key={r.id}
            className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold truncate">{r.brandName}</p>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted">
                  {r.status === "draft" ? tr.statusDraft : r.status === "archived" ? tr.statusArchived : tr.statusSaved}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{r.domain}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(r.createdAt).toLocaleString("pl-PL")} · {r.metrics.totalQueries} {tr.analyzedQueries.toLowerCase()}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <p className="font-display text-2xl font-extrabold tabular-nums">{r.score}</p>
                {delta !== 0 && (
                  <p className={`text-xs font-semibold ${delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {delta > 0 ? "+" : ""}
                    {delta} pkt.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  {tr.open}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!compareA) setCompareA(r.id);
                    else if (compareA !== r.id) {
                      onCompare(compareA, r.id);
                      setCompareA(null);
                    }
                  }}
                  className="rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-muted"
                  title={tr.compare}
                >
                  <GitCompare className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(r.id)}
                  className="rounded-lg border border-destructive/40 text-destructive px-2 py-1.5 hover:bg-destructive/10"
                  aria-label={tr.delete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
