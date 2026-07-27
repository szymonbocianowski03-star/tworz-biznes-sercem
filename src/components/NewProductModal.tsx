import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { X, Check, XCircle, ArrowRight } from "lucide-react";
import { ProductImagePicker } from "@/components/ProductImagePicker";
import { useBrands } from "@/hooks/useBrands";
import type { CatalogKind } from "@/hooks/useProducts";

type Props = {
  open: boolean;
  onClose: () => void;
  kind?: CatalogKind;
  workspaceId?: string | null;
  defaultBrandId?: string;
  lockBrand?: boolean;
  onCreate: (data: { name: string; thumbnail?: string; brandId?: string }) => void;
  /** Podgląd miniatury w nagłówku (np. przy „Nowy produkt”) zanim produkt zostanie utworzony */
  onThumbnailPreview?: (dataUrl: string | undefined) => void;
};

export function NewProductModal({
  open,
  onClose,
  onCreate,
  onThumbnailPreview,
  kind = "product",
  workspaceId,
  defaultBrandId,
  lockBrand = false,
}: Props) {
  const { brands } = useBrands(workspaceId);
  const [step, setStep] = useState<1 | 2>(kind === "service" ? 2 : 1);
  const [name, setName] = useState("");
  const [thumb, setThumb] = useState<string | undefined>();
  const [brandId, setBrandId] = useState<string>("");

  const isService = kind === "service";
  const label = isService ? "usługę" : "produkt";
  const labelCap = isService ? "Usługa" : "Produkt";
  const itemLabel = isService ? "usługi" : "produktu";
  const itemLabelCap = isService ? "usługa" : "produkt";
  const itemLabelPlural = isService ? "usługi" : "produkty";

  const previewRef = useRef(onThumbnailPreview);
  previewRef.current = onThumbnailPreview;

  useEffect(() => {
    if (!open) return;
    setStep(isService ? 2 : 1);
    setName("");
    setThumb(undefined);
    setBrandId(defaultBrandId ?? "");
    previewRef.current?.(undefined);
  }, [open, isService, defaultBrandId]);

  if (!open) return null;

  const reset = () => {
    setStep(isService ? 2 : 1);
    setName("");
    setThumb(undefined);
    setBrandId("");
    onThumbnailPreview?.(undefined);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      thumbnail: thumb,
      brandId: brandId || undefined,
    });
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={close}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-surface-elevated border border-border shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <span className="text-xs text-muted-foreground">
            {isService ? "Nowa usługa" : `Krok ${step} / 2`}
          </span>
          <button
            type="button"
            onClick={close}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border hover:bg-muted"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 1 && !isService ? (
          <div className="px-6 pb-6 pt-3">
            <h2 className="text-2xl font-semibold tracking-tight">Wybierz mocne główne zdjęcie {itemLabel}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              To jedno zdjęcie agent użyje wszędzie — w reklamach, grafikach i copy. Słabe zdjęcie tutaj = słabe reklamy wszędzie.
            </p>

            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium mb-2">Tak powinno wyglądać dobre zdjęcie</p>
                <div className="relative rounded-xl overflow-hidden border border-border aspect-square bg-gradient-to-br from-emerald-50 to-stone-100">
                  <span className="absolute top-2 left-2 h-7 w-7 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shadow">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="h-2/3 w-1/3 rounded-full bg-white shadow-lg" />
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {["Czyste tło", `Tylko Twój ${itemLabelCap}`, "Jasne i ostre", "Wysoka jakość"].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500" /> {t}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Unikaj takich zdjęć</p>
                <div className="relative rounded-xl overflow-hidden border border-border aspect-square bg-gradient-to-br from-red-50 to-stone-200">
                  <span className="absolute top-2 left-2 h-7 w-7 rounded-full bg-red-500 text-white inline-flex items-center justify-center shadow">
                    <XCircle className="h-4 w-4" />
                  </span>
                  <div className="h-full w-full flex items-center justify-center gap-2 opacity-70">
                    <div className="h-1/2 w-1/5 rounded-full bg-white/80" />
                    <div className="h-2/5 w-1/5 rounded-full bg-stone-300" />
                    <div className="h-1/3 w-1/5 rounded-full bg-stone-400" />
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {[
                    "Zagracone tło",
                    `Inne ${itemLabelPlural} lub loga`,
                    "Ciemne lub rozmyte",
                    `Trudno dostrzec ${itemLabelCap}`,
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setStep(2)} className="text-sm text-muted-foreground hover:text-foreground">
                Pomiń
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90"
              >
                Dalej <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 pb-6 pt-3">
            <h2 className="text-2xl font-semibold tracking-tight">Dodaj {isService ? "usługę" : "swój produkt"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isService
                ? "Nadaj nazwę usługi. Marka jest opcjonalna — możesz przypisać ją teraz lub później."
                : "Nadaj nazwę i opcjonalnie wgraj zdjęcie. Markę możesz dodać od razu albo później."}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium">Nazwa {label}</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isService ? "np. Konsultacja marketingowa" : "np. Serum nawilżające"}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Marka (opcjonalnie)</label>
                {lockBrand && defaultBrandId ? (
                  <p className="mt-1.5 text-sm font-medium text-foreground">
                    {brands.find((b) => b.id === defaultBrandId)?.name ?? "Marka"}
                  </p>
                ) : (
                  <>
                    <select
                      value={brandId}
                      onChange={(e) => setBrandId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                    >
                      <option value="">— Bez marki —</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                          {b.aiContext ? " ✓ AI" : ""}
                        </option>
                      ))}
                    </select>
                    {brands.length === 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Nie masz jeszcze marek — możesz utworzyć {label} bez marki albo{" "}
                        <Link to="/products/brands" onClick={close} className="text-accent font-medium hover:underline">
                          dodać markę
                        </Link>
                        .
                      </p>
                    )}
                  </>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Z marką agent korzysta z kontekstu AI i tożsamości wizualnej. Bez marki działa na samym opisie
                  {isService ? " usługi" : " produktu"}.
                </p>
              </div>

              {!isService && (
                <ProductImagePicker
                  label="Główne zdjęcie"
                  value={thumb}
                  onChange={(url) => {
                    setThumb(url);
                    onThumbnailPreview?.(url);
                  }}
                  onClear={() => {
                    setThumb(undefined);
                    onThumbnailPreview?.(undefined);
                  }}
                  variant="square"
                />
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              {!isService ? (
                <button type="button" onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground">
                  Poprzedni krok
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!name.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Utwórz {label}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
