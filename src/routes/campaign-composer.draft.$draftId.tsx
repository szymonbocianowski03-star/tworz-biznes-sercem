import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CampaignComposerNav } from "@/components/campaign-composer/CampaignComposerNav";
import {
  ccGetDraft,
  ccSaveDraft,
  ccRunPreflight,
  ccEnqueueLaunch,
  ccCancelLaunchJob,
  ccListJobs,
  ccListJobItems,
} from "@/modules/campaign-composer/campaign-composer.functions";
import { labelProvider } from "@/lib/campaignComposerLabels";
import { campaignComposerDraftPayloadSchema, type CampaignComposerDraftPayload } from "@/modules/campaign-composer/domain/draft-schema";
import { blockingCount, runPreflightValidation } from "@/modules/campaign-composer/validation/preflight";
import { buildLocalPreview } from "@/modules/campaign-composer/preview/engines";
import { mergeIntegrationDefaults, preflightContext } from "@/modules/campaign-composer/integration-defaults";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MetaCampaignBuilder } from "@/components/campaign-composer/builders/MetaCampaignBuilder";
import { TikTokCampaignBuilder } from "@/components/campaign-composer/builders/TikTokCampaignBuilder";
import { LinkedInCampaignBuilder } from "@/components/campaign-composer/builders/LinkedInCampaignBuilder";
import type { AccountInfo, BuilderProps } from "@/components/campaign-composer/builders/shared";

export const Route = createFileRoute("/campaign-composer/draft/$draftId")({
  component: DraftEditor,
});

const EMPTY_ACCOUNT: AccountInfo = { connected: false, adAccounts: [], pixels: [] };

function mapList(raw: unknown, idKeys: string[], nameKeys: string[]): { id: string; name: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      const id = idKeys.map((k) => o[k]).find((v) => v != null);
      const name = nameKeys.map((k) => o[k]).find((v) => v != null);
      return { id: String(id ?? ""), name: String(name ?? id ?? "") };
    })
    .filter((x) => x.id);
}

