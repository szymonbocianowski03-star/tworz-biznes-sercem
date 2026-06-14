import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { labelPublishStatus, labelPublishStep } from "@/lib/campaignComposerLabels";
import type { BuilderProps } from "./shared";

/** Wspólny panel publikacji + historii prób (kolejka launch). */
export function LaunchPanel({
  jobs,
  jobItems,
  activeJob,
  blocking,
  onEnqueue,
  onRefreshJobs,
  onLoadItems,
  onCancelJob,
}: Pick<BuilderProps, "jobs" | "jobItems" | "activeJob" | "blocking" | "onEnqueue" | "onRefreshJobs" | "onLoadItems" | "onCancelJob">) {
  const liveJobs = jobs.filter((j) => j.intent === "go_live");
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onEnqueue("go_live")} disabled={blocking > 0}>
            Opublikuj kampanię
          </Button>
        </div>
        {blocking > 0 && <p className="mt-2 text-xs text-red-600 dark:text-red-400">Pozostało {blocking} błędów krytycznych do poprawy.</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onRefreshJobs}>
          Odśwież listę
        </Button>
        {activeJob && (
          <Button size="sm" variant="destructive" onClick={() => onCancelJob(activeJob)}>
            Anuluj bieżącą publikację
          </Button>
        )}
      </div>

      {liveJobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
          Brak historii publikacji.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {liveJobs.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span className="text-xs text-muted-foreground">Publikacja na żywo</span>
              <span className="text-xs font-semibold">{labelPublishStatus(j.status)}</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onLoadItems(j.id)}>
                Pokaż szczegóły
              </Button>
            </li>
          ))}
        </ul>
      )}

      {jobItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Etapy publikacji</p>
          <ul className="mt-2 space-y-2 text-xs">
            {jobItems.map((it, idx) => (
              <li key={idx} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="font-medium">{labelPublishStep(it.step_kind)}</p>
                <p className="text-muted-foreground">{labelPublishStatus(it.status)}</p>
                {it.provider_message && <p className="mt-1">{it.provider_message}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Toast-owy wrapper anulowania używany w builderach. */
export function notifyCancelled() {
  toast.success("Anulowano publikację w toku");
}