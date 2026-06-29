import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CampaignComposerNav } from "@/components/campaign-composer/CampaignComposerNav";
import { ccEnsureWorkspace, ccListCollections, ccCreateCollection } from "@/modules/campaign-composer/campaign-composer.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/campaign-composer/collections")({
  component: CollectionsPage,
});

function CollectionsPage() {
  const fnWs = useServerFn(ccEnsureWorkspace);
  const fnList = useServerFn(ccListCollections);
  const fnCreate = useServerFn(ccCreateCollection);
  const [workspaceId, setWs] = useState<string | null>(null);
  const [rows, setRows] = useState<{ id: string; name: string; description: string | null }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { workspaceId: w } = await fnWs({ data: {} });
      setWs(w);
      const { collections } = await fnList({ data: { workspaceId: w } });
      setRows((collections ?? []) as typeof rows);
    })();
  }, [fnList, fnWs]);

  const create = async () => {
    if (!workspaceId) return;
    const name = window.prompt("Nazwa zbioru kampanii");
    if (!name?.trim()) return;
    await fnCreate({ data: { workspaceId, name: name.trim() } });
    toast.success("Utworzono zbiór");
    const { collections } = await fnList({ data: { workspaceId } });
    setRows((collections ?? []) as typeof rows);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <CampaignComposerNav />
      <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-zinc-50">Zbiory kampanii</h1>
          <Button type="button" size="sm" onClick={() => void create()}>
            Nowy zbiór
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Grupuj szkice kampanii według produktu, sezonu lub klienta — żeby łatwiej je znaleźć na liście.
        </p>
        <ul className="mt-6 space-y-2">
          {rows.length === 0 ? (
            <li className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              Nie masz jeszcze zbiorów. Kliknij <strong className="text-foreground">Nowy zbiór</strong>, aby utworzyć pierwszy.
            </li>
          ) : (
            rows.map((c) => (
              <li key={c.id} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="font-medium">{c.name}</p>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
              </li>
            ))
          )}
        </ul>
        <Link to="/campaign-composer" className="mt-6 inline-block text-sm text-foreground underline underline-offset-2 hover:opacity-80">
          Wróć do listy szkiców
        </Link>
      </div>
    </div>
  );
}
