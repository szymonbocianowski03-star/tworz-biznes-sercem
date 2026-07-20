import { useEffect, useState, useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { X, Gift, Target, TrendingUp, Sparkles, User } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";

const STORAGE_KEY = "ebook_popup_dismissed_until";
const SESSION_KEY = "ebook_popup_shown_session";
const SUPPRESS_DAYS = 5;

const HOMEPAGE_DELAY_MS = 12_000;
const HOMEPAGE_SCROLL_THRESHOLD = 0.35;
const BILLING_DELAY_MS = 8_000;

const EXCLUDED_PREFIXES = ["/auth", "/billing", "/checkout", "/billingsuccessful", "/reset-password"];

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function isSuppressed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return true;
    const until = localStorage.getItem(STORAGE_KEY);
    if (until && Date.now() < Number(until)) return true;
  } catch {}
  return false;
}

function markShown() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {}
}

function markDismissed() {
  try {
    const until = Date.now() + SUPPRESS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, String(until));
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {}
}

export function EbookPopup() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuthSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const eligible =
    !loading &&
    !user &&
    !EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const show = useCallback(() => {
    if (isSuppressed()) return;
    markShown();
    setOpen(true);
  }, []);

  // Time + scroll triggers per page
  useEffect(() => {
    if (!eligible || open) return;
    if (isSuppressed()) return;

    let cancelled = false;
    const timers: number[] = [];

    const isHome = pathname === "/";
    const isPricing = pathname === "/cennik" || pathname === "/pricing";

    if (isHome) {
      let timeReached = false;
      let scrollReached = false;
      const trigger = () => {
        if (cancelled) return;
        if (timeReached && scrollReached) show();
      };
      const t = window.setTimeout(() => {
        timeReached = true;
        trigger();
      }, HOMEPAGE_DELAY_MS);
      timers.push(t);
      const onScroll = () => {
        const h = document.documentElement;
        const scrolled = (h.scrollTop || window.scrollY) / Math.max(1, h.scrollHeight - h.clientHeight);
        if (scrolled >= HOMEPAGE_SCROLL_THRESHOLD) {
          scrollReached = true;
          trigger();
          window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      return () => {
        cancelled = true;
        timers.forEach((id) => window.clearTimeout(id));
        window.removeEventListener("scroll", onScroll);
      };
    }

    if (isPricing) {
      const t = window.setTimeout(() => show(), BILLING_DELAY_MS);
      timers.push(t);
      return () => {
        cancelled = true;
        timers.forEach((id) => window.clearTimeout(id));
      };
    }

    return () => {
      cancelled = true;
    };
  }, [eligible, pathname, open, show]);

  // Exit intent (desktop only)
  useEffect(() => {
    if (!eligible || open) return;
    if (isMobile()) return;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) show();
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, [eligible, open, show]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = useCallback(() => {
    markDismissed();
    setOpen(false);
  }, []);

  const handleChoose = useCallback(() => {
    markDismissed();
    setOpen(false);
    navigate({ to: "/billing" });
  }, [navigate]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Darmowy e-book przy zakupie subskrypcji"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-3xl bg-[#faf7f1] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Zamknij"
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-600 hover:bg-slate-900/5 transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid md:grid-cols-2 gap-6 p-6 md:p-10">
          {/* Lewa */}
          <div className="flex flex-col">
            <div className="font-display text-xl font-bold tracking-tight text-slate-900">MarketingNow</div>
            <div className="mt-2 h-px w-10 bg-slate-900" />

            <div className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-slate-900/15 px-4 py-1.5 text-xs font-semibold tracking-wider text-slate-900">
              <Gift className="h-4 w-4" />
              OFERTA LIMITOWANA
            </div>

            <h2 className="mt-6 font-display text-5xl md:text-6xl font-extrabold leading-[0.95] tracking-tight text-slate-900">
              E-book<br />gratis
            </h2>
            <div className="mt-4 h-px w-10 bg-slate-900" />

            <p className="mt-5 text-slate-700 leading-relaxed">
              Odbierz e-book o wartości <span className="font-bold">49 zł</span> przy wyborze
              jakiejkolwiek subskrypcji.
            </p>

            <div className="mt-5 flex items-center gap-3 text-sm text-slate-700">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-900/20">
                <User className="h-4 w-4" />
              </span>
              <span>Tylko teraz dla nowych klientów MarketingNow.</span>
            </div>

            <button
              type="button"
              onClick={handleChoose}
              className="mt-7 inline-flex w-full items-center justify-between gap-2 rounded-xl bg-slate-900 px-6 py-4 text-sm font-bold tracking-wider text-white hover:bg-slate-800 transition"
            >
              <span>WYBIERAM SUBSKRYPCJĘ</span>
              <span aria-hidden>→</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="mt-4 text-sm text-slate-700 underline underline-offset-4 hover:text-slate-900"
            >
              Później
            </button>
          </div>

          {/* Prawa — wizual e-booka */}
          <div className="relative hidden md:flex items-center justify-center">
            <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl bg-white shadow-xl border border-slate-200 p-6 flex flex-col">
              <div className="text-xs font-semibold tracking-wider text-slate-500">MarketingNow</div>
              <div className="mt-3 font-display text-3xl font-extrabold leading-tight text-slate-900">
                Marketing<br />firmy<br />w jednym<br />miejscu
              </div>
              <div className="mt-3 h-px w-10 bg-slate-900" />
              <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                Reklamy, hooki, analiza konkurencji, treści i widoczność marki w AI.
              </p>
              <div className="mt-auto flex items-center justify-center pt-6">
                <div className="relative h-32 w-32 rounded-full bg-slate-900 text-white flex items-center justify-center font-display text-3xl font-extrabold">
                  M
                </div>
              </div>
              <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-slate-900 text-white flex flex-col items-center justify-center text-center shadow-lg">
                <span className="text-[10px] tracking-widest">WARTOŚĆ:</span>
                <span className="font-display text-xl font-extrabold">49 zł</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pasek zalet */}
        <div className="border-t border-slate-900/10 bg-white/60 px-6 md:px-10 py-5 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-b-3xl">
          <Perk icon={<Target className="h-4 w-4" />} label="Praktyczna wiedza od ekspertów" />
          <Perk icon={<TrendingUp className="h-4 w-4" />} label="Skuteczne strategie dla Twojej firmy" />
          <Perk icon={<Sparkles className="h-4 w-4" />} label="Więcej wyników dzięki AI" />
        </div>
      </div>
    </div>
  );
}

function Perk({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-800">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}