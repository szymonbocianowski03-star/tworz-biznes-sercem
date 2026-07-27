import { Loader2 } from "lucide-react";
import type { AiVisibilityReport } from "@/lib/aiVisibility/types";
import { getVisibilityStatus } from "@/lib/aiVisibility/executiveSummary";
import { t } from "@/lib/aiVisibility/translations";

type Props = {
  report: AiVisibilityReport | null;
  lastScanAt: string | null;
  isLoading: boolean;
};

export function AiVisibilityCompactSidebar({ report, lastScanAt, isLoading }: Props) {
  const tr = t();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 flex flex-col items-center text-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <p className="text-sm font-medium text-foreground">{tr.analyzing}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground leading-relaxed">
        {tr.emptyWorkspace}
      </div>
    );
  }

  const status = getVisibilityStatus(report.score);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4 sticky top-24">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr.visibilityScore}</p>
        <p className="font-display text-4xl font-extrabold tabular-nums mt-1">{report.score}</p>
        <p className="text-xs font-medium mt-2">{status.label}</p>
      </div>
      {lastScanAt && (
        <p className="text-xs text-muted-foreground">
          {tr.lastScan}: {new Date(lastScanAt).toLocaleString("pl-PL")}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-lg font-bold tabular-nums">{report.metrics.visibilityInQueries}%</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{tr.visibilityInQueries}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-lg font-bold tabular-nums">{report.metrics.aiShareOfVoice}%</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{tr.aiShareOfVoice}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-lg font-bold tabular-nums">{report.metrics.mentionsWithSources}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{tr.mentionsWithSources}</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-lg font-bold tabular-nums">{report.metrics.totalQueries}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{tr.analyzedQueries}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">{report.executiveSummary}</p>
    </div>
  );
}
