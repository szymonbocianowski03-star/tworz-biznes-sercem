import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArchiveRestore, Trash2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  CHAT_TRASH_RETENTION_DAYS,
  daysUntilPermanentDelete,
  useChats,
  type TrashedChat,
} from "@/hooks/useChats";

function formatDeletedAt(ts: number) {
  return new Date(ts).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatTrashList({ product, onBack }: { product: string; onBack: () => void }) {
  const navigate = useNavigate();
  const { trash, restore, deleteForever, emptyTrash } = useChats(product);
  const [confirmForeverId, setConfirmForeverId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const sorted = [...trash].sort((a, b) => b.deletedAt - a.deletedAt);

  const handleRestore = (c: TrashedChat) => {
    restore(c.id);
    toast.success("Czat przywrócony z kosza.");
    onBack();
    navigate({ to: "/agent" });
  };

  const handleDeleteForever = (id: string) => {
    if (confirmForeverId !== id) {
      setConfirmForeverId(id);
      setTimeout(() => setConfirmForeverId((cur) => (cur === id ? null : cur)), 2500);
      return;
    }
    deleteForever(id);
    setConfirmForeverId(null);
    toast.success("Czat usunięty na stałe.");
  };

  const handleEmptyTrash = () => {
    if (!confirmEmpty) {
      setConfirmEmpty(true);
      setTimeout(() => setConfirmEmpty(false), 2500);
      return;
    }
    emptyTrash(product);
    setConfirmEmpty(false);
    toast.success("Kosz opróżniony.");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <p className="px-3 mb-3 text-[11px] text-muted-foreground leading-relaxed">
        Usunięte czaty trafiają tutaj i są kasowane na stałe po{" "}
        <strong className="text-foreground">{CHAT_TRASH_RETENTION_DAYS} dniach</strong>.
      </p>

      {sorted.length === 0 ? (
        <p className="px-3 py-8 text-xs text-muted-foreground text-center">Kosz jest pusty.</p>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-0.5">
            {sorted.map((c) => {
              const daysLeft = daysUntilPermanentDelete(c.deletedAt);
              return (
                <div
                  key={c.id}
                  className="group flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm border border-transparent hover:border-border hover:bg-muted/60 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-foreground">{c.title || "Nowy czat"}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Usunięto {formatDeletedAt(c.deletedAt)}
                      {daysLeft > 0 ? (
                        <>
                          {" "}
                          · kasowanie za {daysLeft} {daysLeft === 1 ? "dzień" : "dni"}
                        </>
                      ) : (
                        <> · wkrótce usunięty na stałe</>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(c)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-background text-foreground transition-opacity"
                    title="Przywróć"
                  >
                    <ArchiveRestore className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteForever(c.id)}
                    className={`p-1.5 rounded-md hover:bg-background transition-opacity ${
                      confirmForeverId === c.id
                        ? "opacity-100 text-red-600"
                        : "opacity-0 group-hover:opacity-100 text-muted-foreground"
                    }`}
                    title={confirmForeverId === c.id ? "Kliknij ponownie — usuń na stałe" : "Usuń na stałe"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleEmptyTrash}
            className={`mt-3 mx-3 text-xs font-medium rounded-lg border px-3 py-2 transition-colors ${
              confirmEmpty
                ? "border-red-500/50 bg-red-500/10 text-red-600"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {confirmEmpty ? "Kliknij ponownie — opróżnij kosz" : "Opróżnij kosz"}
          </button>
        </>
      )}
    </div>
  );
}
