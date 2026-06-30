import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Heart, ThumbsDown, Trash2, Layers, Check, Pencil, X, Upload, Sparkles, Plus } from "lucide-react";

export const Route = createFileRoute("/launch/")({
  component: LaunchPage,
});

const sidebarItems = [
  { key: "all", label: "Wszystkie kreacje", icon: Layers },
  { key: "liked", label: "Polubione", icon: Heart },
  { key: "disliked", label: "Odrzucone", icon: ThumbsDown },
  { key: "deleted", label: "Niedawno usunięte", icon: Trash2 },
];

function LaunchPage() {
  const [active, setActive] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [copyFilter, setCopyFilter] = useState<"all" | "has" | "needs">("all");
  const [attachOpen, setAttachOpen] = useState<null | { id: string | "all" }>(null);

  const creatives: { id: string; title: string }[] = [];
  const basket: { id: string; title: string }[] = [];

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Main: Creative library */}
      <div className="flex-1 min-w-0 px-6 md:px-10 py-10">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Biblioteka kreacji</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Przeglądaj kreacje, dodawaj je do koszyka i uzupełnij copy przed uruchomieniem.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Szukaj kreacji lub copy..."
              className="w-full rounded-full border border-border bg-surface-elevated pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <select className="rounded-full border border-border bg-surface-elevated px-4 py-2.5 text-sm">
            <option>Wszystkie media</option>
            <option>Obrazy</option>
            <option>Wideo</option>
          </select>
          <select className="rounded-full border border-border bg-surface-elevated px-4 py-2.5 text-sm">
            <option>Najnowsze</option>
            <option>Najstarsze</option>
          </select>
        </div>

        {/* Status pills */}
        <div className="mt-5 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground mr-1">Status copy:</span>
          {[
            { k: "all", label: "Wszystkie", count: creatives.length },
            { k: "has", label: "Z copy", count: 0 },
            { k: "needs", label: "Wymaga copy", count: 0 },
          ].map((p) => (
            <button
              key={p.k}
              onClick={() => setCopyFilter(p.k as typeof copyFilter)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                copyFilter === p.k
                  ? "bg-foreground text-background border-foreground"
                  : "bg-surface-elevated border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${copyFilter === p.k ? "bg-background/20" : "bg-muted"}`}>
                {p.count}
              </span>
            </button>
          ))}
          <button className="ml-auto text-sm text-muted-foreground hover:text-foreground">Odznacz widoczne</button>
        </div>

        {/* Body: sidebar + grid */}
        <div className="mt-7 grid grid-cols-[180px_1fr] gap-8">
          <aside>
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-3">Biblioteka</p>
            <nav className="space-y-1">
              {sidebarItems.map((it) => {
                const Icon = it.icon;
                const isActive = active === it.key;
                return (
                  <button
                    key={it.key}
                    onClick={() => setActive(it.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {it.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div>
            {creatives.length === 0 ? (
              <EmptyGrid />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {creatives.map((c) => {
                  const isSel = selected.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(c.id)}
                      className={`relative aspect-[3/4] rounded-xl border bg-surface-elevated overflow-hidden transition-all hover:shadow-soft ${
                        isSel ? "border-accent ring-2 ring-accent/40" : "border-border"
                      }`}
                    >
                      <div
                        className={`absolute top-2 right-2 h-6 w-6 rounded-md flex items-center justify-center transition-all ${
                          isSel ? "bg-accent text-accent-foreground" : "bg-background/80 border border-border"
                        }`}
                      >
                        {isSel && <Check className="h-4 w-4" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: launch basket */}
      <aside className="hidden lg:flex w-[360px] shrink-0 border-l border-border bg-surface flex-col">
        <div className="px-6 pt-10 pb-5 border-b border-border">
          <h2 className="text-2xl font-semibold tracking-tight">Koszyk uruchomienia</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {selected.length} reklam wybranych · {selected.length} wymaga copy
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {selected.length === 0 && basket.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                <Layers className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Wybierz kreacje z biblioteki, aby zbudować koszyk.
              </p>
            </div>
          ) : (
            selected.map((id) => (
              <div key={id} className="rounded-xl border border-border bg-surface-elevated p-3 flex gap-3">
                <div className="h-12 w-12 rounded-lg bg-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">Kreacja {id.slice(0, 6)}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Brak copy</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Brak treści jeszcze</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-1">Dodaj nagłówek i tekst, aby kontynuować.</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center">
                    <Pencil onClick={() => setAttachOpen({ id })} className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => toggle(id)} className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border space-y-2">
          <button onClick={() => setAttachOpen({ id: "all" })} className="w-full py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-all shadow-elevated">
            Zastosuj to samo copy
          </button>
          <button className="w-full py-2.5 rounded-full border border-border bg-surface-elevated text-sm font-medium hover:bg-muted transition-all inline-flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" /> Generuj unikalne copy
          </button>
          <p className="text-[11px] text-center text-muted-foreground pt-1">
            Dodaj copy do każdej reklamy, aby kontynuować.
          </p>
          <button className="w-full py-2 rounded-full text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-2">
            <Upload className="h-4 w-4" /> Wgraj kreację
          </button>
        </div>
      </aside>
      {attachOpen && <AttachCopyModal onClose={() => setAttachOpen(null)} />}
    </div>
  );
}

function AttachCopyModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"new" | "library">("new");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl bg-background border border-border shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Dołącz copy</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Wybierz istniejące copy lub stwórz nowe dla tej kreacji.
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6">
          <div className="rounded-xl border border-border bg-surface-elevated p-3 flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-muted shrink-0" />
            <p className="text-xs text-muted-foreground truncate">Podgląd kreacji</p>
          </div>
        </div>

        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 rounded-full border border-border bg-surface-elevated p-1 text-sm">
            <button
              onClick={() => setTab("new")}
              className={`py-2 rounded-full transition-all ${tab === "new" ? "bg-background shadow-soft font-medium" : "text-muted-foreground"}`}
            >
              Stwórz nowe copy
            </button>
            <button
              onClick={() => setTab("library")}
              className={`py-2 rounded-full transition-all ${tab === "library" ? "bg-background shadow-soft font-medium" : "text-muted-foreground"}`}
            >
              Wybierz z biblioteki
            </button>
          </div>
        </div>

        {tab === "new" ? (
          <div className="px-6 py-5 space-y-4">
            <Field label="Nagłówek" placeholder="Wpisz nagłówek" />
            <Field label="Główny tekst" placeholder="Wpisz tekst reklamy" textarea />
            <div>
              <label className="text-sm font-medium">Język copy</label>
              <select className="mt-1.5 w-full rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option>🇵🇱 Polski</option>
                <option>🇬🇧 English</option>
                <option>🇩🇪 Deutsch</option>
                <option>🇪🇸 Español</option>
              </select>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Język zostanie użyty do generowania AI i zapisany na rekordzie copy.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5">
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">Brak zapisanego copy w bibliotece.</p>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 bg-surface">
          <button onClick={onClose} className="px-4 py-2 rounded-full border border-border bg-background text-sm font-medium hover:bg-muted transition-all">
            Anuluj
          </button>
          <button className="px-5 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-all shadow-elevated">
            Zapisz i dołącz
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder, textarea }: { label: string; placeholder: string; textarea?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-surface-elevated text-xs hover:bg-muted transition-all">
          <Sparkles className="h-3 w-3" /> Generuj z AI
        </button>
      </div>
      {textarea ? (
        <textarea
          rows={4}
          placeholder={placeholder}
          className="mt-1.5 w-full rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
        />
      ) : (
        <input
          placeholder={placeholder}
          className="mt-1.5 w-full rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      )}
    </div>
  );
}

function EmptyGrid() {
  return (
    <div className="relative rounded-2xl border border-dashed border-border bg-surface-elevated/50 p-12 text-center">
      <div className="mx-auto h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
        <Layers className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-5 text-base font-semibold">Brak kreacji w bibliotece</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
        Wygeneruj kreacje z agentem lub wgraj własne, aby pojawiły się tutaj.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link to="/agent" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium">
          <Plus className="h-4 w-4" /> Wygeneruj kreacje
        </Link>
        <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border bg-surface-elevated text-sm font-medium">
          <Upload className="h-4 w-4" /> Wgraj
        </button>
      </div>
    </div>
  );
}
