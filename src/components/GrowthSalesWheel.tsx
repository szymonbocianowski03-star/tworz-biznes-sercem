import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { sfx } from "@/lib/sounds";

const SLICE = 360 / 9;
const N = 9;
const WHEEL_CX = 100;
const WHEEL_CY = 100;
const WHEEL_R_OUTER = 92;
/** Mniejsza „dziura” = więcej miejsca na pierścień etykiet względem środka */
const WHEEL_R_INNER = 46;
/** Etykiety ~76–80% promienia zewnętrznego (viewBox) — dalej od przycisku, czytelny pierścień */
const LABEL_RADIUS_RATIO = 0.78;
/** ~2.6–2.8 s — naturalne hamowanie */
const SPIN_MS = 2700;
const SPIN_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const VIEWBOX = 200;

/**
 * Środek wycinka: `angleDeg = -90 + index * segmentAngle + segmentAngle / 2` (segmentAngle = 360/N).
 */
function segmentMidDeg(i: number): number {
  return -90 + SLICE / 2 + i * SLICE;
}

/** Maks. szerokość etykiety (% boku koła), ograniczona cięciwą — nie wychodzi poza wycinek; dopełnienie `min(90px, …)` w JSX. */
function wheelLabelMaxWidthPct(): number {
  const r = WHEEL_R_OUTER * LABEL_RADIUS_RATIO;
  const chordVb = 2 * r * Math.sin(((SLICE / 2) * Math.PI) / 180);
  return Math.min(28, (chordVb / VIEWBOX) * 100 * 0.88);
}

/**
 * Środek etykiety w % kontenera — tylko biegunowe współrzędne.
 * `wheelRotationDeg`: warstwa etykiet jest poza obracającym się SVG, więc kąt = środek wycinka + obrót koła.
 */
function segmentLabelPositionPercent(
  i: number,
  wheelRotationDeg: number,
): { leftPct: number; topPct: number } {
  const angleDeg = segmentMidDeg(i) + wheelRotationDeg;
  const angleRad = (angleDeg * Math.PI) / 180;
  const labelRadius = WHEEL_R_OUTER * LABEL_RADIUS_RATIO;
  const x = WHEEL_CX + Math.cos(angleRad) * labelRadius;
  const y = WHEEL_CY + Math.sin(angleRad) * labelRadius;
  return { leftPct: (x / VIEWBOX) * 100, topPct: (y / VIEWBOX) * 100 };
}

function alignRotationForSegmentIndex(i: number): number {
  const mid = segmentMidDeg(i);
  const R = -90 - mid;
  return ((R % 360) + 360) % 360;
}

export type GrowthSegment = {
  id: string;
  /** Etykiety na kole (uppercase), max dwie linie — druga może być pusta */
  perimeterLines: [string, string];
  title: string;
  description: string;
  businessEffect: string;
};

