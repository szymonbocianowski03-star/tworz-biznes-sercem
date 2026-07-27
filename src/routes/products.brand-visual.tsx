import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, Palette, X } from "lucide-react";
import { toast } from "sonner";
import { useBrands } from "@/hooks/useBrands";
import { useWorkspace } from "@/hooks/useWorkspace";
import { AppBackLink } from "@/components/AppBackLink";
import { BRAND_VISUAL_RULES_ALTERNATES, DEFAULT_BRAND_VISUAL_RULES } from "@/lib/brandVisualDefaults";

export const Route = createFileRoute("/products/brand-visual")({
  validateSearch: (s: Record<string, unknown>) => ({
    brandId: typeof s.brandId === "string" ? s.brandId : undefined,
  }),
  head: () => ({ meta: [{ title: "Tożsamość wizualna marki — MarketingNow" }] }),
  component: BrandVisualPage,
});

const MAX_IMAGES = 4;
const MAX_DATA_URL_LENGTH = 480_000;

function BrandVisualPage() {
  const { brandId: brandIdFromUrl } = useSearch({ from: "/products/brand-visual" });
  const { activeWorkspaceId } = useWorkspace();
  const { brands, update } = useBrands(activeWorkspaceId);
  const regenIdx = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeBrandId, setActiveBrandId] = useState<string | null>(null);
  const active = brands.find((b) => b.id === activeBrandId) ?? brands[0] ?? null;

  useEffect(() => {
    if (brandIdFromUrl && brands.some((b) => b.id === brandIdFromUrl)) {
      setActiveBrandId((prev) => (prev === brandIdFromUrl ? prev : brandIdFromUrl));
      return;
    }
    const firstId = brands[0]?.id;
    if (firstId) {
      setActiveBrandId((prev) => prev ?? firstId);
    }
  }, [brandIdFromUrl, brands[0]?.id]);

  const [draftRules, setDraftRules] = useState("");
  const lastSavedRef = useRef("");

  useEffect(() => {
    setDraftRules(active?.brandVisualRules ?? "");
  }, [active?.id, active?.brandVisualRules]);

  useEffect(() => {
    lastSavedRef.current = active?.brandVisualRules ?? "";
  }, [active?.id, active?.brandVisualRules]);

  const handleLoadDefaultTemplate = () => {
    if (!active) return;
    setDraftRules(DEFAULT_BRAND_VISUAL_RULES);
    update(active.id, { brandVisualRules: DEFAULT_BRAND_VISUAL_RULES });
    lastSavedRef.current = DEFAULT_BRAND_VISUAL_RULES;
    toast.success("Wczytano domyślny szablon reguł — edytuj pod swoją markę.");
  };

  const saveRulesSilent = () => {
    if (!active) return;
    if (draftRules === lastSavedRef.current) return;
    update(active.id, { brandVisualRules: draftRules });
    lastSavedRef.current = draftRules;
  };

  const saveRules = () => {
    if (!active) return;
    update(active.id, { brandVisualRules: draftRules });
    lastSavedRef.current = draftRules;
    toast.success("Zapisano reguły wizualne marki.");
  };

  const handleRegenerateAll = () => {
    if (!active) return;
    regenIdx.current = (regenIdx.current + 1) % BRAND_VISUAL_RULES_ALTERNATES.length;
    const next = BRAND_VISUAL_RULES_ALTERNATES[regenIdx.current] ?? DEFAULT_BRAND_VISUAL_RULES;
    setDraftRules(next);
    update(active.id, { brandVisualRules: next });
    lastSavedRef.current = next;
    toast.message("Wstawiono nowy zestaw reguł (szablon). Dostosuj tekst pod swoją markę.");
  };

  const handleStartOver = () => {
    if (!active) return;
    if (!window.confirm("Wyczyścić reguły i obrazy referencyjne tej marki?")) return;
    setDraftRules("");
    update(active.id, { brandVisualRules: "", brandVisualImages: [] });
    lastSavedRef.current = "";
    toast.success("Zresetowano.");
  };

  const handleAddImages = async (files: FileList | null) => {
    if (!active || !files?.length) return;
    const current = active.brandVisualImages ?? [];
    const remaining = MAX_IMAGES - current.length;
    if (remaining <= 0) {
      toast.error(`Możesz dodać maks. ${MAX_IMAGES} obrazy referencyjne.`);
      return;
    }
    const next = [...current];
    for (const f of Array.from(files).slice(0, remaining)) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name}: to nie jest obraz.`);
        continue;
      }
      const dataUrl = await new Promise<string | null>((res) => {
        const r = new FileReader();
        r.onload = () => res(typeof r.result === "string" ? r.result : null);
        r.onerror = () => res(null);
        r.readAsDataURL(f);
      });
      if (!dataUrl) {
        toast.error(`Nie udało się wczytać ${f.name}.`);
        continue;
      }
      if (dataUrl.length > MAX_DATA_URL_LENGTH) {
        toast.error(`${f.name}: plik za duży (użyj max ~350 KB).`);
        continue;
      }
      next.push(dataUrl);
    }
    if (next.length > current.length) {
      update(active.id, { brandVisualImages: next });
      toast.success("Dodano obrazy referencyjne marki.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (index: number) => {
    if (!active) return;
    const cur = [...(active.brandVisualImages ?? [])];
    cur.splice(index, 1);
    update(active.id, { brandVisualImages: cur });
  };

  if (!brands.length) {
    return (
      <div className="px-6 md:px-10 py-10 max-w-3xl">
        <AppBackLink to="/products/brands" label="Wróć do marek" className="mb-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Tożsamość wizualna marki</h1>
        <p className="mt-2 text-sm text-muted-foreground">Najpierw utwórz markę w workspace.</p>
        <Link
          to="/products/brands"
          className="mt-6 inline-flex rounded-full bg-foreground text-background px-5 py-2.5 text-sm font-medium"
        >
          Przejdź do marek
        </Link>
      </div>
    );
  }

  const images = active?.brandVisualImages ?? [];

  return (
    <div className="px-6 md:px-10 py-10 max-w-4xl">
      <AppBackLink to="/products/brands" label="Wróć do marek" className="mb-6" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-accent">
            <Palette className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Brand kit</span>
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Tożsamość wizualna marki
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
            Wzorce wizualne przypisane do marki — agent stosuje je przy wszystkich produktach i usługach w
            składzie marki. Członkowie zespołu widzą ten sam brand kit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleAddImages(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="h-4 w-4" />
            Dodaj obrazy
          </button>
          <button
            type="button"
            onClick={handleLoadDefaultTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Domyślny szablon
          </button>
          <button
            type="button"
            onClick={handleRegenerateAll}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Regeneruj zestaw
          </button>
          <button
            type="button"
            onClick={handleStartOver}
            className="text-sm font-medium text-muted-foreground hover:text-foreground px-2 py-2"
          >
            Zacznij od zera
          </button>
        </div>
      </div>

      {brands.length > 1 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Marka:</span>
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBrandId(b.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active?.id === b.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Obrazy referencyjne marki
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {images.map((src, i) => (
              <div
                key={`${i}-${src.slice(0, 40)}`}
                className="relative group w-24 h-24 rounded-xl overflow-hidden border border-border bg-muted"
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 h-7 w-7 rounded-full bg-background/90 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  aria-label="Usuń obraz"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-border bg-stone-100/80 dark:bg-muted/40 p-5 md:p-6">
        <h2 className="text-lg font-bold text-foreground">Reguły wizualne marki „{active?.name}”</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Obowiązują we wszystkich kreacjach produktów i usług tej marki.
        </p>

        <div className="mt-4 rounded-xl border border-border bg-background shadow-sm overflow-hidden">
          <textarea
            value={draftRules}
            onChange={(e) => setDraftRules(e.target.value)}
            onBlur={saveRulesSilent}
            spellCheck={false}
            className="w-full min-h-[320px] max-h-[min(70vh,560px)] resize-y p-4 text-sm leading-relaxed font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent/25 bg-transparent"
            placeholder={"## Nastrój\nOpisz styl marki, kolory, typografię…\n\n## Tego nie rób\n…"}
          />
        </div>
        <button
          type="button"
          onClick={saveRules}
          className="mt-4 rounded-lg bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          Zapisz reguły
        </button>
      </div>
    </div>
  );
}
