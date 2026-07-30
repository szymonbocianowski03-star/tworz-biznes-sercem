import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Globe,
  Sparkles,
  Trash2,
  Pencil,
  RefreshCw,
  Building2,
  ExternalLink,
  ArrowLeft,
  Package,
  Briefcase,
  Save,
  ChevronDown,
  ChevronUp,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { useBrands, type Brand, type BrandAiContext } from "@/hooks/useBrands";
import { useProducts, type CatalogKind } from "@/hooks/useProducts";
import { useWorkspace } from "@/hooks/useWorkspace";
import { runCompetitorScan } from "@/lib/competitorScan.functions";
import { extractBrandColorsFromUrl } from "@/lib/brandColors.functions";
import { mapCompetitorScanToBrandContext } from "@/lib/brandScan";
import { useAuthSession } from "@/hooks/useAuthSession";
import { NewProductModal } from "@/components/NewProductModal";

export const Route = createFileRoute("/products/brands")({
  head: () => ({ meta: [{ title: "Marki — MarketingNow" }] }),
  component: ProductsBrands,
});

type ContextDraft = {
  summary: string;
  industry: string;
  targetAudience: string;
  valueProposition: string;
};

function contextToDraft(ctx?: BrandAiContext): ContextDraft {
  return {
    summary: ctx?.summary ?? "",
    industry: ctx?.industry ?? "",
    targetAudience: ctx?.targetAudience ?? "",
    valueProposition: ctx?.valueProposition ?? "",
  };
}

