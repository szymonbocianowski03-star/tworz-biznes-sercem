import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CampaignComposerNav } from "@/components/campaign-composer/CampaignComposerNav";
import { ccEnsureWorkspace, ccListAssets, ccPatchAsset, ccDeleteAsset } from "@/modules/campaign-composer/campaign-composer.functions";
import { importGeneratedImageToCampaignAsset } from "@/lib/campaignAssetImport";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/campaign-composer/media")({
  component: MediaPage,
});

function MediaPage() {
  const fnWs = useServerFn(ccEnsureWorkspace);
  const fnList = useServerFn(ccListAssets);
  const fnPatch = useServerFn(ccPatchAsset);
  const fnDel = useServerFn(ccDeleteAsset);
  const [workspaceId, setWs] = useState<string | null>(null);
  const [assets, setAssets] = useState<{ id: string; display_name: string | null; public_url: string }[]>([]);
  const [gens, setGens] = useState<{ id: string; image_url: string; prompt: string }[]>([]);
  const [pick, setPick] = useState<string[]>([]);

  const reload = async (w: string) => {
    const { assets: a } = await fnList({ data: { workspaceId: w } });
    setAssets((a ?? []) as typeof assets);
  };

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { workspaceId: w } = await fnWs({ data: {} });
      setWs(w);
      await reload(w);
      const { data: imgs } = await supabase.from("generated_images").select("id,image_url,prompt").eq("user_id", u.user.id).limit(30);
      setGens(imgs ?? []);
    })();
  }, [fnList, fnWs]);

  const togglePick = (id: string) => {
    setPick((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= 5) {
        toast.message("Możesz zaznaczyć do 5 obrazów naraz.");
        return s;
      }
      return [...s, id];
    });
  };

  const importSel = async () => {
    if (!workspaceId || pick.length === 0) return;
    let ok = 0;
    for (const id of pick) {
      const gen = gens.find((g) => g.id === id);
      if (!gen) continue;
      const r = await importGeneratedImageToCampaignAsset({
        workspaceId,
        generatedImageId: gen.id,
        imageUrl: gen.image_url,
        prompt: gen.prompt,
      });
      if (r.ok) ok += 1;
      else toast.error(r.error);
    }
    if (ok > 0) {
      toast.success(`Dodano ${ok} ${ok === 1 ? "materiał" : "materiały"} do biblioteki kampanii`);
    }
    setPick([]);
    await reload(workspaceId);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <CampaignComposerNav />
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="font-display text-2xl font-bold">Biblioteka mediów</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Tutaj możesz wcześniej dodać obrazy z Zasobów do panelu kampanii. Przy tworzeniu kampanii wybierzesz zdjęcia i filmy
          bezpośrednio w kroku <strong className="text-foreground">Kreacje i media</strong> w szkicu.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {gens.map((g) => {
            const on = pick.includes(g.id);
            return (
              <button
                type="button"
                key={g.id}
                onClick={() => togglePick(g.id)}
                className={`relative overflow-hidden rounded-xl border-2 text-left ${on ? "border-foreground" : "border-transparent"}`}
              >
                <img src={g.image_url} alt="" className="aspect-square w-full object-cover" />
                {on && <span className="absolute right-2 top-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">✓</span>}
              </button>
            );
          })}
        </div>
        <Button className="mt-4" disabled={pick.length === 0 || !workspaceId} onClick={() => void importSel()}>
          Dodaj zaznaczone do biblioteki
        </Button>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Twoje materiały w kampaniach</h2>
        <ul className="mt-3 space-y-2">
          {assets.length === 0 ? (
            <li className="text-xs text-muted-foreground">Jeszcze brak — wybierz obrazy powyżej albo przy szkicu w „Kreacje i media”.</li>
          ) : (
            assets.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <img src={a.public_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <input
                  className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
                  defaultValue={a.display_name ?? ""}
                  onBlur={(e) => void fnPatch({ data: { id: a.id, displayName: e.target.value } })}
                />
                <Button variant="ghost" size="sm" onClick={() => void fnDel({ data: { id: a.id } }).then(() => { if (workspaceId) void reload(workspaceId); })}>
                  Usuń
                </Button>
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
