import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, MessageSquare, Trash2, Settings, Pencil, BookText, Archive } from "lucide-react";
import { toast } from "sonner";
import { useChats, type Chat } from "@/hooks/useChats";
import { ChatTrashList } from "@/components/ChatTrashList";

function groupByTime(chats: Chat[]) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const today: Chat[] = [];
  const week: Chat[] = [];
  const older: Chat[] = [];
  for (const c of chats) {
    const diff = now - c.updatedAt;
    if (diff < day) today.push(c);
    else if (diff < 7 * day) week.push(c);
    else older.push(c);
  }
  return { today, week, older };
}

export function ChatHistoryList({ product }: { product: string }) {
  const navigate = useNavigate();
  const { chats, trash, activeId, create, select, moveToTrash, rename, reorder } = useChats(product);
  const [panel, setPanel] = useState<"history" | "trash">("history");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (!editingId) return;
    const onDown = (e: MouseEvent) => {
      const el = inputRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      rename(editingId, draftTitle);
      setEditingId(null);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [draftTitle, editingId, rename]);

  const groups = groupByTime(
    [...chats].sort((a, b) => b.updatedAt - a.updatedAt)
  );

  const newChat = () => {
    create(product);
    navigate({ to: "/agent" });
  };

  const Section = ({ label, items }: { label: string; items: Chat[] }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-3">
        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="space-y-0.5">
          {items.map((c) => {
            const active = c.id === activeId;
            const isEditing = editingId === c.id;
            return (
              <div
                key={c.id}
                draggable={!isEditing}
                onDragStart={(e) => {
                  setDragId(c.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", c.id);
                }}
                onDragOver={(e) => {
                  if (!dragId || dragId === c.id) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverId(c.id);
                }}
                onDragLeave={() => {
                  if (overId === c.id) setOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId && dragId !== c.id) reorder(dragId, c.id);
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                  active ? "bg-accent/10 text-accent font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                } ${dragId === c.id ? "opacity-50" : ""} ${overId === c.id ? "ring-1 ring-accent/40" : ""}`}
                onClick={() => {
                  if (isEditing) return;
                  select(c.id);
                  navigate({ to: "/agent" });
                }}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                {isEditing ? (
                  <input
                    ref={inputRef}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        rename(c.id, draftTitle);
                        setEditingId(null);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => {
                      rename(c.id, draftTitle);
                      setEditingId(null);
                    }}
                    className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                ) : (
                  <span className="flex-1 truncate">{c.title || "Nowy czat"}</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(c.id);
                    setDraftTitle(c.title || "Nowy czat");
                  }}
                  className={`transition-opacity p-1 rounded hover:bg-background ${
                    isEditing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                  title="Zmień nazwę"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirmId === c.id) {
                      moveToTrash(c.id);
                      setConfirmId(null);
                      toast.message("Czat przeniesiony do kosza.", {
                        description: "Możesz go przywrócić w ciągu 30 dni.",
                      });
                    } else {
                      setConfirmId(c.id);
                      setTimeout(() => setConfirmId((id) => (id === c.id ? null : id)), 2500);
                    }
                  }}
                  className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background ${
                    confirmId === c.id ? "opacity-100 text-red-500" : ""
                  }`}
                  title={confirmId === c.id ? "Kliknij ponownie — do kosza" : "Przenieś do kosza"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (panel === "trash") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <button
          type="button"
          onClick={() => setPanel("history")}
          className="mb-3 flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground rounded-lg hover:bg-muted hover:text-foreground transition-colors"
        >
          ← Historia czatów
        </button>
        <div className="px-3 mb-2 flex items-center gap-2">
          <Archive className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Kosz</span>
          {trash.length > 0 ? (
            <span className="text-[10px] font-medium tabular-nums rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {trash.length}
            </span>
          ) : null}
        </div>
        <ChatTrashList product={product} onBack={() => setPanel("history")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <button
        type="button"
        onClick={newChat}
        className="mb-2 flex items-center gap-2 px-3 py-2 text-sm text-foreground rounded-lg hover:bg-muted transition-colors border border-dashed border-border"
      >
        <Plus className="h-4 w-4" /> Nowy czat
      </button>

      <Link
        to="/agent/customize"
        className="mb-3 flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground rounded-lg hover:bg-muted hover:text-foreground transition-colors"
      >
        <Settings className="h-4 w-4" /> Personalizuj agenta
      </Link>

      <Link
        to="/agent/skills"
        className="mb-3 flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground rounded-lg hover:bg-muted hover:text-foreground transition-colors"
      >
        <BookText className="h-4 w-4" /> Umiejętności
      </Link>

      <button
        type="button"
        onClick={() => setPanel("trash")}
        className="mb-3 flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground rounded-lg hover:bg-muted hover:text-foreground transition-colors w-full"
      >
        <Archive className="h-4 w-4" />
        Kosz
        {trash.length > 0 ? (
          <span className="ml-auto text-[10px] font-medium tabular-nums rounded-full bg-muted px-2 py-0.5">
            {trash.length}
          </span>
        ) : null}
      </button>

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {chats.length === 0 ? (
          <p className="px-3 py-6 text-xs text-muted-foreground text-center">
            Brak czatów. Zacznij rozmowę z agentem.
          </p>
        ) : (
          <>
            <Section label="Dzisiaj" items={groups.today} />
            <Section label="Ostatnie 7 dni" items={groups.week} />
            <Section label="Wcześniej" items={groups.older} />
          </>
        )}
      </div>
    </div>
  );
}