function DraftEditor() {
  const { draftId } = Route.useParams();

  const fnGet = useServerFn(ccGetDraft);
  const fnSave = useServerFn(ccSaveDraft);
  const fnPreflight = useServerFn(ccRunPreflight);
  const fnEnqueue = useServerFn(ccEnqueueLaunch);
  const fnCancel = useServerFn(ccCancelLaunchJob);
  const fnJobs = useServerFn(ccListJobs);
  const fnItems = useServerFn(ccListJobItems);

  const [title, setTitle] = useState("");
  const [payload, setPayload] = useState<CampaignComposerDraftPayload | null>(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [preview, setPreview] = useState<{ headline: string; body: string; destination: string } | null>(null);
  const [jobs, setJobs] = useState<{ id: string; status: string; intent: string }[]>([]);
  const [jobItems, setJobItems] = useState<{ step_kind: string; status: string; provider_message: string | null }[]>([]);
  const [activeJob, setActiveJob] = useState<string | null>(null);
  const [pages, setPages] = useState<{ id: string; name: string }[]>([]);
  const [account, setAccount] = useState<AccountInfo>(EMPTY_ACCOUNT);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payloadRef = useRef<CampaignComposerDraftPayload | null>(null);
  const titleRef = useRef("");
  payloadRef.current = payload;
  titleRef.current = title;

  const loadAccount = useCallback(async (p: CampaignComposerDraftPayload) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    if (p.channel.provider === "meta") {
      const q = supabase
        .from("meta_connections")
        .select("meta_user_name,ad_accounts,pixel_id,pages,selected_page_id,selected_ad_account_id")
        .eq("user_id", u.user.id);
      const { data } = await (p.channel.metaConnectionId ? q.eq("id", p.channel.metaConnectionId) : q).maybeSingle();
      const pageList = mapList(data?.pages, ["id"], ["name"]);
      setPages(pageList);
      setAccount({
        connected: !!data,
        name: data?.meta_user_name ?? undefined,
        adAccounts: mapList(data?.ad_accounts, ["id", "account_id"], ["name", "account_name"]),
        pixels: data?.pixel_id ? [{ id: String(data.pixel_id), name: String(data.pixel_id) }] : [],
      });
      return mergeIntegrationDefaults(p, {
        metaPageId: data?.selected_page_id ?? pageList[0]?.id,
        adAccountId: data?.selected_ad_account_id ?? mapList(data?.ad_accounts, ["id", "account_id"], ["name", "account_name"])[0]?.id,
        metaPixelId: data?.pixel_id ? String(data.pixel_id) : undefined,
      });
    } else if (p.channel.provider === "tiktok") {
      const { data } = await supabase.from("tiktok_connections").select("advertiser_name,advertiser_accounts,tiktok_advertiser_id").eq("user_id", u.user.id).maybeSingle();
      const accts = mapList(data?.advertiser_accounts, ["advertiser_id", "id"], ["advertiser_name", "name"]);
      setAccount({
        connected: !!data,
        name: data?.advertiser_name ?? undefined,
        adAccounts: accts.length ? accts : data?.tiktok_advertiser_id ? [{ id: String(data.tiktok_advertiser_id), name: String(data.advertiser_name ?? data.tiktok_advertiser_id) }] : [],
        pixels: [],
      });
      return mergeIntegrationDefaults(p, {
        adAccountId: data?.tiktok_advertiser_id ?? accts[0]?.id,
      });
    } else if (p.channel.provider === "linkedin") {
      const { data } = await supabase.from("linkedin_connections").select("linkedin_user_name,ad_accounts,organizations").eq("user_id", u.user.id).maybeSingle();
      setAccount({
        connected: !!data,
        name: data?.linkedin_user_name ?? undefined,
        adAccounts: mapList(data?.ad_accounts, ["id", "account_id"], ["name", "account_name"]),
        pixels: [],
      });
      const orgs = mapList(data?.organizations, ["urn"], ["name"]);
      return mergeIntegrationDefaults(p, {
        adAccountId: data?.selected_ad_account_id ?? mapList(data?.ad_accounts, ["id", "account_id"], ["name", "account_name"])[0]?.id,
        linkedinOrganizationUrn: orgs[0]?.id,
      });
    }
    return p;
  }, []);

  const load = useCallback(async () => {
    const { draft } = await fnGet({ data: { id: draftId } });
    if (!draft) return;
    setTitle(draft.title);
    setWorkspaceId(draft.workspace_id);
    let p = campaignComposerDraftPayloadSchema.parse(draft.draft_payload);
    const sync = (draft.sync_state ?? {}) as Record<string, string | undefined>;
    if (!p.channel.metaConnectionId && sync.meta_connection_id) p.channel.metaConnectionId = sync.meta_connection_id;
    if (!p.channel.linkedinConnectionId && sync.linkedin_connection_id) p.channel.linkedinConnectionId = sync.linkedin_connection_id;
    const merged = await loadAccount(p);
    if (merged && merged !== p) {
      p = merged;
      await fnSave({
        data: {
          id: draftId,
          workspaceId: draft.workspace_id,
          title: draft.title,
          provider: p.channel.provider,
          draftPayload: p,
          syncPatch: {
            meta_connection_id: p.channel.metaConnectionId,
            linkedin_connection_id: p.channel.linkedinConnectionId,
          },
        },
      });
    }
    setPayload(p);
    const pre = await fnPreflight({ data: { draftId } });
    if (pre.preview) setPreview({ headline: pre.preview.headline, body: pre.preview.body, destination: pre.preview.destination });
  }, [draftId, fnGet, fnPreflight, fnSave, loadAccount]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveNow = useCallback(
    async (next: CampaignComposerDraftPayload, nextTitle: string, quiet = false) => {
      try {
        await fnSave({
          data: {
            id: draftId,
            workspaceId,
            title: nextTitle,
            provider: next.channel.provider,
            draftPayload: next,
            syncPatch: {
              meta_connection_id: next.channel.metaConnectionId,
              linkedin_connection_id: next.channel.linkedinConnectionId,
            },
          },
        });
        if (!quiet) toast.success("Zapisano szkic");
      } catch (e) {
        toast.error("Nie udało się zapisać szkicu", {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [draftId, workspaceId, fnSave],
  );

  useEffect(() => {
    const flush = () => {
      const p = payloadRef.current;
      if (!p) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      void saveNow(p, titleRef.current, true);
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, [saveNow]);

  // Aktualizacja + cichy autozapis (debounce) — wyjątek: zmiana mediów zapisuje się od razu.
  const onChange = useCallback(
    (next: CampaignComposerDraftPayload) => {
      const prevAssets = payloadRef.current?.structure.adSets[0]?.creatives[0]?.assetIds ?? [];
      const nextAssets = next.structure.adSets[0]?.creatives[0]?.assetIds ?? [];
      const assetsChanged =
        prevAssets.length !== nextAssets.length || prevAssets.some((id, i) => id !== nextAssets[i]);

      setPayload(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (assetsChanged) {
        void saveNow(next, title, true);
        return;
      }
      saveTimer.current = setTimeout(() => void saveNow(next, title, true), 400);
    },
    [saveNow, title],
  );

  const issues = useMemo(() => {
    if (!payload) return [];
    return runPreflightValidation(payload, preflightContext(payload));
  }, [payload]);

  const livePreview = useMemo(() => {
    if (!payload) return null;
    const snap = buildLocalPreview(payload, issues);
    return { headline: snap.headline, body: snap.body, destination: snap.destination };
  }, [payload, issues]);

  const runAudit = useCallback(async () => {
    if (payload) await saveNow(payload, title, true);
    toast.success("Lista problemów jest aktualna");
  }, [payload, title, saveNow]);

  const refreshJobs = useCallback(async () => {
    const j = await fnJobs({ data: { draftId } });
    setJobs((j.jobs ?? []) as { id: string; status: string; intent: string }[]);
  }, [draftId, fnJobs]);

  const loadItems = useCallback(
    async (jobId: string) => {
      setActiveJob(jobId);
      const r = await fnItems({ data: { jobId } });
      setJobItems((r.items ?? []) as { step_kind: string; status: string; provider_message: string | null }[]);
    },
    [fnItems],
  );

  const enqueue = useCallback(
    async (intent: "draft_only" | "go_live") => {
      const key = `${draftId}-${intent}-${Date.now()}`;
      const r = await fnEnqueue({ data: { draftId, intent, idempotencyKey: key } });
      if (!r.ok) {
        toast.error("Publikacja zablokowana", { description: (r.issues ?? []).map((i) => i.message).join("; ") });
        return;
      }
      await refreshJobs();
      setActiveJob(r.jobId);
      await loadItems(r.jobId);

      const status = r.launch?.finalStatus ?? "queued";
      const msg = r.launch?.message;

      if (r.dryRun) {
        toast.error("Publikacja zablokowana (tryb testowy)", {
          description:
            "Serwer ma CAMPAIGN_COMPOSER_DRY_RUN=true. Ustaw false w zmiennych środowiskowych Lovable, aby wysłać kampanię na Facebook.",
        });
        return;
      }

      if (status === "success" || status === "partial_success") {
        toast.success("Kampania utworzona na koncie reklamowym", {
          description: "Sprawdź panel reklam Meta — reklamy mogą wymagać akceptacji przez platformę.",
        });
        return;
      }
      if (status === "failed") {
        toast.error("Publikacja nie powiodła się", { description: msg ?? "Sprawdź szczegóły poniżej." });
        return;
      }
      if (status === "queued") {
        toast.message("Publikacja w kolejce — ponowimy automatycznie.", { description: msg });
        return;
      }
      toast.message(`Status publikacji: ${status}`, { description: msg });
    },
    [draftId, fnEnqueue, refreshJobs, loadItems],
  );

  const cancelJob = useCallback(
    async (jobId: string) => {
      await fnCancel({ data: { jobId } });
      toast.success("Anulowano publikację w toku");
      await refreshJobs();
    },
    [fnCancel, refreshJobs],
  );

  if (!payload) {
    return (
      <div className="min-h-[40vh] p-8">
        <CampaignComposerNav />
        <p className="text-sm text-muted-foreground">Ładowanie szkicu…</p>
      </div>
    );
  }

  const builderProps: BuilderProps = {
    value: payload,
    workspaceId,
    onChange,
    pages,
    account,
    issues,
    preview: livePreview ?? preview,
    jobs,
    jobItems,
    activeJob,
    blocking: blockingCount(issues),
    onRunAudit: () => void runAudit(),
    onEnqueue: (i) => void enqueue(i),
    onRefreshJobs: () => void refreshJobs(),
    onLoadItems: (id) => void loadItems(id),
    onCancelJob: (id) => void cancelJob(id),
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <CampaignComposerNav />
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800 md:flex-row md:items-start md:justify-between">
          <div>
            <Link to="/campaign-composer" className="text-xs text-foreground underline underline-offset-2 hover:opacity-80">
              ← Lista szkiców
            </Link>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Kreator {labelProvider(payload.channel.provider)}
            </p>
            <input
              className="mt-1 block w-full max-w-xl border-0 bg-transparent font-display text-2xl font-bold tracking-tight text-zinc-900 focus:outline-none dark:text-zinc-50"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void saveNow(payload, title)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void saveNow(payload, title).then(() => toast.success("Zapisano szkic"))}>
              Zapisz
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void runAudit()}>
              Uruchom przegląd
            </Button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {payload.channel.provider === "meta" && <MetaCampaignBuilder {...builderProps} />}
          {payload.channel.provider === "tiktok" && <TikTokCampaignBuilder {...builderProps} />}
          {payload.channel.provider === "linkedin" && <LinkedInCampaignBuilder {...builderProps} />}
        </div>

        <div className="mt-4">
          <Button asChild variant="outline" size="sm" className="border-zinc-300 dark:border-zinc-700">
            <Link to="/campaign-composer/campaign/$draftId" params={{ draftId }}>
              Zarządzaj opublikowaną kampanią
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
