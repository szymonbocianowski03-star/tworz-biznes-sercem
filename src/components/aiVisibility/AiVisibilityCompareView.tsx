import type { ReportCompareResult } from "@/lib/aiVisibility/types";
import { t } from "@/lib/aiVisibility/translations";

type Props = {
  data: ReportCompareResult;
  onClose: () => void;
};

export function AiVisibilityCompareView({ data, onClose }: Props) {
  const tr = t();
  const { reportA: older, reportB: newer } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{tr.compareTitle}</h2>
        <button type="button" onClick={onClose} className="text-sm font-medium hover:underline">
          Zamknij porównanie
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        {older.domain} · {new Date(older.createdAt).toLocaleDateString("pl-PL")} →{" "}
        {new Date(newer.createdAt).toLocaleDateString("pl-PL")}
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{tr.previousScore}</p>
          <p className="text-2xl font-bold tabular-nums">{older.score}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{tr.currentScore}</p>
          <p className="text-2xl font-bold tabular-nums">{newer.score}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{tr.scoreDelta}</p>
          <p className={`text-2xl font-bold tabular-nums ${data.scoreDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {data.scoreDelta >= 0 ? "+" : ""}
            {data.scoreDelta}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{tr.scoreDeltaPct}</p>
          <p className="text-2xl font-bold tabular-nums">{data.scoreDeltaPct}%</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border p-3">
          {tr.visibilityInQueries}: {data.metricsDelta.visibilityInQueries >= 0 ? "+" : ""}
          {data.metricsDelta.visibilityInQueries} p.p.
        </div>
        <div className="rounded-lg border p-3">
          {tr.mentionsWithSources}: {data.metricsDelta.mentionsWithSources >= 0 ? "+" : ""}
          {data.metricsDelta.mentionsWithSources}
        </div>
        <div className="rounded-lg border p-3">
          {tr.aiShareOfVoice}: {data.metricsDelta.aiShareOfVoice >= 0 ? "+" : ""}
          {data.metricsDelta.aiShareOfVoice} p.p.
        </div>
      </div>

      {data.newQueriesWithBrand.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">{tr.newQueriesWithBrand}</p>
          <ul className="text-sm space-y-1 list-disc pl-5">
            {data.newQueriesWithBrand.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {data.lostQueries.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">{tr.lostQueries}</p>
          <ul className="text-sm space-y-1 list-disc pl-5 text-muted-foreground">
            {data.lostQueries.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {data.stillRelevantRecommendations.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">{tr.stillRelevantRecs}</p>
          <ul className="text-sm space-y-1">
            {data.stillRelevantRecommendations.map((r) => (
              <li key={r.title}>· {r.title}</li>
            ))}
          </ul>
        </div>
      )}

      {data.newRecommendations.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">{tr.newRecs}</p>
          <ul className="text-sm space-y-1">
            {data.newRecommendations.map((r) => (
              <li key={r.title}>· {r.title}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
