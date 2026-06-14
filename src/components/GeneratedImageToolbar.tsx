import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FolderOpen, Pencil, RefreshCw, Rocket } from "lucide-react";
import { toast } from "sonner";
import { saveImageToProjectAssets } from "@/lib/saveProjectAsset";
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
  onPromptUpdated?: (next: string) => void;
  onRegenerate?: (nextPrompt: string) => void;
  onSaved?: (next: { dbId: string; url: string }) => void;
};

export function GeneratedImageToolbar({
  imageUrl,
  dbId,
  prompt,
  productName,
  onPromptUpdated,
  onRegenerate,
  onSaved,
}: Props) {
  const [open, setOpen] = useState<"edit" | null>(null);
  const [editPrompt, setEditPrompt] = useState(prompt);
  const [saving, setSaving] = useState(false);
  const [localDbId, setLocalDbId] = useState<string | null>(dbId);

  const effectiveDbId = localDbId ?? dbId;

  async function savePromptEdit() {
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
    toast.success("Zaktualizowano opis");
    setOpen(null);
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
          title="Edytuj opis kreacji (prompt)"
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
        >
          <Pencil className="h-3 w-3" strokeWidth={2} />
          Edytuj
        </button>
        {onRegenerate && (
          <button
            type="button"
            onClick={() => onRegenerate(prompt)}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
            title="Wygeneruj nowe warianty na podstawie tego opisu"
          >
            <RefreshCw className="h-3 w-3" strokeWidth={2} />
            Wygeneruj ponownie
          </button>
        )}
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

      <Dialog open={open === "edit"} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edytuj opis kreacji</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Opis użyty do generacji — popraw go, żeby łatwiej odnaleźć wersję w zasobach.
          </p>
          <Textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            rows={6}
            className="text-[13px] font-mono"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(null)}>
              Anuluj
            </Button>
            <Button type="button" onClick={() => void savePromptEdit()} disabled={saving}>
              {saving ? "Zapis…" : "Zapisz opis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
