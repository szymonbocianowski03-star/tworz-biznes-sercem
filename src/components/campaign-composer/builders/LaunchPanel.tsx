import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { labelPublishStatus, labelPublishStep } from "@/lib/campaignComposerLabels";
import type { BuilderProps } from "./shared";

/** Wspólny panel publikacji + historii prób (kolejka launch). */
export function LaunchPanel({
  jobs,
  jobItems,
  blocking,
  onEnqueue,
  onRefreshJobs,
  onLoadItems,
  requireOwnRiskAck = false,
}: Pick<
  BuilderProps,
  "jobs" | "jobItems" | "blocking" | "onEnqueue" | "onRefreshJobs" | "onLoadItems"
> & { requireOwnRiskAck?: boolean }) {
  const liveJobs = jobs.filter((j) => j.intent === "go_live");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acceptedRisk, setAcceptedRisk] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const canPublish = blocking === 0;

  const runPublish = async () => {
    if (!canPublish) {
      toast.error("Napraw błędy krytyczne przed publikacją.");
      return;
    }
    if (requireOwnRiskAck && !acceptedRisk) {
      toast.error("Musisz zaakceptować publikację na własne ryzyko.");
      return;
    }
    setPublishing(true);
    try {
      onEnqueue("go_live");
      setConfirmOpen(false);
      setAcceptedRisk(false);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={!canPublish}
            title={canPublish ? "Opublikuj kampanię na koncie reklamowym" : "Napraw błędy krytyczne w przeglądzie"}
            onClick={() => setConfirmOpen(true)}
          >
            Opublikuj kampanię
          </Button>
          {!canPublish && (
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-400">
              {blocking} {blocking === 1 ? "błąd blokuje" : "błędy blokują"} publikację
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Publikacja tworzy obiekty na koncie reklamowym. Działa <strong>na własne ryzyko</strong> — odpowiadasz za budżet,
          treści i zgodność z polityką platformy. Przed wysłaniem wymagane jest potwierdzenie.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onRefreshJobs}>
          Odśwież listę
        </Button>
      </div>

      <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-900 dark:border-blue-700/50 dark:bg-blue-950/40 dark:text-blue-200">
        <p className="font-semibold">Anulowanie / zatrzymanie kampanii</p>
        <p className="mt-1">
          Aby anulować lub zatrzymać kampanię, musisz to zrobić bezpośrednio w panelu{" "}
          <strong>Google Ads</strong> (lub innej platformy reklamowej, na której kampania została opublikowana). Po
          anulowaniu <strong>sprawdź jeszcze raz w Google Ads, czy kampania została poprawnie zamknięta</strong>.
        </p>
        <p className="mt-2">
          Integracja działa w trybie <strong>beta</strong> — jakiekolwiek problemy prosimy zgłaszać na{" "}
          <a href="mailto:support@marketingnow.tech" className="font-semibold underline underline-offset-2">
            support@marketingnow.tech
          </a>
          .
        </p>
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

      {liveJobs.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">⚠️ Uwaga — zweryfikuj publikację w swoim koncie</p>
          <p className="mt-1">
            Status poniżej pochodzi z odpowiedzi API i może nie odzwierciedlać stanu docelowego (moderacja, płatności,
            akceptacja platformy). <strong>Zaloguj się do swojego konta reklamowego</strong> (np. Google Ads / Meta) i
            sprawdź, czy kampania, budżet i reklamy zostały utworzone poprawnie oraz czy mają właściwy status.
          </p>
        </div>
      )}

      {jobItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Etapy publikacji</p>
          <ul className="mt-2 space-y-2 text-xs">
            {jobItems.map((it, idx) => (
              <li key={idx} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="font-medium">{labelPublishStep(it.step_kind)}</p>
                <p className="text-muted-foreground">{labelPublishStatus(it.status)}</p>
                {it.provider_message && <p className="mt-1 break-words text-destructive">{it.provider_message}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h3 className="font-display text-lg font-bold">Potwierdź publikację</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Kampania zostanie utworzona na połączonym koncie reklamowym. Działasz{" "}
              <strong className="text-foreground">na własne ryzyko</strong> — odpowiadasz za budżet, treść reklam,
              odbiorców i zgodność z regulaminem platformy. MarketingNow nie ponosi odpowiedzialności za skutki publikacji.
            </p>
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
              ⚠️ Po publikacji <strong>koniecznie sprawdź w swoim koncie reklamowym</strong>, czy kampania została
              utworzona prawidłowo (budżet, reklamy, status, moderacja).
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <Checkbox
                checked={acceptedRisk}
                onCheckedChange={(v) => setAcceptedRisk(v === true)}
                className="mt-0.5"
              />
              <span>
                Akceptuję publikację <strong>na własne ryzyko</strong> i potwierdzam, że sprawdziłem treść oraz budżet.
              </span>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!acceptedRisk || publishing || !canPublish}
                onClick={() => void runPublish()}
              >
                {publishing ? "Publikowanie…" : "Tak, opublikuj"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConfirmOpen(false);
                  setAcceptedRisk(false);
                }}
              >
                Anuluj
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Toast-owy wrapper anulowania używany w builderach. */
export function notifyCancelled() {
  toast.success("Anulowano publikację w toku");
}
