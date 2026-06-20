import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toPng, toJpeg } from "html-to-image";
import { Loader2, Sparkles, Download, ImageDown, RefreshCw, Save, Wand2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { AssetsTabs } from "@/components/AssetsTabs";
import { AdCanvas } from "@/components/adComposer/AdCanvas";
import { useProducts } from "@/hooks/useProducts";
import { useCreditsUpgrade } from "@/contexts/CreditsUpgradeContext";
import { saveImageToProjectAssets } from "@/lib/saveProjectAsset";
import { generateAdBackground, generateAdCreative } from "@/lib/adComposer/generate";
import {
  type AdCreative,
  type AdFormat,
  type CreativeType,
  CREATIVE_TEMPLATES,
  FORMAT_DIMENSIONS,
} from "@/lib/adComposer/types";

export const Route = createFileRoute("/assets/ad-studio")({
  head: () => ({ meta: [{ title: "Studio reklam — MarketingNow" }] }),
  component: AdStudioPage,
});

const FORMATS: { value: AdFormat; label: string }[] = [
  { value: "9:16", label: "9:16 (Stories / Reels)" },
  { value: "4:5", label: "4:5 (Feed pionowy)" },
  { value: "1:1", label: "1:1 (Kwadrat)" },
  { value: "16:9", label: "16:9 (Baner)" },
];

function fieldClass() {
  return "w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-foreground/40";
}

function AdStudioPage() {
  const { active: brandProduct } = useProducts();
  const { openCreditsUpgrade } = useCreditsUpgrade();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [brief, setBrief] = useState("");
  const [creativeType, setCreativeType] = useState<CreativeType>("phone-chat");
  const [format, setFormat] = useState<AdFormat>("9:16");
  const [creative, setCreative] = useState<AdCreative | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [bgLoading, setBgLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  const busy = copyLoading || bgLoading;

  function handleTypeChange(t: CreativeType) {
    setCreativeType(t);
    const tpl = CREATIVE_TEMPLATES.find((x) => x.type === t);
    if (tpl) setFormat(tpl.defaultFormat);
  }

  async function handleGenerate() {
    if (!brief.trim() || busy) return;
    setCopyLoading(true);
    setCreative(null);
    const res = await generateAdCreative({
      brief: brief.trim(),
      creativeType,
      format,
      brandName: brandProduct?.name ?? "",
      brandRules: brandProduct?.brandVisualRules ?? "",
    });
    setCopyLoading(false);
    if ("error" in res) {
      if (res.error.toLowerCase().includes("kredyt")) openCreditsUpgrade(res.error);
      toast.error(res.error);
      return;
    }
    const newCreative = res.creative;
    setCreative(newCreative);
    toast.success("Treść i układ gotowe — generuję tło bez napisów…");
    await generateBackground(newCreative);
  }

  async function generateBackground(target: AdCreative) {
    setBgLoading(true);
    const bg = await generateAdBackground(target.visual_prompt, target.format);
    setBgLoading(false);
    if ("error" in bg) {
      if (bg.error.toLowerCase().includes("kredyt")) openCreditsUpgrade(bg.error);
      toast.error(bg.error);
      return;
    }
    setCreative((c) => (c ? { ...c, backgroundUrl: bg.dataUrl } : c));
    toast.success("Tło gotowe. Tekst renderowany jako prawdziwa typografia.");
  }

  function patchCopy(key: keyof AdCreative["copy"], value: string) {
    setCreative((c) => (c ? { ...c, copy: { ...c.copy, [key]: value } } : c));
  }
  function patchList(key: "side_badges" | "features", value: string) {
    const arr = value.split("\n").map((s) => s.trim()).filter(Boolean);
    setCreative((c) => (c ? { ...c, copy: { ...c.copy, [key]: arr } } : c));
  }
  function patchStyle(key: keyof AdCreative["style"], value: string | boolean) {
    setCreative((c) => (c ? { ...c, style: { ...c.style, [key]: value } } : c));
  }

  async function exportImage(kind: "png" | "jpg") {
    if (!canvasRef.current || !creative) return;
    setExporting(true);
    try {
      const opts = { pixelRatio: 2, cacheBust: true } as const;
      const dataUrl = kind === "png" ? await toPng(canvasRef.current, opts) : await toJpeg(canvasRef.current, { ...opts, quality: 0.95 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `reklama-${creative.creative_type}-${Date.now()}.${kind}`;
      a.click();
      toast.success(`Wyeksportowano ${kind.toUpperCase()}.`);
    } catch (e) {
      console.error(e);
      toast.error("Nie udało się wyeksportować grafiki.");
    } finally {
      setExporting(false);
    }
  }

  async function saveToAssets() {
    if (!canvasRef.current || !creative) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(canvasRef.current, { pixelRatio: 2, cacheBust: true });
      const res = await saveImageToProjectAssets({
        imageUrl: dataUrl,
        prompt: `${creative.copy.headline || creative.copy.brand_name || "Reklama"} — ${creative.creative_type}`,
        size: `${FORMAT_DIMENSIONS[creative.format].w}x${FORMAT_DIMENSIONS[creative.format].h}`,
        productName: brandProduct?.name ?? null,
      });
      if (res.id) toast.success("Zapisano w Zasobach (Obrazy).");
      else toast.error(res.error ?? "Nie udało się zapisać do Zasobów.");
    } catch (e) {
      console.error(e);
      toast.error("Nie udało się zapisać do Zasobów.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Studio reklam warstwowych</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          AI wymyśla tekst i układ, generator obrazu tworzy tylko tło i mockup (bez napisów), a aplikacja renderuje
          czytelne teksty jako prawdziwe warstwy typografii. Koniec z Lorem Ipsum i pokręconymi literami.
        </p>
        <AssetsTabs />
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Lewa kolumna — generator + edytor */}
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-soft">
            <label className="text-xs font-medium text-muted-foreground">Typ kreacji</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-1">
              {CREATIVE_TEMPLATES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => handleTypeChange(t.type)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    creativeType === t.type
                      ? "border-foreground/40 bg-foreground/5"
                      : "border-border hover:border-foreground/20"
                  }`}
                >
                  <div className="text-sm font-medium text-foreground">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </button>
              ))}
            </div>

            <label className="mt-4 block text-xs font-medium text-muted-foreground">Format</label>
            <select className={`${fieldClass()} mt-1`} value={format} onChange={(e) => setFormat(e.target.value as AdFormat)}>
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            <label className="mt-4 block text-xs font-medium text-muted-foreground">Brief reklamy</label>
            <textarea
              className={`${fieldClass()} mt-1 min-h-[90px] resize-y`}
              placeholder="Np. Reklama MarketingNow — panel AI do widoczności marki, polecany przez ekspertów."
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />

            <button
              onClick={handleGenerate}
              disabled={!brief.trim() || busy}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {copyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {copyLoading ? "Tworzę treść…" : "Wygeneruj reklamę"}
            </button>
          </section>

          {creative && (
            <section className="space-y-3 rounded-2xl border border-border bg-surface-elevated p-5 shadow-soft">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Wand2 className="h-4 w-4" /> Edytor warstw
              </div>
              <EditField label="Nagłówek" value={creative.copy.headline} onChange={(v) => patchCopy("headline", v)} />
              <EditField label="Podtytuł" value={creative.copy.subheadline} onChange={(v) => patchCopy("subheadline", v)} />
              <EditField label="Wiadomość użytkownika (dymek)" value={creative.copy.user_message} onChange={(v) => patchCopy("user_message", v)} />
              <EditArea label="Odpowiedź AI (dymek)" value={creative.copy.ai_response} onChange={(v) => patchCopy("ai_response", v)} />
              <EditField label="Nazwa marki" value={creative.copy.brand_name} onChange={(v) => patchCopy("brand_name", v)} />
              <EditArea label="Boczne badge (po jednym w wierszu)" value={creative.copy.side_badges.join("\n")} onChange={(v) => patchList("side_badges", v)} />
              <EditArea label="Funkcje / korzyści z ✓ (po jednym w wierszu)" value={creative.copy.features.join("\n")} onChange={(v) => patchList("features", v)} />
              <div className="grid grid-cols-2 gap-3">
                <EditField label="CTA" value={creative.copy.cta} onChange={(v) => patchCopy("cta", v)} />
                <EditField label="Cena / promocja" value={creative.copy.price} onChange={(v) => patchCopy("price", v)} />
              </div>
              <EditField label="Slogan" value={creative.copy.slogan} onChange={(v) => patchCopy("slogan", v)} />
              <EditField label="Disclaimer" value={creative.copy.disclaimer} onChange={(v) => patchCopy("disclaimer", v)} />

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Kolor akcentu</label>
                  <input type="color" className="mt-1 h-9 w-full rounded-lg border border-border bg-surface-elevated" value={creative.style.accent} onChange={(e) => patchStyle("accent", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Pozycja telefonu</label>
                  <select className={`${fieldClass()} mt-1`} value={creative.style.phonePosition} onChange={(e) => patchStyle("phonePosition", e.target.value)}>
                    <option value="center">Środek</option>
                    <option value="center-left">Lewa</option>
                    <option value="center-right">Prawa</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tło od</label>
                  <input type="color" className="mt-1 h-9 w-full rounded-lg border border-border bg-surface-elevated" value={creative.style.bgFrom} onChange={(e) => patchStyle("bgFrom", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tło do</label>
                  <input type="color" className="mt-1 h-9 w-full rounded-lg border border-border bg-surface-elevated" value={creative.style.bgTo} onChange={(e) => patchStyle("bgTo", e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1 text-sm text-foreground">
                <input type="checkbox" checked={creative.style.glow} onChange={(e) => patchStyle("glow", e.target.checked)} />
                Efekt glow / poświata
              </label>
            </section>
          )}
        </div>

        {/* Prawa kolumna — podgląd + akcje */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface-sunken p-5 shadow-soft">
            <div className="flex min-h-[420px] items-center justify-center">
              {creative ? (
                <div className="relative">
                  <AdCanvas ref={canvasRef} creative={creative} />
                  {bgLoading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-[20px] bg-background/40 backdrop-blur-[1px]">
                      <span className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs text-foreground shadow-soft">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generuję tło bez napisów…
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-xs text-center text-sm text-muted-foreground">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 opacity-40" />
                  Wybierz typ kreacji, wpisz brief i kliknij „Wygeneruj reklamę”. Podgląd pojawi się tutaj jako
                  składanie warstw.
                </div>
              )}
            </div>
          </div>

          {creative && (
            <>
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                Tekst na tej reklamie to prawdziwa typografia renderowana przez aplikację — nie napisy z modelu obrazu.
                Możesz edytować każdą warstwę po lewej.
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => generateBackground(creative)} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:border-foreground/30 disabled:opacity-50">
                  {bgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Nowe tło
                </button>
                <button onClick={() => exportImage("png")} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:border-foreground/30 disabled:opacity-50">
                  <ImageDown className="h-4 w-4" /> PNG
                </button>
                <button onClick={() => exportImage("jpg")} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:border-foreground/30 disabled:opacity-50">
                  <Download className="h-4 w-4" /> JPG
                </button>
                <button onClick={saveToAssets} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Zapisz do Zasobów
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input className={`${fieldClass()} mt-1`} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function EditArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <textarea className={`${fieldClass()} mt-1 min-h-[60px] resize-y`} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}