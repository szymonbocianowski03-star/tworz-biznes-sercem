import { Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LlmVisibilityFormInput } from "@/lib/llmVisibilityRunAnalysis";
import { generateSuggestedQueries } from "@/lib/aiVisibility/generateQueries";
import { t } from "@/lib/aiVisibility/translations";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: LlmVisibilityFormInput;
  onFormChange: (patch: Partial<LlmVisibilityFormInput>) => void;
  onRun: () => void;
  loading: boolean;
};

export function AiVisibilityNewAnalysisModal({ open, onOpenChange, form, onFormChange, onRun, loading }: Props) {
  const tr = t();

  const suggestQueries = () => {
    const lines = generateSuggestedQueries({
      brandName: form.brandName,
      industry: form.industry,
      offerDescription: form.offerDescription,
      targetAudience: form.targetAudience,
    });
    if (!lines) {
      window.alert(tr.industryRequired);
      return;
    }
    onFormChange({ targetKeywords: lines.join("\n") });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{tr.newAnalysis}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{tr.brandName} *</span>
            <input
              value={form.brandName}
              onChange={(e) => onFormChange({ brandName: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{tr.domain} (URL) *</span>
            <input
              value={form.websiteUrl}
              onChange={(e) => onFormChange({ websiteUrl: e.target.value })}
              placeholder="https://..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{tr.industry} *</span>
            <input
              value={form.industry}
              onChange={(e) => onFormChange({ industry: e.target.value })}
              placeholder="np. systemy reklamowe dla MŚP, agencja marketingowa"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Podaj precyzyjną kategorię rynku — bez placeholderów typu „tej kategorii” lub „np. SaaS B2B”.
            </p>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{tr.offerDescription}</span>
            <textarea
              value={form.offerDescription ?? ""}
              onChange={(e) => onFormChange({ offerDescription: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[64px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{tr.targetAudience}</span>
            <textarea
              value={form.targetAudience}
              onChange={(e) => onFormChange({ targetAudience: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[64px]"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{tr.competitors}</span>
            <textarea
              value={form.competitors}
              onChange={(e) => onFormChange({ competitors: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[64px]"
            />
          </label>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{tr.targetQueries}</span>
              <button
                type="button"
                onClick={suggestQueries}
                className="text-xs font-semibold text-foreground hover:underline"
              >
                {tr.generateQueries}
              </button>
            </div>
            <textarea
              value={form.targetKeywords}
              onChange={(e) => onFormChange({ targetKeywords: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[100px] font-mono"
              placeholder="Jedno zapytanie na linię"
            />
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{tr.aiModels}</span>
            <input
              value={form.aiModels ?? "ChatGPT, Gemini, Claude, Perplexity"}
              onChange={(e) => onFormChange({ aiModels: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{tr.language}</span>
            <select
              value={form.language ?? "pl"}
              onChange={(e) => onFormChange({ language: e.target.value as "pl" | "en" | "de" })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="pl">Polski</option>
              <option value="en">English</option>
              <option value="de">Deutsch</option>
            </select>
          </label>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            Zamknij
          </button>
          <button
            type="button"
            onClick={onRun}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {tr.analyzing}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> {tr.runAnalysis}
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