function BrandContextEditor({
  brand,
  onSave,
}: {
  brand: Brand;
  onSave: (patch: Partial<BrandAiContext>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ContextDraft>(() => contextToDraft(brand.aiContext));

  const startEdit = () => {
    setDraft(contextToDraft(brand.aiContext));
    setEditing(true);
  };

  const save = () => {
    if (!draft.summary.trim()) {
      toast.error("Uzupełnij opis kontekstu marki.");
      return;
    }
    onSave({
      summary: draft.summary.trim(),
      industry: draft.industry.trim() || undefined,
      targetAudience: draft.targetAudience.trim() || undefined,
      valueProposition: draft.valueProposition.trim() || undefined,
      sourceUrl: brand.websiteUrl ?? brand.aiContext?.sourceUrl ?? "",
      scrapedAt: brand.aiContext?.scrapedAt ?? Date.now(),
    });
    setEditing(false);
    toast.success("Kontekst marki zapisany.");
  };

  if (!editing && !brand.aiContext?.summary) {
    return (
      <button
        type="button"
        onClick={startEdit}
        className="block w-full text-left text-sm text-accent hover:underline py-1"
      >
        + Dodaj kontekst ręcznie
      </button>
    );
  }

  if (!editing) {
    const ctx = brand.aiContext!;
    return (
      <div className="rounded-xl bg-muted/40 border border-border/60 p-5 text-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-foreground">Kontekst AI marki</p>
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" /> Edytuj
          </button>
        </div>
        {ctx.industry && (
          <p>
            <span className="font-medium">Branża:</span> {ctx.industry}
          </p>
        )}
        {ctx.targetAudience && (
          <p>
            <span className="font-medium">Grupa docelowa:</span> {ctx.targetAudience}
          </p>
        )}
        {ctx.valueProposition && (
          <p>
            <span className="font-medium">Propozycja wartości:</span> {ctx.valueProposition}
          </p>
        )}
        <p className="whitespace-pre-wrap text-muted-foreground">{ctx.summary}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-5 space-y-4">
      <p className="text-sm font-medium">Edytuj kontekst marki</p>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Branża</label>
        <input
          value={draft.industry}
          onChange={(e) => setDraft((d) => ({ ...d, industry: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="np. Kosmetyka naturalna"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Grupa docelowa</label>
        <input
          value={draft.targetAudience}
          onChange={(e) => setDraft((d) => ({ ...d, targetAudience: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="np. Kobiety 25–45 lat"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Propozycja wartości</label>
        <input
          value={draft.valueProposition}
          onChange={(e) => setDraft((d) => ({ ...d, valueProposition: e.target.value }))}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder="np. Skuteczna pielęgnacja bez chemii"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Opis / kontekst dla AI *</label>
        <textarea
          value={draft.summary}
          onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
          rows={6}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y"
          placeholder="Kim jest marka, co oferuje, jaki ma ton komunikacji…"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium"
        >
          <Save className="h-3.5 w-3.5" /> Zapisz kontekst
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-4 py-2 rounded-full border border-border text-sm hover:bg-muted"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

function ProductsBrands() {
  const navigate = useNavigate();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { brands, create, update, updateAiContext, remove } = useBrands(activeWorkspaceId);
  const { products, create: createItem, select, remove: removeItem } = useProducts(activeWorkspaceId);
  const { isAuthenticated } = useAuthSession();
  const competitorScanFn = useServerFn(runCompetitorScan);
  const extractColorsFn = useServerFn(extractBrandColorsFromUrl);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalBrandId, setModalBrandId] = useState<string | null>(null);
  const [modalKind, setModalKind] = useState<CatalogKind>("product");
  const [showItemModal, setShowItemModal] = useState(false);

  const handleCreate = () => {
    if (!newName.trim()) return;
    create(newName, {
      websiteUrl: newUrl.trim() || undefined,
      workspaceId: activeWorkspaceId ?? undefined,
    });
    setNewName("");
    setNewUrl("");
    setShowNew(false);
    toast.success("Marka utworzona.");
  };

  const scanBrand = async (brand: Brand) => {
    const url = brand.websiteUrl?.trim();
    if (!url) {
      toast.error("Dodaj adres strony marki przed skanowaniem.");
      return;
    }
    if (!isAuthenticated) {
      toast.error("Zaloguj się, aby skanować strony marki (wymaga kredytów AI).");
      return;
    }

    setScanningId(brand.id);
    try {
      const [result, colorRes] = await Promise.all([
        competitorScanFn({
          data: { url, focusAreas: ["copy", "landing", "seo"] },
        }),
        extractColorsFn({ data: { url } }).catch(() => ({ ok: false as const, message: "skip" })),
      ]);
      const mapped = mapCompetitorScanToBrandContext(url, result);
      if (!mapped.ok) {
        toast.error(mapped.error);
        return;
      }
      const colors =
        colorRes.ok && "colors" in colorRes
          ? colorRes.colors.filter((c) => /^#[0-9A-Fa-f]{6}$/i.test(c)).slice(0, 4)
          : [];
      update(brand.id, {
        aiContext: mapped.context,
        ...(colors.length ? { brandColors: colors.map((c) => c.toUpperCase()) } : {}),
      });
      setExpandedId(brand.id);
      toast.success(
        colors.length
          ? "Strona marki zeskanowana — kontekst i kolory zapisane."
          : "Strona marki zeskanowana — możesz edytować kontekst.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zeskanować strony.");
    } finally {
      setScanningId(null);
    }
  };

  const openAddItem = (brandId: string, kind: CatalogKind) => {
    setModalBrandId(brandId);
    setModalKind(kind);
    setShowItemModal(true);
  };

  const handleCreateItem = ({
    name,
    thumbnail,
    brandId,
  }: {
    name: string;
    thumbnail?: string;
    brandId?: string;
  }) => {
    const p = createItem(name, {
      thumbnail,
      kind: modalKind,
      brandId: brandId ?? modalBrandId ?? undefined,
      workspaceId: activeWorkspaceId ?? undefined,
    });
    select(p.id);
    setShowItemModal(false);
    toast.success(modalKind === "service" ? "Usługa dodana do marki." : "Produkt dodany do marki.");
    navigate({ to: "/agent" });
  };

  return (
    <div className="px-6 md:px-10 py-10 max-w-4xl">
      <Link
        to="/products/choose"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Panel marek
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Marki</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            {activeWorkspace ? (
              <>
                Workspace <span className="font-medium text-foreground">{activeWorkspace.name}</span> — marki
                z produktami, usługami i tożsamością wizualną. Członkowie zespołu widzą udostępnione marki.
              </>
            ) : (
              "Marka to główny kontener — produkty, usługi i brand kit w jednym miejscu."
            )}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nowa marka
        </button>
      </div>

      {showNew && (
        <div className="mt-6 rounded-2xl border border-border bg-surface-elevated p-5 space-y-4">
          <h2 className="font-semibold">Nowa marka</h2>
          <div>
            <label className="text-sm font-medium">Nazwa marki</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="np. Moja Firma"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Strona WWW (opcjonalnie)</label>
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://twoja-marka.pl"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium disabled:opacity-50"
            >
              Utwórz
            </button>
            <button
              onClick={() => setShowNew(false)}
              className="px-4 py-2 rounded-full border border-border text-sm hover:bg-muted"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {brands.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
            <Building2 className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="mt-5 text-lg font-semibold">Brak marek</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Utwórz markę, dodaj produkty i usługi — agent będzie znał pełny kontekst.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {brands.map((brand) => {
            const brandItems = products.filter((p) => p.brandId === brand.id);
            const productsInBrand = brandItems.filter((p) => p.kind === "product");
            const servicesInBrand = brandItems.filter((p) => p.kind === "service");
            const isExpanded = expandedId === brand.id;

            return (
              <div key={brand.id} className="rounded-2xl border border-border bg-surface-elevated overflow-hidden">
                <div className="p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-4">
                      <h3 className="text-lg font-semibold">{brand.name}</h3>
                      {brand.websiteUrl ? (
                        <a
                          href={
                            brand.websiteUrl.startsWith("http")
                              ? brand.websiteUrl
                              : `https://${brand.websiteUrl}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
                        >
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          {brand.websiteUrl}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <p className="text-sm text-muted-foreground">Brak strony WWW</p>
                      )}
                      {(brand.aiContext?.summary || brand.visibility === "team") && (
                        <div className="flex flex-wrap gap-2">
                          {brand.aiContext?.summary && (
                            <span className="inline-flex px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 text-xs font-medium border border-emerald-500/20">
                              Kontekst AI zapisany
                            </span>
                          )}
                          {brand.visibility === "team" && (
                            <span className="inline-flex px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                              Udostępniona zespołowi
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => scanBrand(brand)}
                        disabled={scanningId === brand.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:bg-muted disabled:opacity-50"
                      >
                        {scanningId === brand.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {brand.aiContext ? "Skanuj ponownie" : "Skanuj stronę"}
                      </button>
                      <button
                        onClick={() => {
                          const name = window.prompt("Nowa nazwa", brand.name);
                          if (name?.trim()) update(brand.id, { name: name.trim() });
                        }}
                        className="p-2 rounded-lg border border-border hover:bg-muted"
                        aria-label="Zmień nazwę"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Usunąć markę „${brand.name}"? Produkty i usługi pozostaną bez marki.`))
                            remove(brand.id);
                        }}
                        className="p-2 rounded-lg border border-border hover:bg-muted text-red-500"
                        aria-label="Usuń markę"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {!brand.websiteUrl && (
                    <div className="mt-5">
                      <input
                        placeholder="Wklej adres strony marki…"
                        className="w-full rounded-xl border border-border bg-background px-4 py-2 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val) update(brand.id, { websiteUrl: val });
                          }
                        }}
                      />
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t border-border/70">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : brand.id)}
                      className="w-full flex items-center justify-between gap-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <span className="font-medium">
                        {isExpanded ? "Zwiń szczegóły" : "Kontekst i skład marki"}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 flex flex-col gap-6">
                      <section className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Kontekst AI
                        </h4>
                        <BrandContextEditor
                          brand={brand}
                          onSave={(patch) => updateAiContext(brand.id, patch)}
                        />
                      </section>

                      <section>
                        <Link
                          to="/products/brand-visual"
                          search={{ brandId: brand.id }}
                          className="flex w-full items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-accent hover:bg-muted/50 transition-colors"
                        >
                          <Palette className="h-4 w-4 shrink-0" />
                          <span className="min-w-0">Tożsamość wizualna marki (brand kit)</span>
                        </Link>
                      </section>

                      <div className="pt-5 border-t border-border/70">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-sm">Skład marki</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Produkty i usługi należące do tej marki
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openAddItem(brand.id, "service")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium hover:bg-muted"
                            >
                              <Briefcase className="h-3.5 w-3.5" /> Usługa
                            </button>
                            <button
                              type="button"
                              onClick={() => openAddItem(brand.id, "product")}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90"
                            >
                              <Package className="h-3.5 w-3.5" /> Produkt
                            </button>
                          </div>
                        </div>

                        {brandItems.length === 0 ? (
                          <p className="mt-4 text-sm text-muted-foreground">
                            Brak produktów i usług — dodaj pierwszą pozycję do tej marki.
                          </p>
                        ) : (
                          <div className="mt-4 space-y-4">
                            {productsInBrand.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                  Produkty ({productsInBrand.length})
                                </p>
                                <ul className="space-y-1">
                                  {productsInBrand.map((p) => (
                                    <li
                                      key={p.id}
                                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-muted/60"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          select(p.id);
                                          navigate({ to: "/agent" });
                                        }}
                                        className="flex items-center gap-2 text-sm text-left min-w-0"
                                      >
                                        <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{p.name}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeItem(p.id)}
                                        className="text-muted-foreground hover:text-red-500 p-1"
                                        aria-label="Usuń"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {servicesInBrand.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                  Usługi ({servicesInBrand.length})
                                </p>
                                <ul className="space-y-1">
                                  {servicesInBrand.map((p) => (
                                    <li
                                      key={p.id}
                                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-muted/60"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          select(p.id);
                                          navigate({ to: "/agent" });
                                        }}
                                        className="flex items-center gap-2 text-sm text-left min-w-0"
                                      >
                                        <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{p.name}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeItem(p.id)}
                                        className="text-muted-foreground hover:text-red-500 p-1"
                                        aria-label="Usuń"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewProductModal
        open={showItemModal}
        onClose={() => setShowItemModal(false)}
        onCreate={handleCreateItem}
        kind={modalKind}
        workspaceId={activeWorkspaceId}
        defaultBrandId={modalBrandId ?? undefined}
        lockBrand
      />
    </div>
  );
}
