import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, Sparkles, RefreshCw, Palette } from "lucide-react";
import { toast } from "sonner";
import { useBrands } from "@/hooks/useBrands";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuthSession } from "@/hooks/useAuthSession";
import { runCompetitorScan } from "@/lib/competitorScan.functions";
import { mapCompetitorScanToBrandContext } from "@/lib/brandScan";
import {
  readScopedJson,
  writeScopedJson,
  getScopedUserId,
} from "@/lib/userScopedStorage";

const SKIP_KEY = "brandOnboarding.skipped.v1";
const DEFAULT_COLORS = ["#0A0A0A", "#FFFFFF", "#16A34A", "#2563EB"];

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v.trim());
}

/** Popup po pierwszym logowaniu: uzupełnij dane marki (skan strony + kolory). */
export function BrandOnboardingModal() {
  const { isAuthenticated, loading: authLoading, user } = useAuthSession();
  const { activeWorkspaceId } = useWorkspace();
  const { brands, create, update } = useBrands(activeWorkspaceId);
  const competitorScanFn = useServerFn(runCompetitorScan);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanHint, setScanHint] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) {
      setOpen(false);
      return;
    }
    if (brands.length > 0) {
      setOpen(false);
      return;
    }
    const skipped = readScopedJson<boolean>(SKIP_KEY, false);
    if (skipped) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [authLoading, isAuthenticated, user?.id, brands.length, getScopedUserId()]);

  if (!open) return null;

  const setColorAt = (idx: number, value: string) => {
    const next = [...colors];
    next[idx] = value;
    setColors(next);
  };

  const runScan = async () => {
    const url = normalizeUrl(websiteUrl);
    if (!url) {
      toast.error("Podaj adres strony WWW, żeby zeskanować markę.");
      return;
    }
    setWebsiteUrl(url);
    setScanning(true);
    setScanHint(null);
    try {
      const result = await competitorScanFn({
        data: { url, focusAreas: ["copy", "landing", "seo"] },
      });
      const mapped = mapCompetitorScanToBrandContext(url, result);
      if (!mapped.ok) {
        toast.error(mapped.error);
        return;
      }
      const ctx = mapped.context;
      const guessedName =
        (result.ok ? (result.data as { brandGuess?: string; title?: string }).brandGuess : undefined) ||
        ctx.valueProposition ||
        ctx.pageTitle;
      if (guessedName?.trim() && !name.trim()) {
        setName(guessedName.trim().slice(0, 80));
      }
      setScanHint(ctx.summary.slice(0, 280) + (ctx.summary.length > 280 ? "…" : ""));
      // Zachowaj kontekst w stanie tymczasowym przez dataset na oknie — zapisujemy przy submit
      (window as unknown as { __mnBrandScanCtx?: typeof ctx }).__mnBrandScanCtx = ctx;
      toast.success("Strona zeskanowana — dane uzupełnione automatycznie. Sprawdź i zapisz.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się zeskanować strony.");
    } finally {
      setScanning(false);
    }
  };

  const skip = () => {
    writeScopedJson(SKIP_KEY, true);
    setOpen(false);
    toast.message("Możesz uzupełnić markę później w zakładce Marki.");
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Podaj nazwę marki.");
      return;
    }
    setSaving(true);
    try {
      const url = normalizeUrl(websiteUrl);
      const brand = create(name.trim(), {
        websiteUrl: url || undefined,
        workspaceId: activeWorkspaceId ?? undefined,
      });
      const cleanColors = colors.map((c) => c.trim()).filter(isValidHex);
      const scanCtx = (window as unknown as { __mnBrandScanCtx?: import("@/hooks/useBrands").BrandAiContext })
        .__mnBrandScanCtx;

      update(brand.id, {
        ...(cleanColors.length ? { brandColors: cleanColors } : {}),
        ...(scanCtx ? { aiContext: scanCtx } : {}),
      });

      // Jeśli jest URL, a jeszcze nie skanowano — skan w tle przy zapisie
      if (url && !scanCtx) {
        try {
          const result = await competitorScanFn({
            data: { url, focusAreas: ["copy", "landing", "seo"] },
          });
          const mapped = mapCompetitorScanToBrandContext(url, result);
          if (mapped.ok) {
            update(brand.id, { aiContext: mapped.context });
          }
        } catch {
          // nie blokuj zapisu marki
        }
      }

      writeScopedJson(SKIP_KEY, true);
      delete (window as unknown as { __mnBrandScanCtx?: unknown }).__mnBrandScanCtx;
      setOpen(false);
      toast.success("Marka zapisana — DNA Twojej firmy jest w workspace.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-onboarding-title"
        className="relative w-full max-w-lg max-h-[min(92vh,100dvh)] overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-elevated pb-[env(safe-area-inset-bottom)]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Pierwszy krok
            </p>
            <h2 id="brand-onboarding-title" className="mt-1 text-xl font-semibold tracking-tight">
              Uzupełnij dane swojej marki
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              Zapisujemy to jako Twój brand. Skanujemy stronę i uzupełniamy kontekst automatycznie — możesz
              też od razu podać kolory.
            </p>
          </div>
          <button
            type="button"
            onClick={skip}
            className="shrink-0 rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Później"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="text-sm font-medium">Nazwa marki</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Moja Firma"
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Strona WWW</label>
            <div className="mt-1.5 flex gap-2">
              <input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://twoja-firma.pl"
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="button"
                onClick={() => void runScan()}
                disabled={scanning || !websiteUrl.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {scanning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Skanuj
              </button>
            </div>
            {scanHint && (
              <p className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200">
                Podgląd ze skanu: {scanHint}
              </p>
            )}
          </div>

          <div>
            <label className="inline-flex items-center gap-1.5 text-sm font-medium">
              <Palette className="h-3.5 w-3.5" /> Kolory marki
            </label>
            <p className="mt-1 text-xs text-muted-foreground">
              Startowo uzupełnione przykładową paletą — zmień na kolory swojej marki (hex).
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {colors.map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-border px-2.5 py-2">
                  <input
                    type="color"
                    value={isValidHex(c) ? c : "#000000"}
                    onChange={(e) => setColorAt(i, e.target.value.toUpperCase())}
                    className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label={`Kolor ${i + 1}`}
                  />
                  <input
                    value={c}
                    onChange={(e) => setColorAt(i, e.target.value)}
                    className="flex-1 bg-transparent text-sm font-mono outline-none"
                    placeholder="#000000"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-background/95 px-5 py-4 backdrop-blur">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !name.trim()}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
          >
            {saving ? "Zapisywanie…" : "Zapisz markę"}
          </button>
          <button
            type="button"
            onClick={skip}
            className="rounded-full border border-border px-4 py-2.5 text-sm hover:bg-muted"
          >
            Później
          </button>
        </div>
      </div>
    </div>
  );
}
