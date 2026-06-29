import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Plus, LayoutGrid, List, Lock, Package, MoreHorizontal, Trash2, Pencil, Palette, ImageIcon } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { NewProductModal } from "@/components/NewProductModal";
import { ProductImagePicker } from "@/components/ProductImagePicker";
import { UpgradeAccountDialog } from "@/components/UpgradeAccountDialog";
import { useAuthSession } from "@/hooks/useAuthSession";
import { readImageAsDataUrl } from "@/lib/readImageAsDataUrl";
import { toast } from "sonner";

export const Route = createFileRoute("/products/library")({
  component: ProductsLibrary,
});

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "przed chwilą";
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.floor(h / 24);
  if (d === 1) return "wczoraj";
  if (d < 30) return `${d} dni temu`;
  return new Date(ts).toLocaleDateString("pl-PL");
}

function ProductsLibrary() {
  const navigate = useNavigate();
  const { products, create, select, remove, update } = useProducts();
  const { isAuthenticated } = useAuthSession();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState<false | "signup" | "pro">(false);

  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  const ANON_LIMIT = 1;
  const FREE_LIMIT = 3;

  const newProduct = () => {
    if (!isAuthenticated && products.length >= ANON_LIMIT) {
      setShowUpgrade("signup");
      return;
    }
    if (isAuthenticated && products.length >= FREE_LIMIT) {
      setShowUpgrade("pro");
      return;
    }
    setShowNew(true);
  };

  const handleCreate = ({ name, thumbnail }: { name: string; thumbnail?: string }) => {
    const p = create(name, { thumbnail });
    select(p.id);
    setShowNew(false);
    navigate({ to: "/agent" });
  };

  const setProductThumbnail = (id: string, thumbnail: string) => {
    update(id, { thumbnail, status: "ready" });
  };

  const openProduct = (id: string) => {
    select(id);
    navigate({ to: "/agent" });
  };

  const renameProduct = (id: string, current: string) => {
    const name = window.prompt("Nowa nazwa", current);
    if (name?.trim()) update(id, { name: name.trim() });
    setMenuId(null);
  };

  return (
    <div className="px-6 md:px-10 py-10 max-w-6xl">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Produkty</h1>
      <p className="mt-2 text-sm text-muted-foreground">Wszystkie produkty Twojego workspace w jednym miejscu.</p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          to="/products/brand-visual"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          <Palette className="h-4 w-4 text-violet-600" />
          Tożsamość wizualna marki
        </Link>
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj produktów..."
            className="w-full rounded-full border border-border bg-surface-elevated pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="inline-flex items-center rounded-full border border-border bg-surface-elevated p-1">
          <button
            onClick={() => setView("grid")}
            className={`p-1.5 rounded-full transition-all ${view === "grid" ? "bg-foreground text-background" : "text-muted-foreground"}`}
            aria-label="Widok kafelków"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={`p-1.5 rounded-full transition-all ${view === "list" ? "bg-foreground text-background" : "text-muted-foreground"}`}
            aria-label="Widok listy"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={newProduct}
          className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all shadow-elevated"
        >
          <Plus className="h-4 w-4" /> Nowy produkt
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-5 text-lg font-semibold">Brak produktów</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">Dodaj pierwszy produkt, aby agent mógł zacząć tworzyć kampanie.</p>
        </div>
      ) : view === "grid" ? (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="group rounded-2xl border border-border bg-surface-elevated overflow-hidden hover:shadow-elevated transition-all"
            >
              <ProductImagePicker
                variant="card"
                value={p.thumbnail}
                alt={p.name}
                onChange={(url) => setProductThumbnail(p.id, url)}
                className="w-full bg-gradient-to-br from-stone-100 to-stone-200"
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => openProduct(p.id)} className="text-left min-w-0 flex-1">
                    <h3 className="font-semibold tracking-tight truncate">{p.name}</h3>
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setMenuId((id) => (id === p.id ? null : p.id))}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuId === p.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-surface-elevated shadow-elevated p-1 z-20">
                        <button
                          onClick={() => renameProduct(p.id, p.name)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Zmień nazwę
                        </button>
                        <label className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted cursor-pointer">
                          <ImageIcon className="h-3.5 w-3.5" /> Zmień zdjęcie
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (!f) return;
                              void readImageAsDataUrl(f)
                                .then((url) => {
                                  setProductThumbnail(p.id, url);
                                  setMenuId(null);
                                })
                                .catch((err) =>
                                  toast.error(err instanceof Error ? err.message : "Nie udało się wczytać zdjęcia."),
                                );
                            }}
                          />
                        </label>
                        <button
                          onClick={() => { remove(p.id); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Usuń
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Lock className="h-3 w-3" /> {p.visibility === "team" ? "Zespół" : "Prywatny"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Edytowano {timeAgo(p.updatedAt)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-border bg-surface-elevated overflow-hidden">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className={`w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <ProductImagePicker
                  variant="tile"
                  value={p.thumbnail}
                  alt={p.name}
                  onChange={(url) => setProductThumbnail(p.id, url)}
                />
              </div>
              <button type="button" onClick={() => openProduct(p.id)} className="min-w-0 flex-1 text-left">
                <p className="font-medium truncate">{p.name}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> {p.visibility === "team" ? "Zespół" : "Prywatny"}</span>
                  <span>·</span>
                  <span>Edytowano {timeAgo(p.updatedAt)}</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      <NewProductModal open={showNew} onClose={() => setShowNew(false)} onCreate={handleCreate} />
      <UpgradeAccountDialog
        open={!!showUpgrade}
        onClose={() => setShowUpgrade(false)}
        variant={showUpgrade === "pro" ? "pro" : "signup"}
      />
    </div>
  );
}
