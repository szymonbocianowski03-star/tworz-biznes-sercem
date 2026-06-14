import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { CampaignComposerNav } from "@/components/campaign-composer/CampaignComposerNav";
import {
  ccEnsureWorkspace,
  ccListDrafts,
  ccBulkAction,
  ccCreateDraft,
  ccDuplicateDraft,
} from "@/modules/campaign-composer/campaign-composer.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isAdPlatformComingSoon } from "@/lib/adPlatform";
import { labelLifecycle, labelProvider } from "@/lib/campaignComposerLabels";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/campaign-composer/")({
  component: CampaignComposerHome,
});

type DraftRow = { id: string; title: string; provider: string; lifecycle: string; updated_at: string };

function CampaignComposerHome() {
  const navigate = useNavigate();
  const fnEnsure = useServerFn(ccEnsureWorkspace);
  const fnList = useServerFn(ccListDrafts);
  const fnBulk = useServerFn(ccBulkAction);
  const fnCreate = useServerFn(ccCreateDraft);
  const fnDup = useServerFn(ccDuplicateDraft);

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [metaConn, setMetaConn] = useState<{ id: string; selected_ad_account_id: string | null; selected_page_id: string | null } | null>(null);
  const [liConn, setLiConn] = useState<{ id: string; selected_ad_account_id: string | null } | null>(null);
  const [ttConn, setTtConn] = useState<{ id: string; selected_advertiser_id: string | null } | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    const { drafts: d } = await fnList({ data: { workspaceId } });
    setDrafts((d ?? []) as DraftRow[]);
  }, [fnList, workspaceId]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        navigate({ to: "/auth" });
        return;
      }
      const wsRes = await fnEnsure({ data: {} });
      const ws = wsRes.workspaceId;
      const [{ data: m }, { data: l }, { data: t }] = await Promise.all([
        supabase.from("meta_connections").select("id,selected_ad_account_id,selected_page_id").eq("user_id", u.user.id).maybeSingle(),
        supabase.from("linkedin_connections").select("id,selected_ad_account_id").eq("user_id", u.user.id).maybeSingle(),
        supabase.from("tiktok_connections").select("id,selected_advertiser_id").eq("user_id", u.user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setWorkspaceId(ws);
      setMetaConn(m);
      setLiConn(l);
      setTtConn(t);
      const { drafts: d } = await fnList({ data: { workspaceId: ws } });
      setDrafts((d ?? []) as DraftRow[]);
      setLoading(false);
    })();
  }, [fnEnsure, fnList, navigate]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allDraftIds = drafts.map((d) => d.id);
  const allSelected = drafts.length > 0 && allDraftIds.every((id) => selected.includes(id));
  const someSelected = selected.length > 0 && !allSelected;

  const toggleAll = () => {
    setSelected(allSelected ? [] : allDraftIds);
  };

  const runBulk = async (action: "pause" | "resume" | "archive" | "delete" | "retry_launch" | "duplicate") => {
    if (!workspaceId || selected.length === 0) return;
    const { results } = await fnBulk({ data: { workspaceId, draftIds: selected, action } });
    toast.message(`Operacja zbiorcza: ${action}`, { description: `${results?.length ?? 0} wierszy` });
    setBulkOpen(false);
    setSelected([]);
    await refresh();
  };

  const quickCreate = async (provider: "meta" | "linkedin" | "tiktok") => {
    if (isAdPlatformComingSoon(provider)) {
      toast.message(`${labelProvider(provider)} — wkrótce`);
      return;
    }
    if (!workspaceId) return;
    const acc =
      (provider === "meta"
        ? metaConn?.selected_ad_account_id
        : provider === "tiktok"
          ? ttConn?.selected_advertiser_id
          : liConn?.selected_ad_account_id) ?? "";
    const title =
      provider === "meta"
        ? "Nowa kampania Meta"
        : provider === "tiktok"
          ? "Nowa kampania TikTok"
          : "Nowa kampania LinkedIn";
    try {
      const { id } = await fnCreate({
        data: {
          workspaceId,
          provider,
          title,
          adAccountId: acc,
          metaConnectionId: provider === "meta" ? metaConn?.id : undefined,
          metaPageId: provider === "meta" ? (metaConn?.selected_page_id ?? undefined) : undefined,
          linkedinConnectionId: provider === "linkedin" ? liConn?.id : undefined,
          tiktokConnectionId: provider === "tiktok" ? ttConn?.id : undefined,
        },
      });
      if (acc) {
        toast.success("Utworzono szkic");
      } else {
        toast.message("Utworzono szkic", {
          description: "Uzupełnij konto reklamowe w zakładce „Kanał i konto” (lub połącz integrację).",
        });
      }
      navigate({ to: "/campaign-composer/draft/$draftId", params: { draftId: id } });
    } catch (e) {
      toast.error("Nie udało się utworzyć szkicu", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const dupFrom = async (sourceId: string) => {
    if (!workspaceId) return;
    try {
      const { id } = await fnDup({ data: { sourceId, workspaceId } });
      navigate({ to: "/campaign-composer/draft/$draftId", params: { draftId: id } });
    } catch (e) {
      toast.error("Nie udało się zduplikować szkicu", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <CampaignComposerNav />
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Panel kampanii</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground">Lista szkiców</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Twórz szkice, klonuj struktury i uruchamiaj kampanie Meta oraz LinkedIn z jednego miejsca — bez szablonu UI jak w menedżerach reklam.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => quickCreate("meta")}>
              Nowy szkic Meta
            </Button>
            <Button type="button" onClick={() => quickCreate("linkedin")} disabled={isAdPlatformComingSoon("linkedin")}>
              {isAdPlatformComingSoon("linkedin") ? "LinkedIn — wkrótce" : "Nowy szkic LinkedIn"}
            </Button>
            <Button type="button" variant="outline" onClick={() => quickCreate("tiktok")} disabled={isAdPlatformComingSoon("tiktok")}>
              {isAdPlatformComingSoon("tiktok") ? "TikTok — wkrótce" : "Nowy szkic TikTok"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setBulkOpen(true)} disabled={selected.length === 0}>
              Zbiór operacji ({selected.length})
            </Button>
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie przestrzeni roboczej…</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-3">
                    {drafts.length > 0 && (
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                        aria-label="Zaznacz wszystkie"
                      />
                    )}
                  </th>
                  <th className="px-4 py-3">Nazwa</th>
                  <th className="px-4 py-3">Kanał</th>
                  <th className="px-4 py-3">Stan</th>
                  <th className="px-4 py-3">Aktualizacja</th>
                  <th className="px-4 py-3 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {drafts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Brak szkiców. Użyj przycisków powyżej lub{" "}
                      <Link to="/integrations" className="font-medium text-foreground underline underline-offset-2">
                        połącz integracje
                      </Link>
                      .
                    </td>
                  </tr>
                ) : (
                  drafts.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Checkbox checked={selected.includes(d.id)} onCheckedChange={() => toggle(d.id)} />
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{d.title}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{labelProvider(d.provider)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{labelLifecycle(d.lifecycle)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(d.updated_at).toLocaleString("pl-PL")}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => dupFrom(d.id)}>
                            Duplikuj
                          </Button>
                          <Button variant="default" size="sm" className="h-8 text-xs" asChild>
                            <Link to="/campaign-composer/draft/$draftId" params={{ draftId: d.id }}>
                              Otwórz
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h2 className="font-display text-lg font-bold">Zbiór operacji</h2>
            <p className="mt-1 text-xs text-muted-foreground">Wybierz operację dla zaznaczonych szkiców.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => runBulk("pause")}>
                Pauza
              </Button>
              <Button size="sm" variant="outline" onClick={() => runBulk("resume")}>
                Wznów
              </Button>
              <Button size="sm" variant="outline" onClick={() => runBulk("archive")}>
                Archiwizuj
              </Button>
              <Button size="sm" variant="destructive" onClick={() => runBulk("delete")}>
                Usuń szkice
              </Button>
              <Button size="sm" onClick={() => runBulk("duplicate")}>
                Duplikuj zbiorczo
              </Button>
              <Button size="sm" variant="secondary" onClick={() => runBulk("retry_launch")}>
                Ponów launch
              </Button>
            </div>
            <Button className="mt-6 w-full" variant="ghost" onClick={() => setBulkOpen(false)}>
              Zamknij
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
