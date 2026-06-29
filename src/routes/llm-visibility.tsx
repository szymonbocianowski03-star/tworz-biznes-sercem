import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Save, FileText, Sparkles, Download, Copy, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCreditsUpgrade } from "@/contexts/CreditsUpgradeContext";
import { useAuthSession } from "@/hooks/useAuthSession";
import { AppBackLink } from "@/components/AppBackLink";
import { AiVisibilityNewAnalysisModal } from "@/components/aiVisibility/AiVisibilityNewAnalysisModal";
import { AiVisibilityReportView } from "@/components/aiVisibility/AiVisibilityReportView";
import { AiVisibilityCompactSidebar } from "@/components/aiVisibility/AiVisibilityCompactSidebar";
import { AiVisibilityReportsList } from "@/components/aiVisibility/AiVisibilityReportsList";
import { AiVisibilityCompareView } from "@/components/aiVisibility/AiVisibilityCompareView";
import { runLlmVisibilityAnalysis, type LlmVisibilityFormInput } from "@/lib/llmVisibilityRunAnalysis";
import { scheduleCreditsRefresh } from "@/lib/creditsRefresh";
import { supabaseFnHeaders } from "@/lib/supabaseFnHeaders";
import { mapAnalysisToReport } from "@/lib/aiVisibility/mapToReport";
import {
  clearDraft,
  compareReports,
  createReport,
  deleteReport,
  getPreviousReportForDomain,
  getReportById,
  getReportsByUser,
  isGuestAiVisibilityUser,
  loadDraft,
  migrateGuestReportsToUser,
  migrateLegacySavedReports,
  resolveAiVisibilityUserId,
  resolveAiVisibilityUserIdAsync,
  saveDraft,
} from "@/lib/aiVisibility/reportService";
import { toastSupabaseLoadError } from "@/lib/supabaseSchemaHint";
import { copyReportSummary, exportReportPdf } from "@/lib/aiVisibility/exportReport";
import { generateSuggestedQueries, parseListInput } from "@/lib/aiVisibility/generateQueries";
import type { AiVisibilityReport } from "@/lib/aiVisibility/types";
import type { ReportCompareResult } from "@/lib/aiVisibility/types";
import { t } from "@/lib/aiVisibility/translations";
import { appendLlmVisibilityTrend } from "@/lib/llmVisibilityTrend";
import { validateAnalysisInput } from "@/lib/aiVisibility/validateInput";
import { normalizeDomain } from "@/lib/aiVisibility/generateQueries";

export const Route = createFileRoute("/llm-visibility")({
  head: () => ({ meta: [{ title: "Widoczność marki w AI — MarketingNow" }] }),
  component: AiVisibilityPage,
});

type PageView = "workspace" | "reports" | "compare";

const emptyForm = (): LlmVisibilityFormInput => ({
  brandName: "",
  websiteUrl: "",
  industry: "",
  offerDescription: "",
  targetKeywords: "",
  competitors: "",
  targetAudience: "",
  aiModels: "ChatGPT, Gemini, Claude, Perplexity",
  language: "pl",
});

