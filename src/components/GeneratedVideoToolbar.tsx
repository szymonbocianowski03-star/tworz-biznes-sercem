import { Download, FolderOpen, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { downloadMediaWithToast } from "@/lib/downloadMedia";
import { saveVideoToProjectAssets } from "@/lib/saveProjectAsset";

type Props = {
  videoUrl: string | null;
  dbId: string;
  prompt: string;
  status: string;
  productName?: string | null;
  onSaved?: (next: { dbId: string; url: string }) => void;
  onOpenInAgent?: () => void;
};

export function GeneratedVideoToolbar({
  videoUrl,
  dbId,
  prompt,
  status,
  productName,
  onSaved,
  onOpenInAgent,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(videoUrl);
  const effectiveUrl = localUrl ?? videoUrl;
  const canSave = status === "succeeded" && Boolean(effectiveUrl?.trim());
  const isProcessing = status === "pending" || status === "processing";

  async function saveToLibrary() {
    if (!effectiveUrl) {
      toast.error("Brak pliku wideo — poczekaj na zakończenie generacji.");
      return;
    }
    setSaving(true);
    const r = await saveVideoToProjectAssets({
      videoUrl: effectiveUrl,
      prompt: prompt || "Wideo reklamowe",
      dbId,
      productName,
    });
    setSaving(false);
    if (r.error && !r.id) {
      toast.error(r.error);
      return;
    }
    if (r.url !== effectiveUrl) {
      setLocalUrl(r.url);
      onSaved?.({ dbId: r.id ?? dbId, url: r.url });
    }
    toast.success(r.alreadySaved ? "Już w zasobach" : "Zapisano w zasobach");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => void saveToLibrary()}
        disabled={saving || !canSave}
        className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        title={
          isProcessing
            ? "Poczekaj na zakończenie generacji"
            : "Zapisz w bibliotece projektu (Zasoby → Wideo)"
        }
      >
        <FolderOpen className="h-3 w-3" strokeWidth={2} />
        Zapisz do zasobów
      </button>
      {effectiveUrl && (
        <button
          type="button"
          onClick={() =>
            void downloadMediaWithToast(effectiveUrl, {
              filenameBase: `wideo-${dbId.slice(0, 8)}`,
              kind: "video",
            })
          }
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
          title="Pobierz wideo na dysk"
        >
          <Download className="h-3 w-3" strokeWidth={2} />
          Pobierz
        </button>
      )}
      {onOpenInAgent && effectiveUrl && (
        <button
          type="button"
          onClick={onOpenInAgent}
          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50"
          title="Otwórz w czacie z linkiem do klipu"
        >
          <MessageSquareText className="h-3 w-3" strokeWidth={2} />
          Edytuj w czacie
        </button>
      )}
    </div>
  );
}