/** Kolejność i=0 od góry (wskaźnik): META … GOOGLE + „I wiele więcej” (9 równych segmentów) */
export const GROWTH_SEGMENTS: GrowthSegment[] = [
  {
    id: "meta",
    perimeterLines: ["META", "ADS"],
    title: "Meta Ads",
    description:
      "MarketingNow analizuje kampanie, kreacje i grupy odbiorców, a następnie pomaga tworzyć lepsze reklamy, testować warianty i szybciej skalować te zestawy, które dowożą realne wyniki.",
    businessEffect: "Więcej leadów przy niższym koszcie pozyskania.",
  },
  {
    id: "linkedin",
    perimeterLines: ["LINKEDIN", "ADS"],
    title: "LinkedIn Ads",
    description:
      "Platforma wspiera kampanie B2B: propozycje komunikatów pod decydentów, strukturę grup i kreacje spójne z pozycjonowaniem eksperckim marki.",
    businessEffect: "Wyższa jakość leadów i krótsza ścieżka od reklamy do rozmowy handlowej.",
  },
  {
    id: "shorts",
    perimeterLines: ["VIRALE", ""],
    title: "Virale",
    description:
      "Hooki, szkielety i dopasowanie formatu pod Reels, Shorts, TikTok i inne krótkie formy — żeby publikować szybciej i uczyć się z danych, a nie zgadywać.",
    businessEffect: "Częstsze publikacje i więcej sensownych iteracji pod zasięg i konwersję w tym samym oknie czasowym.",
  },
  {
    id: "seo",
    perimeterLines: ["SEO", ""],
    title: "SEO",
    description:
      "MarketingNow łączy intencję wyszukiwania z treścią i technikalia: propozycje podstron, nagłówków, fraz i struktur pod widoczność organiczną.",
    businessEffect: "Trwalszy ruch z wyszukiwarki i niższa zależność wyłącznie od płatnych klików.",
  },
  {
    id: "mailing",
    perimeterLines: ["MAILING", ""],
    title: "Mailing",
    description:
      "Tworzysz sekwencje maili i follow-upy z jasnym CTA — dopasowane do etapu lejka i kontekstu oferty, bez ręcznego przepisywania tych samych schematów.",
    businessEffect: "Więcej uporządkowanych touchpointów z leadami i bazą.",
  },
  {
    id: "calendar",
    perimeterLines: ["KALENDARZ", ""],
    title: "Kalendarz",
    description:
      "Jeden widok harmonogramu publikacji, kampanii i działań follow-up z priorytetami pod sprzedaż — mniej chaosu, więcej trafionych momentów kontaktu.",
    businessEffect: "Przewidywalny rytm marketingu i mniej „zgubionych” okazji do konwersji.",
  },
  {
    id: "llm",
    perimeterLines: ["WIDOCZNOŚĆ", "AI"],
    title: "Widoczność AI",
    description:
      "MarketingNow sprawdza, czy Twoja marka pojawia się w ChatGPT, Gemini, Perplexity i Google AI Overviews. Następnie pokazuje, gdzie konkurencja ma przewagę i generuje konkretne działania, które zwiększają Twoją obecność w nowych kanałach wyszukiwania.",
    businessEffect: "Większa widoczność marki, więcej zapytań i przewaga zanim konkurencja zdąży zareagować.",
  },
  {
    id: "google",
    perimeterLines: ["GOOGLE", "ADS"],
    title: "Google Ads",
    description:
      "MarketingNow pomaga znaleźć frazy, intencje zakupowe i luki w kampaniach. Generuje propozycje reklam, strukturę kampanii oraz rekomendacje optymalizacji budżetu.",
    businessEffect: "Lepsze wykorzystanie budżetu i większy udział w ruchu o wysokiej intencji zakupu.",
  },
  {
    id: "more",
    perimeterLines: ["I WIELE", "WIĘCEJ"],
    title: "I wiele więcej",
    description:
      "Poza tymi kanałami MarketingNow scala strategię, kreacje, analizę, automatyzację maili, kalendarz działań i kolejne integracje w jednym workflow.",
    businessEffect: "Mniej rozproszenia narzędziami, szybsze wdrożenia i większa skala przy tym samym zespole.",
  },
];

/** Delikatne gradienty w granatach — spójne, bez ostrych kontrastów */
const SEGMENT_STOPS: { a: [string, string]; b: [string, string] }[] = [
  { a: ["#161d2e", "#121a28"], b: ["#101622", "#0c101a"] },
  { a: ["#151c2c", "#111924"], b: ["#0f1520", "#0c101a"] },
  { a: ["#141b2b", "#101823"], b: ["#0e1420", "#0b0f18"] },
  { a: ["#161c2d", "#121a26"], b: ["#101621", "#0c101a"] },
  { a: ["#151d2c", "#111924"], b: ["#0f1520", "#0b0f18"] },
  { a: ["#141c2b", "#101823"], b: ["#0e1420", "#0c101a"] },
  { a: ["#161b2e", "#121a25"], b: ["#101621", "#0b0f18"] },
  { a: ["#151c2d", "#111924"], b: ["#0f1520", "#0c101a"] },
  { a: ["#171d2f", "#131b27"], b: ["#111622", "#0d111b"] },
];

