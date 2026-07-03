import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CampaignComposerNav } from "@/components/campaign-composer/CampaignComposerNav";
import { ccGetDraft } from "@/modules/campaign-composer/campaign-composer.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { labelLifecycle } from "@/lib/campaignComposerLabels";

export const Route = createFileRoute("/campaign-composer/campaign/$draftId")({
  component: CampaignOpsPage,
});

function CampaignOpsPage() {
  const { draftId } = Route.useParams();
  const fnGet = useServerFn(ccGetDraft);
  const [title, setTitle] = useState("");
  const [lifecycle, setLifecycle] = useState("");

  useEffect(() => {
    (async () => {
      const { draft } = await fnGet({ data: { id: draftId } });
      if (!draft) return;
      setTitle(draft.title);
      setLifecycle(draft.lifecycle);
    })();
  }, [draftId, fnGet]);

  const soon = () =>
    toast.message("Ta operacja będzie dostępna po pełnym połączeniu z kontem reklamowym.", {
      description: "Na razie możesz edytować szkic i publikować z edytora kampanii.",
    });

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <CampaignComposerNav />
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <Link to="/campaign-composer/draft/$draftId" params={{ draftId }} className="text-xs text-foreground underline underline-offset-2 hover:opacity-80">
          ← Wróć do szkicu
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold">{title || "Kampania"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Status: <strong className="text-foreground">{labelLifecycle(lifecycle)}</strong>
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={soon}>
            Wstrzymaj kampanię
          </Button>
          <Button size="sm" variant="outline" onClick={soon}>
            Wznów kampanię
          </Button>
          <Button size="sm" variant="secondary" onClick={soon}>
            Archiwizuj
          </Button>
          <Button size="sm" variant="destructive" onClick={soon}>
            Usuń kampanię
          </Button>
        </div>
        <p className="mt-8 text-sm text-muted-foreground leading-relaxed">
          Zarządzanie kampanią po stronie Meta lub LinkedIn (pauza, wznowienie, archiwum) pojawi się tutaj, gdy konto reklamowe jest
          w pełni połączone w Integracjach.
        </p>
      </div>
    </div>
  );
}