function AiVisibilityPage() {
  const tr = t();
  const { openCreditsUpgrade } = useCreditsUpgrade();
  const { user, loading: authLoading } = useAuthSession();
  const [userId, setUserId] = useState(() => resolveAiVisibilityUserId(user?.id));
  const [userIdReady, setUserIdReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void resolveAiVisibilityUserIdAsync(user?.id).then(async (id) => {
      if (cancelled) return;
      setUserId((prev) => {
        if (prev.startsWith("guest-") && !id.startsWith("guest-")) {
          void migrateGuestReportsToUser(prev, id);
        }
        return id;
      });
      setUserIdReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading]);

  const [pageView, setPageView] = useState<PageView>("workspace");
  const [form, setForm] = useState<LlmVisibilityFormInput>(emptyForm);
  const [currentReport, setCurrentReport] = useState<AiVisibilityReport | null>(null);
  const [savedReports, setSavedReports] = useState<AiVisibilityReport[]>([]);
  const [compareData, setCompareData] = useState<ReportCompareResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reportViewMode, setReportViewMode] = useState<"summary" | "full">("summary");
  const [reportsTick, setReportsTick] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [pendingWarningContinue, setPendingWarningContinue] = useState(false);

  const refreshReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      await migrateLegacySavedReports(userId);
      const list = await getReportsByUser(userId);
      setSavedReports(list);
      setReportsTick((x) => x + 1);
    } finally {
      setReportsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userIdReady) return;
    void refreshReports();
  }, [refreshReports, userIdReady]);

  const openReportsView = useCallback(() => {
    setPageView("reports");
    void refreshReports();
  }, [refreshReports]);

  const previousForCurrent = useMemo(() => {
    if (!currentReport) return null;
    return getPreviousReportForDomain(userId, currentReport.domain, currentReport.id);
  }, [currentReport, userId, reportsTick]);

  const patchForm = (patch: Partial<LlmVisibilityFormInput>) => setForm((f) => ({ ...f, ...patch }));

  const startNewAnalysis = useCallback(() => {
    clearDraft(userId);
    setCurrentReport(null);
    setError(null);
    setCompareData(null);
    setForm(emptyForm());
    setPendingWarningContinue(false);
    setModalOpen(true);
  }, [userId]);

  const runAnalysis = useCallback(
    async (forceContinue = false) => {
      const validation = validateAnalysisInput(form, {
        requireCompetitors: parseListInput(form.competitors).length > 0,
      });

      if (!validation.valid) {
        const firstError = validation.issues.find((i) => i.severity === "error");
        setError(firstError?.message ?? "Dane wejściowe są niepoprawne.");
        toast.error(firstError?.message ?? "Popraw dane wejściowe przed analizą.");
        return;
      }

      if (validation.canContinueWithWarnings && !forceContinue && !pendingWarningContinue) {
        const mismatch = validation.issues.find((i) => i.code === "brand_domain_mismatch");
        if (mismatch) {
          const proceed = window.confirm(`${mismatch.message}\n\nCzy chcesz kontynuować mimo ostrzeżenia?`);
          if (!proceed) return;
          setPendingWarningContinue(true);
        }
      }

      let keywords = form.targetKeywords.trim();
      if (!keywords) {
        const suggested = generateSuggestedQueries({
          brandName: form.brandName,
          industry: form.industry,
          offerDescription: form.offerDescription,
          targetAudience: form.targetAudience,
        });
        if (!suggested) {
          setError(tr.industryRequired);
          toast.error(tr.industryRequired);
          return;
        }
        keywords = suggested.join("\n");
        patchForm({ targetKeywords: keywords });
      } else if (parseListInput(keywords).length < 5) {
        toast.message(tr.recommendedQueries);
      }

      setError(null);
      const headers = await supabaseFnHeaders();
      if (!headers) {
        toast.error("Zaloguj się, aby uruchomić analizę.");
        return;
      }

      setModalOpen(false);
      setIsLoading(true);
      setCurrentReport(null);
      setPageView("workspace");
      clearDraft(userId);

      const authUserId = await resolveAiVisibilityUserIdAsync(user?.id);
      if (authUserId !== userId) setUserId(authUserId);

      const runForm = { ...form, targetKeywords: keywords || form.targetKeywords };

      try {
        const result = await runLlmVisibilityAnalysis(runForm, headers);
        if (!result.ok) {
          if (result.kind === "parse") {
            setError(
              "Model zwrócił odpowiedź, której nie da się wczytać jako JSON. Uruchom analizę ponownie.",
            );
            return;
          }
          if (result.status === 402) {
            openCreditsUpgrade(result.message);
            return;
          }
          setError(result.message ?? "Nie udało się ukończyć analizy.");
          return;
        }

        const report = mapAnalysisToReport({
          userId: authUserId,
          form: runForm,
          analysis: result.data,
          status: "draft",
        });
        setCurrentReport(report);
        if (!report.blocked) {
          saveDraft(authUserId, report);
          appendLlmVisibilityTrend(normalizeDomain(runForm.websiteUrl), report.score);

          if (!isGuestAiVisibilityUser(authUserId)) {
            const { report: saved, cloudOk, error: saveErr } = await createReport(authUserId, {
              ...report,
              status: "saved",
            });
            setCurrentReport(saved);
            await refreshReports();
            if (cloudOk) {
              toast.success(tr.reportSaved, {
                action: {
                  label: tr.openReports,
                  onClick: openReportsView,
                },
              });
            } else if (saveErr) {
              toast.message("Raport zapisany lokalnie. Uruchom migrację bazy, aby sync na koncie.", {
                description: saveErr,
              });
            } else {
              toast.success("Raport zapisany w tej przeglądarce.");
            }
          }
        }
        setReportViewMode(report.blocked ? "full" : "summary");
        scheduleCreditsRefresh();

        if (report.blocked) {
          toast.error("Raport został zablokowany — dane wejściowe lub wynik analizy są niespójne.");
        } else if (report.lowConfidenceAlert) {
          toast.message(report.lowConfidenceAlert);
        }
      } finally {
        setIsLoading(false);
        setPendingWarningContinue(false);
      }
    },
    [form, openCreditsUpgrade, openReportsView, pendingWarningContinue, tr, user?.id, userId, refreshReports],
  );

  const saveCurrentReport = useCallback(async () => {
    if (!currentReport || currentReport.blocked) return;
    const authUserId = await resolveAiVisibilityUserIdAsync(user?.id);
    if (isGuestAiVisibilityUser(authUserId)) {
      toast.error(tr.loginToSave);
      return;
    }
    if (authUserId !== userId) setUserId(authUserId);

    try {
      const { report: saved, cloudOk, error: saveErr } = await createReport(authUserId, {
        ...currentReport,
        status: "saved",
      });
      setCurrentReport(saved);
      await refreshReports();
      if (cloudOk) {
        toast.success(tr.reportSaved, {
          action: {
            label: tr.openReports,
            onClick: openReportsView,
          },
        });
      } else if (saveErr) {
        toastSupabaseLoadError({ message: saveErr }, "llm_visibility_reports");
        toast.message("Zapisano lokalnie — brak tabeli w Supabase.", { description: saveErr });
      } else {
        toast.success("Raport zapisany w tej przeglądarce.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zapisać raportu.");
    }
  }, [currentReport, user?.id, userId, refreshReports, tr, openReportsView]);

  const discardReport = useCallback(() => {
    if (!currentReport) return;
    if (currentReport.status === "saved") {
      toast.message("Ten raport jest zapisany — użyj Usuń na liście raportów.");
      return;
    }
    if (!window.confirm(tr.confirmDiscard)) return;
    clearDraft(userId);
    setCurrentReport(null);
    setError(null);
    toast.message("Raport odrzucony.");
  }, [currentReport, userId, tr]);

  const openReport = useCallback(
    (id: string) => {
      const r = getReportById(userId, id);
      if (!r) return;
      setForm({ ...r.formSnapshot });
      setCurrentReport(r);
      setPageView("workspace");
      setReportViewMode("full");
      setCompareData(null);
    },
    [userId],
  );

  const handleCompare = useCallback(
    (idA: string, idB: string) => {
      try {
        const cmp = compareReports(userId, idA, idB);
        setCompareData(cmp);
        setPageView("compare");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Nie udało się porównać raportów.");
      }
    },
    [userId],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm(tr.confirmDelete)) return;
      await deleteReport(userId, id);
      if (currentReport?.id === id) setCurrentReport(null);
      await refreshReports();
      toast.success("Usunięto raport.");
    },
    [userId, currentReport, refreshReports, tr],
  );

  const lastScanAt = currentReport?.updatedAt ?? currentReport?.createdAt ?? null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px] px-4 md:px-6 py-8">
      <AppBackLink className="mb-4" />

      <header className="mb-8 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Eye className="h-7 w-7 shrink-0" />
              {tr.aiVisibilityTitle}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">{tr.aiVisibilitySubtitle}</p>
            {currentReport && pageView === "workspace" && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{currentReport.domain}</span>
                {lastScanAt && (
                  <>
                    {" "}
                    · {tr.lastScan}: {new Date(lastScanAt).toLocaleString("pl-PL")}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={startNewAnalysis}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-4 py-2.5 text-sm font-semibold hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" /> {tr.newAnalysis}
            </button>
            <button
              type="button"
              onClick={() => {
                setPageView("workspace");
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold ${
                pageView === "workspace" ? "border-foreground bg-muted" : "border-border hover:bg-muted"
              }`}
            >
              <Eye className="h-4 w-4" /> Panel analizy
            </button>
            <button
              type="button"
              onClick={openReportsView}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold ${
                pageView === "reports" ? "border-foreground bg-muted" : "border-border hover:bg-muted"
              }`}
            >
              <FileText className="h-4 w-4" /> {tr.savedReports}
              {savedReports.length > 0 && (
                <span className="rounded-full bg-foreground text-background text-[10px] px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {savedReports.filter((r) => r.status === "saved").length}
                </span>
              )}
            </button>
          </div>
        </div>

        {currentReport && pageView === "workspace" && !currentReport.blocked && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card/80 p-2 shadow-sm">
            <button
              type="button"
              onClick={saveCurrentReport}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-3 py-2 text-xs font-semibold"
            >
              <Save className="h-3.5 w-3.5" /> {tr.saveReport}
            </button>
            <button
              type="button"
              onClick={() => exportReportPdf(currentReport)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" /> {tr.exportPdf}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(copyReportSummary(currentReport));
                toast.success("Skopiowano podsumowanie.");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
            >
              <Copy className="h-3.5 w-3.5" /> {tr.copySummary}
            </button>
            <button
              type="button"
              onClick={() => void runAnalysis(true)}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> {tr.rerunAnalysis}
            </button>
            {currentReport.status !== "saved" && (
              <button
                type="button"
                onClick={discardReport}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 text-destructive px-3 py-2 text-xs font-medium hover:bg-destructive/10 ml-auto"
              >
                <Trash2 className="h-3.5 w-3.5" /> {tr.discardReport}
              </button>
            )}
          </div>
        )}
      </header>

      {pageView === "reports" && (
        <>
          {reportsLoading ? (
            <div className="rounded-2xl border border-dashed p-12 flex flex-col items-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3" />
              <p className="text-sm">Ładowanie raportów…</p>
            </div>
          ) : (
            <AiVisibilityReportsList
              userId={userId}
              reports={savedReports}
              onOpen={openReport}
              onCompare={handleCompare}
              onDelete={handleDelete}
              onNewAnalysis={startNewAnalysis}
            />
          )}
        </>
      )}

      {pageView === "compare" && compareData && (
        <AiVisibilityCompareView data={compareData} onClose={() => setPageView("reports")} />
      )}

      {pageView === "workspace" && (
        <div className="grid gap-8 xl:grid-cols-12 min-w-0">
          <aside className="xl:col-span-4 min-w-0">
            <AiVisibilityCompactSidebar report={currentReport} lastScanAt={lastScanAt} isLoading={isLoading} />
          </aside>
          <main className="xl:col-span-8 min-w-0 space-y-6">
            {error && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {isLoading && (
              <div className="rounded-2xl border border-dashed p-12 flex flex-col items-center text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin mb-4" />
                <p className="font-medium text-foreground">{tr.analyzing}</p>
              </div>
            )}
            {!isLoading && currentReport && (
              <AiVisibilityReportView
                report={currentReport}
                viewMode={reportViewMode}
                onViewModeChange={setReportViewMode}
                previousReport={previousForCurrent}
              />
            )}
            {!isLoading && !currentReport && !error && (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">{tr.emptyWorkspace}</p>
                <button
                  type="button"
                  onClick={startNewAnalysis}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground text-background px-6 py-2.5 text-sm font-semibold"
                >
                  <Sparkles className="h-4 w-4" /> {tr.createFirstAnalysis}
                </button>
              </div>
            )}
          </main>
        </div>
      )}

      <AiVisibilityNewAnalysisModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        form={form}
        onFormChange={patchForm}
        onRun={() => void runAnalysis()}
        loading={isLoading}
      />
    </div>
  );
}