function wedgePath(i: number, r: number, cx: number, cy: number): string {
  const start = -90 + i * SLICE;
  const end = -90 + (i + 1) * SLICE;
  const rad0 = (start * Math.PI) / 180;
  const rad1 = (end * Math.PI) / 180;
  const x0 = cx + r * Math.cos(rad0);
  const y0 = cy + r * Math.sin(rad0);
  const x1 = cx + r * Math.cos(rad1);
  const y1 = cy + r * Math.sin(rad1);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`;
}

function computeSpinDelta(prevRotation: number, targetIndex: number): number {
  const turns = 4 + Math.floor(Math.random() * 2);
  const targetMod = alignRotationForSegmentIndex(targetIndex);
  const prevMod = ((prevRotation % 360) + 360) % 360;
  let add = targetMod - prevMod;
  if (add <= 0) add += 360;
  add += 360 * turns;
  return add;
}

function snapRotationToSegment(rotation: number): { snapped: number; index: number } {
  const R = ((rotation % 360) + 360) % 360;
  let bestI = 0;
  let bestAbs = Infinity;
  let bestDelta = 0;
  for (let i = 0; i < N; i++) {
    const targetR = alignRotationForSegmentIndex(i);
    let delta = targetR - R;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const a = Math.abs(delta);
    if (a < bestAbs) {
      bestAbs = a;
      bestI = i;
      bestDelta = delta;
    }
  }
  return { snapped: rotation + bestDelta, index: bestI };
}

function pointerAngleDeg(clientX: number, clientY: number, rect: DOMRect): number {
  const cxPx = rect.left + rect.width / 2;
  const cyPx = rect.top + rect.height / 2;
  return (Math.atan2(clientY - cyPx, clientX - cxPx) * 180) / Math.PI;
}

/** Etykiety: poziomo, Inter / system sans, bez grubego cienia */
const WHEEL_LABEL_BOX_STYLE: CSSProperties = {
  position: "absolute",
  transform: "translate(-50%, -50%)",
  boxSizing: "border-box",
  paddingLeft: 4,
  paddingRight: 4,
  textAlign: "center",
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "rgba(255,255,255,0.86)",
  fontFamily: 'Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif',
  whiteSpace: "normal",
  wordBreak: "normal",
  overflowWrap: "normal",
  hyphens: "none",
  textShadow: "0 0 20px rgba(99,102,241,0.06)",
};

const LLM_SEGMENT_INDEX = GROWTH_SEGMENTS.findIndex((s) => s.id === "llm");

type Props = {
  /** Węższy układ (np. hero): mniejszy padding, koło do ~400px */
  compact?: boolean;
  ctaTo?: "/auth" | "/agent";
  hideWheelCaption?: boolean;
  /** Ukrywa graficzne koło na telefonie — zostawia panel wyników i przycisk „Zakręć ponownie” */
  hideWheelOnMobile?: boolean;
  /** Segment „Widoczność AI”: false = pokaż panel, true = pokaż i przewiń do #how-it-works */
  onLlmSegmentReveal?: (scrollToSection: boolean) => void;
};

export function GrowthSalesWheel({
  compact = false,
  ctaTo = "/auth",
  hideWheelCaption = false,
  hideWheelOnMobile = false,
  onLlmSegmentReveal,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const wheelWrapRef = useRef<HTMLDivElement>(null);
  const dragLastAngleRef = useRef<number | null>(null);
  const capturePointerIdRef = useRef<number | null>(null);
  const spinGenerationRef = useRef(0);

  const spin = useCallback(() => {
    if (spinning || dragging) return;
    const gen = ++spinGenerationRef.current;
    const idx = Math.floor(Math.random() * N);
    setPendingIndex(idx);
    setSpinning(true);
    setRotation((r) => r + computeSpinDelta(r, idx));
    window.setTimeout(() => {
      if (spinGenerationRef.current !== gen) return;
      setRotation((r) => snapRotationToSegment(r).snapped);
      setActiveIndex(idx);
      setSpinning(false);
      setPendingIndex(null);
      sfx.chime();
    }, SPIN_MS);
  }, [spinning, dragging]);

  const endDrag = useCallback(() => {
    if (!dragging) return;
    const el = wheelWrapRef.current;
    const pid = capturePointerIdRef.current;
    if (el && pid != null) {
      try {
        el.releasePointerCapture(pid);
      } catch {
        /* ignore */
      }
    }
    capturePointerIdRef.current = null;
    setDragging(false);
    dragLastAngleRef.current = null;
    setRotation((r) => {
      const { snapped, index } = snapRotationToSegment(r);
      setActiveIndex(index);
      setPendingIndex(null);
      sfx.chime();
      return snapped;
    });
  }, [dragging]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const el = wheelWrapRef.current;
      if (!el || spinning) return;
      const rect = el.getBoundingClientRect();
      const ang = pointerAngleDeg(e.clientX, e.clientY, rect);
      const prev = dragLastAngleRef.current;
      dragLastAngleRef.current = ang;
      if (prev === null) return;
      let delta = ang - prev;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      setRotation((r) => {
        const nr = r + delta;
        const { index } = snapRotationToSegment(nr);
        queueMicrotask(() => setActiveIndex(index));
        return nr;
      });
    };
    const onUp = () => endDrag();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, spinning, endDrag]);

  const onWheelPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (spinning) return;
      const el = wheelWrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cxPx = rect.left + rect.width / 2;
      const cyCenter = rect.top + rect.height / 2;
      const dx = e.clientX - cxPx;
      const dy = e.clientY - cyCenter;
      const dist = Math.hypot(dx, dy);
      const minR = (rect.width * (WHEEL_R_INNER - 2)) / 200;
      const maxR = (rect.width * WHEEL_R_OUTER) / 200;
      if (dist < minR || dist > maxR) return;
      e.preventDefault();
      try {
        el.setPointerCapture(e.pointerId);
        capturePointerIdRef.current = e.pointerId;
      } catch {
        capturePointerIdRef.current = null;
      }
      setDragging(true);
      setPendingIndex(null);
      dragLastAngleRef.current = pointerAngleDeg(e.clientX, e.clientY, rect);
    },
    [spinning],
  );

  const seg = activeIndex !== null ? GROWTH_SEGMENTS[activeIndex] : null;

  useEffect(() => {
    if (spinning || activeIndex !== LLM_SEGMENT_INDEX || LLM_SEGMENT_INDEX < 0) return;
    onLlmSegmentReveal?.(false);
  }, [activeIndex, spinning, onLlmSegmentReveal]);

  const panelPad = compact ? "p-10 md:p-12" : "p-12 md:p-14";
  const wheelSizeClass = compact
    ? "w-[min(100%,max(340px,46vw))] max-w-[460px]"
    : "w-[min(100%,max(420px,52vw))] max-w-[540px]";

  const cardShell =
    "flex min-h-[320px] flex-col rounded-2xl border border-white/[0.06] bg-white/[0.025] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_20px_48px_-28px_rgba(0,0,0,0.45)] backdrop-blur-md md:min-h-[360px] md:p-9";

  let cardBody: ReactNode;
  if (spinning) {
    cardBody = (
      <div className={cardShell}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">Twój wynik</p>
        <div className="mt-10 flex flex-1 flex-col items-start justify-center gap-4">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-300/80" strokeWidth={1.25} />
          <p className="text-lg font-medium leading-snug tracking-tight text-slate-100 md:text-xl">
            Analizujemy potencjał wzrostu…
          </p>
          <p className="max-w-prose text-sm leading-relaxed text-slate-400">
            Dobieramy obszar o najwyższym wpływie na sprzedaż, widoczność i koszt pozyskania — zaraz pokażemy wynik.
          </p>
        </div>
      </div>
    );
  } else if (seg) {
    cardBody = (
      <div
        className={`${cardShell} border-indigo-400/12 bg-gradient-to-b from-white/[0.04] to-white/[0.015] shadow-[0_0_0_1px_rgba(99,102,241,0.06),0_24px_56px_-28px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.05)]`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">Twój wynik</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-white md:text-[1.65rem]">{seg.title}</h3>
        <p className="mt-5 text-[15px] leading-[1.65] text-slate-300">{seg.description}</p>
        <div className="mt-6 rounded-xl border border-white/[0.07] bg-[#070b14]/70 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Efekt biznesowy</p>
          <p className="mt-2 text-[15px] font-medium leading-snug text-slate-100">{seg.businessEffect}</p>
        </div>
        <div className="mt-auto pt-8">
          {seg.id === "llm" && onLlmSegmentReveal ? (
            <button
              type="button"
              onClick={() => {
                sfx.chime();
                onLlmSegmentReveal(true);
              }}
              className="flex w-full items-center justify-center rounded-xl bg-white px-5 py-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#050814] shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] transition hover:bg-slate-100"
            >
              Zobacz, jak to działa
            </button>
          ) : (
            <a
              href="#growth-wheel"
              onClick={() => sfx.chime()}
              className="flex w-full items-center justify-center rounded-xl bg-white px-5 py-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#050814] shadow-[0_1px_0_rgba(255,255,255,0.5)_inset] transition hover:bg-slate-100"
            >
              Zakręć kołem
            </a>
          )}
          <Link
            to={ctaTo}
            onClick={() => sfx.success()}
            className="mt-3 block text-center text-[12px] font-medium text-slate-500 underline-offset-4 transition hover:text-slate-300"
          >
            Rozpocznij w MarketingNow
          </Link>
        </div>
      </div>
    );
  } else {
    cardBody = (
      <div className={cardShell}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">Twój wynik</p>
        <h3 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-slate-50 md:text-[1.65rem]">
          Gotowy na diagnozę wzrostu?
        </h3>
        <p className="mt-5 flex-1 text-[15px] leading-[1.65] text-slate-400">
          Zakręć kołem i odkryj obszar, w którym MarketingNow może najszybciej zwiększyć Twoją widoczność, liczbę leadów
          lub konwersję. Możesz też obracać obręcz palcem lub myszą — jest też segment „I wiele więcej”.
        </p>
      </div>
    );
  }

  return (
    <div className="font-sans antialiased [font-family:Inter,ui-sans-serif,system-ui,sans-serif]">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-5">
        <header className={`mb-8 text-balance ${compact ? "mb-6" : "mb-10"} md:text-left`}>
          <h2
            className={`font-semibold tracking-[-0.03em] text-neutral-950 ${compact ? "text-xl md:text-2xl" : "text-2xl md:text-[1.75rem]"}`}
          >
            Odkryj, gdzie tracisz wzrost
          </h2>
          <p className={`mt-2 max-w-2xl text-neutral-600 ${compact ? "text-sm" : "text-[15px]"} leading-relaxed`}>
            Zakręć kołem i zobacz, który obszar marketingu może najszybciej zwiększyć Twoją sprzedaż, widoczność lub liczbę
            leadów.
          </p>
        </header>

        <div
          className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#080d1a] ${panelPad} shadow-[0_24px_64px_-36px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.035)]`}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.85]"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 75% 50% at 18% 0%, rgba(99,102,241,0.07), transparent 58%), radial-gradient(ellipse 65% 45% at 88% 100%, rgba(56,189,248,0.045), transparent 52%), radial-gradient(ellipse 55% 42% at 50% 55%, rgba(15,23,42,0.35), transparent 62%)",
            }}
          />

          <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-14">
            <div className={`min-h-0 justify-center lg:justify-center ${hideWheelOnMobile ? "hidden lg:flex" : "flex"}`}>
              <div className="relative flex w-full max-w-[min(100%,520px)] flex-col items-center justify-center">
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                  <div className="aspect-square w-[94%] rounded-full bg-[radial-gradient(circle_at_50%_44%,rgba(129,140,248,0.09)_0%,transparent_60%)] blur-3xl" />
                  <div className="absolute aspect-square w-[80%] rounded-full bg-[radial-gradient(circle_at_42%_38%,rgba(56,189,248,0.05)_0%,transparent_58%)] blur-2xl" />
                </div>

                <div className="relative z-10 mb-1 flex h-8 w-12 items-end justify-center" aria-hidden>
                  <div className="drop-shadow-[0_0_12px_rgba(255,255,255,0.12)]">
                    <div className="h-0 w-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-[rgba(255,255,255,0.88)]" />
                  </div>
                </div>

                <div
                  ref={wheelWrapRef}
                  className={`relative aspect-square ${wheelSizeClass} touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                  onPointerDown={onWheelPointerDown}
                  role="application"
                  aria-label="Silnik wzrostu marketingowego — obróć obręcz lub wybierz Zakręć"
                >
                  <div
                    className="absolute inset-0 z-10 origin-center will-change-transform"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      transition: spinning && !dragging ? `transform ${SPIN_MS}ms ${SPIN_EASE}` : "none",
                    }}
                  >
                    <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="absolute inset-0 z-10 h-full w-full overflow-visible">
                      <defs>
                        {GROWTH_SEGMENTS.map((_, i) => (
                          <linearGradient key={`g-${i}`} id={`${uid}-seg${i}`} x1="50%" y1="0%" x2="50%" y2="100%">
                            <stop offset="0%" stopColor={SEGMENT_STOPS[i].a[0]} />
                            <stop offset="48%" stopColor={SEGMENT_STOPS[i].a[1]} />
                            <stop offset="100%" stopColor={SEGMENT_STOPS[i].b[1]} />
                          </linearGradient>
                        ))}
                        <linearGradient id={`${uid}-rim`} x1="30%" y1="0%" x2="70%" y2="100%">
                          <stop offset="0%" stopColor="rgba(129,140,248,0.2)" />
                          <stop offset="50%" stopColor="rgba(56,189,248,0.12)" />
                          <stop offset="100%" stopColor="rgba(129,140,248,0.18)" />
                        </linearGradient>
                      </defs>
                      <g>
                        {GROWTH_SEGMENTS.map((s, i) => {
                          const isWinner = activeIndex === i && !spinning;
                          const isPending = pendingIndex === i && spinning;
                          const isDim = activeIndex !== null && activeIndex !== i && !spinning && !isPending;
                          const isHover = hoveredIndex === i && !spinning;
                          const bright = isWinner || isPending || isHover;
                          return (
                            <path
                              key={s.id}
                              d={wedgePath(i, WHEEL_R_OUTER, WHEEL_CX, WHEEL_CY)}
                              fill={`url(#${uid}-seg${i})`}
                              stroke={
                                bright
                                  ? "rgba(165,180,255,0.32)"
                                  : "rgba(255,255,255,0.04)"
                              }
                              strokeWidth={bright ? 0.85 : 0.32}
                              className="transition-[stroke,stroke-width,opacity,filter] duration-500 ease-out"
                              style={{
                                opacity: isDim ? 0.48 : 1,
                                filter: isWinner
                                  ? "drop-shadow(0 0 22px rgba(99,102,241,0.2))"
                                  : isPending
                                    ? "drop-shadow(0 0 18px rgba(99,102,241,0.16))"
                                    : isHover
                                      ? "drop-shadow(0 0 14px rgba(129,140,248,0.1))"
                                      : undefined,
                              }}
                              onPointerEnter={() => !spinning && setHoveredIndex(i)}
                              onPointerLeave={() => setHoveredIndex(null)}
                            />
                          );
                        })}
                      </g>
                      {Array.from({ length: N }).map((_, i) => {
                        const a = ((-90 + i * SLICE) * Math.PI) / 180;
                        const x2 = WHEEL_CX + WHEEL_R_OUTER * Math.cos(a);
                        const y2 = WHEEL_CY + WHEEL_R_OUTER * Math.sin(a);
                        return (
                          <line
                            key={`spoke-${i}`}
                            x1={WHEEL_CX}
                            y1={WHEEL_CY}
                            x2={x2}
                            y2={y2}
                            stroke="rgba(255,255,255,0.035)"
                            strokeWidth={0.35}
                            style={{ pointerEvents: "none" }}
                          />
                        );
                      })}
                      <circle
                        cx={WHEEL_CX}
                        cy={WHEEL_CY}
                        r={WHEEL_R_OUTER}
                        fill="none"
                        stroke={`url(#${uid}-rim)`}
                        strokeWidth={0.7}
                        style={{ pointerEvents: "none", filter: "drop-shadow(0 0 12px rgba(99,102,241,0.18))" }}
                      />
                      <circle
                        cx={WHEEL_CX}
                        cy={WHEEL_CY}
                        r={WHEEL_R_INNER}
                        fill="rgba(9,12,22,0.94)"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth={0.55}
                        style={{ pointerEvents: "none" }}
                      />
                    </svg>
                  </div>

                  <div className="pointer-events-none absolute inset-0 z-20">
                    {GROWTH_SEGMENTS.map((s, i) => {
                      const { leftPct, topPct } = segmentLabelPositionPercent(i, rotation);
                      const line2 = s.perimeterLines[1]?.trim();
                      const labelW = wheelLabelMaxWidthPct();
                      return (
                        <div
                          key={`lbl-${s.id}`}
                          className="pointer-events-none text-[9px] uppercase leading-[1.15] sm:text-[10px]"
                          style={{
                            ...WHEEL_LABEL_BOX_STYLE,
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            maxWidth: `min(90px, ${labelW}%)`,
                          }}
                        >
                          <span className="block">{s.perimeterLines[0]}</span>
                          {line2 ? <span className="block">{line2}</span> : null}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void spin();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    disabled={spinning || dragging}
                    className="pointer-events-auto absolute left-1/2 top-1/2 z-40 flex h-11 min-h-[44px] max-h-[48px] w-[min(48%,140px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.09] via-white/[0.04] to-white/[0.02] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.9)] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_28px_-12px_rgba(0,0,0,0.45)] transition duration-300 ease-out hover:border-white/[0.1] hover:from-white/[0.11] hover:via-white/[0.05] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.99] [font-family:Inter,ui-sans-serif,system-ui,sans-serif]"
                  >
                    {spinning ? (
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-200/70" strokeWidth={1.35} />
                    ) : (
                      "Zakręć"
                    )}
                  </button>
                </div>

                {!hideWheelCaption ? (
                  <p className="relative z-10 mt-6 max-w-[360px] text-center text-[12px] font-medium leading-relaxed tracking-[0.02em] text-slate-500/90">
                    <span className="text-slate-400/95">Dotknij obręczy</span> i przeciągnij. „Zakręć” losuje segment
                    (w tym „I wiele więcej”). Po puszczeniu wyrównujemy wycinek pod wskaźnikiem.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="min-w-0">{cardBody}</div>
          </div>

          <div className="mt-8 flex justify-center border-t border-white/[0.05] pt-8">
            <button
              type="button"
              onClick={() => void spin()}
              disabled={spinning || dragging}
              className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-9 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 transition hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-35"
            >
              Zakręć ponownie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
