import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FolderOpen, Download, Pencil, RefreshCw, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useCreditsUpgrade } from "@/contexts/CreditsUpgradeContext";
import { useCredits } from "@/hooks/useCredits";
import { saveImageToProjectAssets } from "@/lib/saveProjectAsset";
import { replaceGeneratedImage } from "@/lib/adImageGeneration";
import { downloadMediaWithToast } from "@/lib/downloadMedia";
import { checkImageGenerationAffordability } from "@/lib/imageCreditsGate";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  imageUrl: string;
  dbId: string | null;
  prompt: string;
  productName?: string | null;
  brandVisualRules?: string | null;
  storagePath?: string | null;
  onPromptUpdated?: (next: string) => void;
  /** Gdy brak dbId — fallback (np. czat bez zapisu w zasobach). */
  onRegenerate?: (nextPrompt: string) => void;
  onSaved?: (next: { dbId: string; url: string }) => void;
  onImageReplaced?: (next: { dbId: string; url: string; prompt: string }) => void;
};

export function GeneratedImageToolbar({
  imageUrl,
  dbId,
  prompt,
  productName,
  brandVisualRules,
  storagePath,
  onPromptUpdated,
  onRegenerate,
  onSaved,
  onImageReplaced,
}: Props) {
  const { openCreditsUpgrade } = useCreditsUpgrade();
  const credits = useCredits();
  const [open, setOpen] = useState<"edit" | null>(null);
  const [editPrompt, setEditPrompt] = useState(prompt);
  const [saving, setSaving] = useState(false);
  const [localDbId, setLocalDbId] = useState<string | null>(dbId);

  useEffect(() => {
    setEditPrompt(prompt);
  }, [prompt]);

  useEffect(() => {
    setLocalDbId(dbId);
  }, [dbId]);

  const effectiveDbId = localDbId ?? dbId;

  async function savePromptOnly() {
    if (!effectiveDbId) {
      toast.error("Najpierw zapisz grafikę w zasobach, potem edytuj opis.");
      return;
    }
    const next = editPrompt.trim();
    if (!next) {
      toast.error("Opis nie może być pusty.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("generated_images").update({ prompt: next }).eq("id", effectiveDbId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onPromptUpdated?.(next);
    toast.success("Zaktualizowano opis (bez zmiany grafiki)");
    setOpen(null);
  }

  async function regenerateWithPrompt(sourcePrompt?: string) {
    const next = (sourcePrompt ?? editPrompt).trim();
    if (!next) {
      toast.error("Opis nie może być pusty.");
      return;
    }

    const affordability = checkImageGenerationAffordability(
      {
        balance: credits.balance ?? 0,
        current_plan: credits.current_plan ?? "free",
        free_ai_usage_usd_cents: credits.free_ai_usage_usd_cents ?? 0,
      },
      1,
    );
    if (!affordability.allowed) {
      openCreditsUpgrade(affordability.reason);
      toast.error(affordability.reason ?? "Brak kredytów.");
      return;
    }

    if (effectiveDbId) {
      setSaving(true);
      const result = await replaceGeneratedImage({
        dbId: effectiveDbId,
        prompt: next,
        productName,
        oldStoragePath: storagePath ?? null,
        brandVisualRules,
      });
      setSaving(false);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      onPromptUpdated?.(result.prompt);
      onImageReplaced?.({ dbId: effectiveDbId, url: result.url, prompt: result.prompt });
      toast.success("Wygenerowano nową wersję grafiki");
      setOpen(null);
      return;
    }

    if (onRegenerate) {
      setOpen(null);
      onRegenerate(next);
      return;
    }

    toast.error("Zapisz grafikę w zasobach, aby móc ją edytować i wygenerować ponownie.");
  }

  async function saveToLibrary() {
    if (effectiveDbId) {
      toast.success("Już w bibliotece zasobów");
      return;
    }
    setSaving(true);
    const r = await saveImageToProjectAssets({
      imageUrl,
      prompt: prompt || "Kreacja reklamowa",
      productName,
    });
    setSaving(false);
    if (!r.id) {
      toast.error(r.error ?? "Nie udało się zapisać. Zaloguj się i spróbuj ponownie.");
      return;
    }
    setLocalDbId(r.id);
    onSaved?.({ dbId: r.id, url: r.url });
    toast.success("Zapisano w zasobach");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <button
          type="button"
          onClick={() => {
            setEditPrompt(prompt);
            setOpen("edit");
          }}
          title="Zmień opis i wygeneruj nową wersję grafiki"
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
          Edytuj
        </button>
        <button
          type="button"
          onClick={() => void regenerateWithPrompt(prompt)}
          disabled={saving}
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
          title="Wygeneruj ponownie na podstawie opisu"
        >
          <RefreshCw className="h-3 w-3" strokeWidth={2} />
          Wygeneruj ponownie
        </button>
        <button
          type="button"
          onClick={() =>
            void downloadMediaWithToast(imageUrl, {
              filenameBase: effectiveDbId ? `kreacja-${effectiveDbId.slice(0, 8)}` : "kreacja",
              kind: "image",
            })
          }
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
          title="Pobierz grafikę na dysk"
        >
          <Download className="h-3 w-3" strokeWidth={2} />
          Pobierz
        </button>
        <button
          type="button"
          onClick={() => void saveToLibrary()}
          disabled={saving}
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
          title="Zapisz w bibliotece projektu (Zasoby → Obrazy)"
        >
          <FolderOpen className="h-3 w-3" strokeWidth={2} />
          Zapisz do zasobów
        </button>
        <Link
          to="/campaign-composer"
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
          title="Otwórz kreator kampanii"
        >
          <Rocket className="h-3 w-3" strokeWidth={2} />
          Użyj w kampanii
        </Link>
      </div>

      <Dialog
        open={open === "edit"}
        onOpenChange={(v) => {
          if (!v) {
            setOpen(null);
            setEditPrompt(prompt);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edytuj kreację</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Zmień opis sceny poniżej, a potem kliknij <strong>Wygeneruj nową wersję</strong> — powstanie
            nowa grafika (zużywa kredyty). Opcja „Tylko zapisz opis” zmienia sam tekst w bibliotece, bez
            podmiany obrazu.
          </p>
          <Textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            rows={6}
            className="text-[13px] font-mono"
          />
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setOpen(null)}>
              Anuluj
            </Button>
            <Button type="button" variant="secondary" onClick={() => void savePromptOnly()} disabled={saving || !effectiveDbId}>
              {saving ? "Zapis…" : "Tylko zapisz opis"}
            </Button>
            <Button type="button" onClick={() => void regenerateWithPrompt()} disabled={saving}>
              {saving ? "Generuję…" : "Wygeneruj nową wersję"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
