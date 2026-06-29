import { useState } from "react";
import { X, Check, XCircle, ArrowRight } from "lucide-react";
import { ProductImagePicker } from "@/components/ProductImagePicker";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; thumbnail?: string }) => void;
  /** Podgląd miniatury w nagłówku (np. przy „Nowy produkt”) zanim produkt zostanie utworzony */
  onThumbnailPreview?: (dataUrl: string | undefined) => void;
};

export function NewProductModal({ open, onClose, onCreate, onThumbnailPreview }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [thumb, setThumb] = useState<string | undefined>();

  if (!open) return null;

  const reset = () => {
    setStep(1);
    setName("");
    setThumb(undefined);
    onThumbnailPreview?.(undefined);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), thumbnail: thumb });
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={close}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-surface-elevated border border-border shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <span className="text-xs text-muted-foreground">Krok {step} / 2</span>
          <button
            type="button"
            onClick={close}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border hover:bg-muted"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="px-6 pb-6 pt-3">
            <h2 className="text-2xl font-semibold tracking-tight">Wybierz mocne główne zdjęcie produktu</h2>
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
                  {["Czyste tło", "Tylko Twój produkt", "Jasne i ostre", "Wysoka jakość"].map((t) => (
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
                  {["Zagracone tło", "Inne produkty lub loga", "Ciemne lub rozmyte", "Trudno dostrzec produkt"].map((t) => (
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
            <h2 className="text-2xl font-semibold tracking-tight">Dodaj swój produkt</h2>
            <p className="mt-2 text-sm text-muted-foreground">Nadaj nazwę i wgraj główne zdjęcie — pojawi się na karcie produktu.</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-medium">Nazwa produktu</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="np. Serum nawilżające"
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface-elevated px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>

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
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground">
                Poprzedni krok
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!name.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Utwórz produkt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
