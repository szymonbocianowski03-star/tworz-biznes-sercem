import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { sfx } from "@/lib/sounds";
import { GoogleAdsBrand } from "@/components/landing/BrandMarks";

function LiveBadge({ label = "NOW LIVE", shortLabel }: { label?: string; shortLabel?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.1em] sm:tracking-[0.14em] text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.25)]">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
      </span>
      <span className="truncate">
        <span className="sm:hidden">{shortLabel ?? label}</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
    </span>
  );
}

function Stat({
  value,
  label,
  large,
}: {
  value: string;
  label: string;
  large?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p
        className={`font-semibold tracking-tight text-white tabular-nums ${
          large
            ? "text-[clamp(2rem,11vw,2.75rem)] leading-none"
            : "text-[clamp(1.25rem,6vw,1.85rem)] leading-tight"
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[12px] sm:text-[13px] leading-snug text-white/55">{label}</p>
    </div>
  );
}

const TEASER_STATS = [
  { value: "+180%", label: "wyższy współczynnik interakcji" },
  { value: "−68%", label: "średni koszt" },
] as const;

const BEFORE = [
  { value: "3,46%", label: "współczynnik interakcji" },
  { value: "0,22 zł", label: "średni koszt" },
  { value: "8 990", label: "kliknięć" },
  { value: "319 753", label: "wyświetlenia" },
  { value: "2 483,68 zł", label: "całkowity koszt" },
] as const;

const AFTER = [
  { value: "9,68%", label: "współczynnik interakcji" },
  { value: "0,07 zł", label: "średni koszt" },
  { value: "10 946", label: "kliknięć" },
  { value: "156 466", label: "wyświetlenia" },
  { value: "1 117,49 zł", label: "całkowity koszt" },
] as const;

const FLOW = ["POMYSŁ", "AI", "KAMPANIA", "GOOGLE ADS", "ANALIZA", "OPTYMALIZACJA"] as const;

function MetricRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-white/5 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <span className={`text-[12px] sm:text-[13px] ${emphasize ? "text-white/55" : "text-white/50"}`}>{label}</span>
      <span
        className={`text-[16px] sm:text-[17px] font-semibold tabular-nums ${
          emphasize ? "text-white" : "text-white/90"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function CaseStudyPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        aria-label="Zamknij case study"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      <div className="relative z-[1] flex max-h-[min(92vh,100dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.75)] animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#0c0c0e]/95 px-4 py-3.5 sm:px-5 sm:py-4 md:px-8 md:py-5 backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Case study</p>
            <h3 id={titleId} className="mt-1 serif text-[clamp(1.15rem,5vw,1.75rem)] tracking-tight text-white leading-tight">
              Google Ads × MarketingNow
            </h3>
            <span className="mt-2 inline-flex rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Real campaign data
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-white/15 bg-white/5 p-2.5 text-white/80 hover:bg-white/10 hover:text-white transition touch-manipulation"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 py-5 sm:px-5 sm:py-6 md:px-8 md:py-8 space-y-8 sm:space-y-10 md:space-y-12 [-webkit-overflow-scrolling:touch]">
          <div>
            <h4 className="serif text-[clamp(1.3rem,5.5vw,2.15rem)] leading-[1.15] tracking-[-0.02em] text-white text-balance">
              Prawie 3× wyższy współczynnik interakcji.
              <span className="block mt-1 text-emerald-300/95">68% niższy średni koszt.</span>
            </h4>
            <p className="mt-3 sm:mt-4 text-[14px] sm:text-[15px] leading-relaxed text-white/65 max-w-2xl">
              Nowa kampania osiągnęła 10 946 kliknięć mimo krótszego czasu działania.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40 mb-3 sm:mb-4">Before vs after</p>
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 md:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Przed MarketingNow</p>
                <div className="mt-4 sm:mt-5 space-y-3 sm:space-y-4">
                  {BEFORE.map((s) => (
                    <MetricRow key={s.label} label={s.label} value={s.value} />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4 sm:p-5 md:p-6 shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300/90">Po wdrożeniu MarketingNow</p>
                <div className="mt-4 sm:mt-5 space-y-3 sm:space-y-4">
                  {AFTER.map((s) => (
                    <MetricRow key={s.label} label={s.label} value={s.value} emphasize />
                  ))}
                </div>
                <p className="mt-4 sm:mt-5 text-[12px] leading-relaxed text-emerald-100/70">
                  Nowa kampania działała krócej — porównujemy przede wszystkim skuteczność (CTR / koszt / kliknięcia), nie sam wolumen wyświetleń.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent px-4 py-6 sm:px-5 sm:py-7 md:px-8 md:py-9">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8 text-left">
              <Stat value="+180%" label="wyższy współczynnik interakcji" large />
              <Stat value="−68%" label="średni koszt" large />
              <Stat value="10 946" label="kliknięć" large />
            </div>
            <p className="mt-5 sm:mt-6 text-[13px] text-white/55">
              Więcej kliknięć w krótszym okresie działania.
            </p>
            <p className="mt-2 text-[12px] text-white/35">
              Poprzednie wyniki nie gwarantują przyszłych.
            </p>
          </div>

          <div>
            <h4 className="serif text-[clamp(1.25rem,5vw,1.85rem)] tracking-tight text-white">Co zmieniło MarketingNow?</h4>
            <p className="mt-3 text-[14px] sm:text-[15px] leading-relaxed text-white/65 max-w-2xl">
              MarketingNow łączy przygotowanie kampanii, AI, publikację, analizę i optymalizację w jednym workspace.
            </p>
            <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-1.5 sm:gap-2">
              {FLOW.map((step, i) => (
                <div key={step} className="flex items-center gap-1.5 sm:gap-2">
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold tracking-[0.1em] text-white/85">
                    {step}
                  </span>
                  {i < FLOW.length - 1 && (
                    <span className="text-white/30 text-xs sm:text-sm" aria-hidden>
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 sm:p-5 md:p-7 space-y-4 sm:space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <GoogleAdsBrand invert />
              <LiveBadge label="NOW LIVE" shortLabel="LIVE" />
            </div>
            <p className="text-[14px] leading-relaxed text-white/65">
              Uruchamiaj kampanie Google Ads bezpośrednio z MarketingNow.
            </p>
          </div>

          <div className="border-t border-white/10 pt-6 sm:pt-8 pb-4 sm:pb-2 text-center">
            <h4 className="serif text-[clamp(1.35rem,5.5vw,2.1rem)] tracking-tight text-white text-balance">
              Teraz czas na Twoją kampanię.
            </h4>
            <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
              <Link
                to="/auth"
                onClick={() => sfx.success()}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-sm bg-white px-6 py-3.5 text-[12px] md:text-[13px] font-bold uppercase tracking-[0.12em] text-neutral-950 hover:bg-neutral-100 transition-colors touch-manipulation"
              >
                Uruchom Google Ads
              </Link>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  document.getElementById("co-obslugujesz")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-sm border border-white/25 px-6 py-3.5 text-[12px] md:text-[13px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-white/5 transition-colors touch-manipulation"
              >
                Zobacz MarketingNow
              </button>
            </div>
            <p className="mt-4 text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-white/40">
              Google Ads integration — LIVE
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Teaser Google Ads LIVE + case study (landing). */
export function GoogleAdsLiveSection() {
  const [caseOpen, setCaseOpen] = useState(false);

  return (
    <section
      id="google-ads"
      className="relative scroll-mt-24 sm:scroll-mt-28 border-b border-neutral-900 bg-[#09090b] text-white overflow-hidden"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(16,185,129,0.14), transparent 55%), radial-gradient(ellipse 40% 40% at 90% 60%, rgba(66,133,244,0.08), transparent 50%)",
        }}
      />

      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-28">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-white/10 bg-white px-3 py-2.5 sm:px-3.5 sm:py-3 shadow-sm">
            <GoogleAdsBrand />
          </div>
          <LiveBadge label="NOW LIVE" shortLabel="LIVE" />
        </div>

        <h2 className="mt-6 sm:mt-7 md:mt-8 serif text-[clamp(1.65rem,7.5vw,3.5rem)] leading-[1.08] tracking-[-0.03em] text-balance max-w-4xl">
          Zobacz, jak uporządkowaliśmy kampanię reklamową
        </h2>
        <p className="mt-4 sm:mt-5 max-w-2xl text-[15px] sm:text-[16px] md:text-[18px] leading-[1.55] text-white/65">
          Nowa kampania została przygotowana z wykorzystaniem MarketingNow i uruchomiona w Google Ads.
          Porównaj sposób działania oraz dostępne wyniki.
        </p>

        <div className="mt-8 sm:mt-12 md:mt-14 space-y-6 sm:space-y-8 max-w-xl">
          {TEASER_STATS.map((s) => (
            <Stat key={s.label} value={s.value} label={s.label} large />
          ))}
        </div>
        <p className="mt-5 sm:mt-6 text-[12px] sm:text-[13px] text-white/45 max-w-xl leading-relaxed">
          Wynik kampanii uruchomionej po wdrożeniu MarketingNow.
          <span className="block mt-1.5 text-white/35">
            Poprzednie wyniki nie gwarantują przyszłych.
          </span>
        </p>

        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3">
          <Link
            to="/auth"
            onClick={() => sfx.success()}
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-sm bg-white px-6 py-3.5 text-[12px] md:text-[13px] font-bold uppercase tracking-[0.12em] text-neutral-950 hover:bg-neutral-100 transition-colors text-center touch-manipulation"
          >
            Uruchom Google Ads
          </Link>
          <button
            type="button"
            onClick={() => {
              sfx.chime();
              setCaseOpen(true);
            }}
            className="inline-flex w-full sm:w-auto items-center justify-center rounded-sm border border-white/25 px-6 py-3.5 text-[12px] md:text-[13px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-white/5 transition-colors touch-manipulation"
          >
            Zobacz case study
          </button>
        </div>
      </div>

      <CaseStudyPanel open={caseOpen} onClose={() => setCaseOpen(false)} />
    </section>
  );
}
