import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Monitor, Megaphone, Sparkles, Users, Search, Mail, CalendarDays, Eye, Palette, type LucideIcon } from "lucide-react";
import { sfx, soundsEnabled, setSoundsEnabled } from "@/lib/sounds";
import {
  formatPlanCreditsLabel,
  formatPlanImagesHint,
  planYearlyMonthlyEquivalentGrossPln,
  planYearlyTotalGrossPln,
  PLANS,
  PLAN_YEARLY_DISCOUNT_FRAC,
} from "@/lib/plans";
import { MarketingNowLogo } from "@/components/MarketingNowLogo";
import { BillingPeriodToggle } from "@/components/SegmentedControl";
import { TestimonialsShorts } from "@/components/TestimonialsShorts";
import { GoogleAdsLiveSection } from "@/components/GoogleAdsLiveSection";
import { AppInsideShowcase } from "@/components/landing/AppInsideShowcase";
import { PolandFirmBadge } from "@/components/landing/BrandMarks";
import hoodieAsset from "@/assets/product-examples/hoodie.png.asset.json";
import tshirtsAsset from "@/assets/product-examples/tshirts.png.asset.json";
import derbyAsset from "@/assets/product-examples/derby.png.asset.json";
import sneakersAsset from "@/assets/product-examples/sneakers.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MarketingNow — marketing firmy w jednym miejscu" },
      {
        name: "description",
        content:
          "Jedno miejsce do planowania marketingu: reklamy, hooki, analiza konkurencji, treści, SEO, maile, kalendarz i widoczność marki w AI — od strategii po gotowe materiały.",
      },
      { property: "og:title", content: "MarketingNow — marketing firmy w jednym miejscu" },
      {
        property: "og:description",
        content:
          "Planuj reklamy, hooki i treści, analizuj konkurencję, prowadź maile, SEO i kalendarz — w jednym narzędziu.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: Landing,
});

/* ============================== LANDING ============================== */
function Landing() {
  return (
    <div className="collins-root min-h-screen bg-white text-neutral-950 antialiased">
      <Nav />
      <Hero />
      <AppInsideShowcase />
      <GoogleAdsLiveSection />
      <WorkflowPitch />
      <WhatYouHandle />
      <TestimonialsShorts />
      <ProductExamples />
      <Pricing />
      <Footer />
    </div>
  );
}

/* ============================== NAV ============================== */
function Nav() {
  const [sound, setSound] = useState<boolean>(false);
  useEffect(() => {
    setSound(soundsEnabled());
  }, []);
  const toggle = () => {
    const next = !sound;
    setSound(next);
    setSoundsEnabled(next);
    if (next) sfx.chime();
  };
  const navLinks = [
    { href: "#panel", label: "DNA marki" },
    { href: "#co-obslugujesz", label: "Zakres" },
    { href: "#growth-wheel", label: "Widoczność w AI" },
    { href: "#poznaj-opinie", label: "Opinie" },
    { href: "#cennik", label: "Cennik" },
    { href: "/program-partnerski", label: "Program partnerski", isRoute: true },
  ] as const;

  return (
    <>
      <div className="sticky top-0 z-50 bg-neutral-950 text-white border-b border-neutral-800">
        <div className="mx-auto max-w-[1600px] px-4 md:px-10 py-2.5 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-2 text-center sm:text-left">
          <p className="text-[12px] md:text-[13px] text-white/90 leading-snug">
            <span className="text-white font-semibold">Bez karty kredytowej</span> na start — plan Free, płatne dopiero gdy chcesz.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/auth"
              onClick={() => sfx.chime()}
              className="inline-flex items-center justify-center rounded-sm border border-white/45 text-white px-4 py-2 text-[12px] font-semibold hover:bg-white/10 transition-colors"
            >
              Zaloguj się
            </Link>
            <Link
              to="/auth"
              onClick={() => sfx.success()}
              className="inline-flex items-center justify-center rounded-sm bg-white text-neutral-950 px-4 py-2 text-[12px] font-bold hover:bg-neutral-100 transition-colors"
            >
              Rozpocznij za darmo
            </Link>
          </div>
        </div>
      </div>
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 md:px-10">
          <div className="flex items-center gap-4 md:gap-6 min-h-[56px] sm:min-h-[64px] md:h-[72px]">
            <div className="shrink-0">
              <MarketingNowLogo className="text-neutral-950" size="lg" />
            </div>
            <nav className="hidden md:flex flex-1 items-center gap-5 lg:gap-7 text-[11px] uppercase tracking-[0.14em] font-sans min-w-0 overflow-x-auto">
              {navLinks.map((l) =>
                "isRoute" in l && l.isRoute ? (
                  <Link
                    key={l.href}
                    to={l.href}
                    onClick={() => sfx.chime()}
                    className="hover:opacity-60 transition whitespace-nowrap"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a key={l.href} href={l.href} className="hover:opacity-60 transition whitespace-nowrap">
                    {l.label}
                  </a>
                ),
              )}
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                onClick={toggle}
                aria-label={sound ? "Wyłącz dźwięki" : "Włącz dźwięki"}
                title={sound ? "Dźwięki: włączone" : "Dźwięki: wyłączone"}
                className="hidden lg:inline-flex items-center justify-center h-9 w-9 border border-neutral-300 hover:border-neutral-950 transition-colors text-neutral-700"
              >
                {sound ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <line x1="22" y1="9" x2="16" y2="15" />
                    <line x1="16" y1="9" x2="22" y2="15" />
                  </svg>
                )}
              </button>
              <a
                href="https://calendly.com/szymon-bocianowski/30min"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sfx.chime()}
                className="hidden xl:inline-flex text-[12px] uppercase tracking-[0.14em] border border-neutral-300 px-3 py-2 hover:bg-neutral-100 transition-colors whitespace-nowrap"
              >
                Konsultacja
              </a>
              <Link
                to="/auth"
                onClick={() => sfx.chime()}
                className="hidden sm:inline-flex text-[11px] uppercase tracking-[0.14em] border border-neutral-300 px-3 py-2 hover:bg-neutral-100 transition-colors whitespace-nowrap"
              >
                Zaloguj
              </Link>
              <Link
                to="/auth"
                onClick={() => sfx.success()}
                className="inline-flex text-[11px] uppercase tracking-[0.14em] border border-neutral-950 bg-neutral-950 text-white px-3 py-2 hover:bg-white hover:text-neutral-950 transition-colors whitespace-nowrap"
              >
                Rozpocznij
              </Link>
            </div>
          </div>
          <nav className="md:hidden flex items-center gap-4 overflow-x-auto pb-2.5 -mt-1 text-[10px] uppercase tracking-[0.12em] text-neutral-600 font-sans [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navLinks.map((l) =>
              "isRoute" in l && l.isRoute ? (
                <Link
                  key={l.href}
                  to={l.href}
                  onClick={() => sfx.chime()}
                  className="hover:text-neutral-950 transition whitespace-nowrap py-1 shrink-0"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  className="hover:text-neutral-950 transition whitespace-nowrap py-1 shrink-0"
                >
                  {l.label}
                </a>
              ),
            )}
          </nav>
        </div>
      </header>
    </>
  );
}

/* ============================== MOBILE NOTICE ============================== */
function MobileDesktopNotice() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-xl border border-neutral-200 bg-white p-2.5 text-neutral-700">
          <Monitor className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-neutral-950">
            Ta aplikacja najlepiej działa na komputerze
          </h3>
          <p className="mt-1 text-[14px] leading-relaxed text-neutral-600">
            Aby korzystać ze wszystkich funkcji, otwórz stronę na laptopie lub komputerze.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ============================== HERO ============================== */
function Hero() {
  const [howOpen, setHowOpen] = useState(false);

  return (
    <section id="growth-wheel" className="relative border-b border-neutral-200 overflow-hidden scroll-mt-24 sm:scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 md:px-10 pt-10 sm:pt-14 md:pt-20 pb-0">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[11px] md:text-[12px] uppercase tracking-[0.2em] text-neutral-500 mb-3 sm:mb-4 md:mb-5">
            AI marketing workspace
          </p>
          <h1 className="serif text-[clamp(1.75rem,8vw,4.1rem)] leading-[1.08] tracking-[-0.03em] text-balance text-neutral-950">
            Przestań składać marketing
            <span className="block mt-1 md:mt-0.5">z wielu różnych narzędzi</span>
          </h1>
          <p className="mt-4 sm:mt-5 text-[15px] sm:text-[16px] md:text-[18px] leading-[1.55] text-neutral-700 px-1">
            MarketingNow pomaga tworzyć kampanie reklamowe, treści, maile, SEO, grafiki oraz plan działań w
            jednym miejscu — bez agencji, chaosu i zaczynania wszystkiego od zera.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
            <Link
              to="/auth"
              onClick={() => sfx.success()}
              className="inline-flex w-full sm:w-auto items-center justify-center border border-neutral-950 bg-neutral-950 text-white px-6 py-3.5 text-[12px] md:text-[13px] font-semibold uppercase tracking-[0.12em] hover:bg-white hover:text-neutral-950 transition-colors text-center touch-manipulation"
            >
              Stwórz pierwszą kampanię za darmo
            </Link>
            <button
              type="button"
              onClick={() => {
                sfx.chime();
                setHowOpen((v) => !v);
              }}
              className="inline-flex w-full sm:w-auto items-center justify-center border border-neutral-300 bg-white text-neutral-900 px-6 py-3.5 text-[12px] md:text-[13px] font-semibold uppercase tracking-[0.12em] hover:border-neutral-950 transition-colors touch-manipulation"
            >
              {howOpen ? "Zwiń" : "Zobacz, jak to działa"}
            </button>
          </div>
          <p className="mt-5 sm:mt-6 text-[10px] sm:text-[11px] md:text-[12px] uppercase tracking-[0.12em] sm:tracking-[0.16em] text-neutral-500 leading-relaxed px-2">
            Bez karty płatniczej · 400 kredytów na start · możesz anulować w każdej chwili
          </p>
        </div>

        {howOpen && (
          <div className="mt-6 sm:mt-8 mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5 md:p-6 text-left animate-in fade-in slide-in-from-top-2 duration-300">
            <ol className="space-y-2.5 sm:space-y-3">
              {[
                {
                  t: "1. Czat AI w centrum",
                  d: "Opisujesz zadanie albo wybierasz gotowe działanie — agent prowadzi Cię przez kampanie, treści i analizę.",
                },
                {
                  t: "2. Integracje i publikacja",
                  d: "Łączysz Google Ads, Meta, Gmail, kalendarz — publikujesz z jednego workspace.",
                },
                {
                  t: "3. Panel kampanii i raporty",
                  d: "Kreujesz reklamy z AI, sprawdzasz SEO, konkurencję i widoczność marki w odpowiedziach asystentów.",
                },
              ].map((s) => (
                <li key={s.t} className="rounded-xl border border-neutral-200 bg-white px-3.5 py-3 sm:px-4">
                  <p className="text-[13px] font-semibold text-neutral-950">{s.t}</p>
                  <p className="mt-1 text-[13px] text-neutral-600 leading-relaxed">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-8 sm:mt-10 md:mt-14 max-w-xl sm:max-w-2xl mx-auto">
          <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-zinc-950 px-6 py-10 sm:px-10 sm:py-14 text-center ring-1 ring-zinc-800/90 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.3)]">
            <div
              className="pointer-events-none absolute inset-0 opacity-80"
              aria-hidden
              style={{
                background:
                  "radial-gradient(ellipse 60% 55% at 50% 0%, rgba(255,255,255,0.10), transparent 60%), radial-gradient(ellipse 40% 40% at 85% 90%, rgba(16,185,129,0.08), transparent 55%)",
              }}
            />
            <p className="relative text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-white/50">
              Jeden workspace
            </p>
            <h2 className="relative mt-4 serif text-[clamp(1.6rem,5vw,2.75rem)] leading-[1.12] tracking-[-0.02em] text-white text-balance">
              Cały marketing firmy{" "}
              <span className="italic font-light text-white/90">w jednym workspace</span>.
            </h2>
            <p className="relative mt-4 sm:mt-5 mx-auto max-w-xl text-[14px] sm:text-[15px] leading-[1.6] text-white/60">
              Zamiast przełączać się między narzędziami do reklam, treści, SEO, mailingu i planowania, możesz
              przygotować swoje działania marketingowe w jednym miejscu.
            </p>
          </div>
          <div className="mt-4 flex justify-center">
            <PolandFirmBadge />
          </div>
        </div>

        <div className="md:hidden py-8 sm:py-10">
          <MobileDesktopNotice />
        </div>
        <div className="hidden md:block pb-14 md:pb-20" />
      </div>
    </section>
  );
}

/* ============================== WORKFLOW PITCH (wysoko na stronie) ============================== */
function WorkflowPitch() {
  return (
    <section className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10 py-16 md:py-24">
        <div className="max-w-4xl">
          <h2 className="serif text-[clamp(1.85rem,4.5vw,3.25rem)] leading-[1.08] tracking-[-0.02em] text-balance">
            To więcej niż{" "}
            <span className="italic font-light">generator tekstów AI.</span>
          </h2>
          <p className="mt-6 text-[16px] md:text-[17px] leading-[1.6] text-neutral-700">
            Zwykłe narzędzie AI tworzy pojedynczą odpowiedź na podstawie promptu. MarketingNow wykorzystuje
            kontekst Twojej firmy i łączy kampanie, treści, SEO, mailing, grafiki oraz plan działań w jednym
            procesie.
          </p>
          <p className="mt-6 text-[16px] md:text-[17px] leading-[1.6] text-neutral-800 font-medium">
            Marketing nie powinien zajmować całego dnia. Wklejasz adres strony, a narzędzie pomaga zamienić
            ofertę w kampanie, treści, maile i plan publikacji.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================== CO MOŻESZ OBSŁUŻYĆ ============================== */
function WhatYouHandle() {
  const items: { id: string; title: string; body: string; icon: LucideIcon }[] = [
    {
      id: "obs-kampanie",
      title: "Kampanie reklamowe",
      body: "Planuj kampanie reklamowe end-to-end: struktura, kreacje, grupy odbiorców, komunikaty i testy — bez rozdrabniania na pojedyncze sieci.",
      icon: Megaphone,
    },
    {
      id: "obs-hooki",
      title: "Hooki i pomysły",
      body: "Generuj hooki, warianty pierwszego kontaktu, kąty narracji i pomysły kreatywne pod reklamy, treści organiczne i landing page’e.",
      icon: Sparkles,
    },
    {
      id: "obs-konkurencja",
      title: "Analiza konkurencji",
      body: "Zbieraj wnioski o konkurentach: przekazy, oferty, mocne i słabe strony komunikacji — jako podstawa pod strategię i kreacje.",
      icon: Users,
    },
    {
      id: "obs-seo",
      title: "SEO",
      body: "Tematy artykułów, struktury stron, opisy usług, treści pod intencje, meta title, meta description i briefy contentowe.",
      icon: Search,
    },
    {
      id: "obs-email",
      title: "Email marketing",
      body: "Newslettery, sekwencje sprzedażowe, follow-upy, maile onboardingowe i komunikacja posprzedażowa.",
      icon: Mail,
    },
    {
      id: "obs-kalendarz",
      title: "Kalendarz marketingowy",
      body: "Harmonogram kampanii, publikacji, maili, promocji i launchy — jeden widok zamiast rozstrzelonych arkuszy.",
      icon: CalendarDays,
    },
    {
      id: "obs-llm",
      title: "Widoczność w AI",
      body: "Sprawdzaj, czy marka i oferta są jasno opisane dla modeli AI i co poprawić, żeby były częściej obecne w odpowiedziach asystentów.",
      icon: Eye,
    },
    {
      id: "obs-kreacje",
      title: "Kreacje i materiały wizualne",
      body: "Warianty kreacji reklamowych, grafiki pod kanały, key visual w kilku formatach i spójne nagłówki — bez przeskakiwania między osobnymi narzędziami do copy i do obrazów.",
      icon: Palette,
    },
  ];
  return (
    <section id="co-obslugujesz" className="border-b border-neutral-200 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10 py-20 md:py-28">
        <div className="mb-14 md:mb-16 max-w-4xl">
          <h2 className="serif text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.98] tracking-[-0.03em] text-balance">
            Co możesz <span className="italic font-light">obsłużyć</span> w MarketingNow?
          </h2>
          <p className="mt-5 text-[16px] md:text-[17px] text-neutral-600 max-w-2xl leading-relaxed">
            Jedno miejsce do planowania, tworzenia i obsługi marketingu — nie tylko „wygeneruj
            tekst”, lecz cały przebieg pracy od strategii po materiały do publikacji.
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-px bg-neutral-300 border border-neutral-300 sm:grid-cols-2">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <li
                key={it.title}
                id={it.id}
                className="bg-white p-8 md:p-10 hover:bg-neutral-50/90 transition-colors scroll-mt-32"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="serif text-[22px] md:text-[26px] tracking-tight text-neutral-950">
                    {it.title}
                  </h3>
                </div>
                <p className="text-[14px] md:text-[15px] leading-[1.65] text-neutral-700">
                  {it.body}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ============================== PRICING ============================== */
function Pricing() {
  const [yearly, setYearly] = useState(false);
  const pctOff = Math.round(PLAN_YEARLY_DISCOUNT_FRAC * 100);
  return (
    <section id="cennik" className="border-b border-neutral-200 scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10 py-20 md:py-32">
        <div className="mb-16 max-w-5xl">
          <h2 className="serif text-[clamp(2.5rem,7vw,6rem)] leading-[0.95] tracking-[-0.03em]">
            Te same ceny <span className="italic font-light">w aplikacji i tutaj</span>.
          </h2>
          <div className="mt-6 inline-flex items-center gap-3 bg-neutral-950 text-white px-4 py-2 text-[12px] uppercase tracking-[0.18em]">
            <span className="serif italic normal-case text-[16px]">Rocznie</span>−{pctOff}% przy
            płatności z góry
          </div>
          <p className="mt-6 text-[15px] text-neutral-600 max-w-xl">
            {yearly
              ? `Ceny brutto przy rozliczeniu rocznym (−${pctOff}% vs suma 12 miesięcy). Wyższe plany zwiększają miesięczną pulę kredytów — szczegóły w aplikacji.`
              : "Ceny brutto, miesięcznie. Wyższe plany zwiększają miesięczną pulę kredytów — szczegóły zobaczysz w aplikacji po zalogowaniu."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-8 max-w-4xl">
          <p className="text-[12px] uppercase tracking-[0.18em] text-neutral-500">Rozliczenie</p>
          <BillingPeriodToggle
            yearly={yearly}
            onChange={setYearly}
            variant="landing"
            discountPct={pctOff}
            fluid
            className="w-full sm:w-auto"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-px bg-neutral-200 border border-neutral-200">
          {PLANS.map((p) => {
            const monthEq =
              p.monthly > 0 && yearly ? planYearlyMonthlyEquivalentGrossPln(p.monthly) : p.monthly;
            const yearTotal = p.monthly > 0 && yearly ? planYearlyTotalGrossPln(p.monthly) : null;
            return (
              <div
                key={p.id}
                className={`p-8 md:p-10 flex flex-col ${p.highlight ? "bg-neutral-950 text-white" : "bg-white"}`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="serif text-[28px] tracking-tight">{p.name}</h3>
                  {p.highlight && (
                    <span className="text-[10px] uppercase tracking-[0.18em] border border-white/40 px-2 py-1">
                      Polecany
                    </span>
                  )}
                </div>
                <p
                  className={`text-[13px] ${formatPlanImagesHint(p) ? "mb-1" : "mb-8"} ${p.highlight ? "text-white/70" : "text-neutral-600"}`}
                >
                  {formatPlanCreditsLabel(p)}
                </p>
                {formatPlanImagesHint(p) ? (
                  <p
                    className={`text-[12px] mb-8 ${p.highlight ? "text-white/55" : "text-neutral-500"}`}
                  >
                    {formatPlanImagesHint(p)}
                  </p>
                ) : null}
                <div className="mb-8">
                  <div className="mb-2">
                    <span className="serif text-[clamp(2.5rem,6vw,4rem)] leading-none tracking-[-0.04em]">
                      {p.monthly === 0 ? "0" : String(monthEq)}
                    </span>
                    <span
                      className={`serif italic text-[24px] ml-2 ${p.highlight ? "text-white/70" : "text-neutral-500"}`}
                    >
                      zł
                    </span>
                  </div>
                  <p
                    className={`text-[12px] uppercase tracking-[0.18em] ${p.highlight ? "text-white/60" : "text-neutral-500"}`}
                  >
                    {p.monthly === 0
                      ? "brutto"
                      : yearly
                        ? "brutto / mies. przy rocznym"
                        : "brutto / miesiąc"}
                  </p>
                  {yearTotal != null && (
                    <p
                      className={`text-[13px] mt-2 ${p.highlight ? "text-emerald-300/90" : "text-emerald-700"}`}
                    >
                      {yearTotal.toLocaleString("pl-PL")} zł brutto / rok
                    </p>
                  )}
                </div>
                <ul className="space-y-3 mb-10 flex-1">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className={`text-[14px] flex gap-3 ${p.highlight ? "text-white/90" : "text-neutral-800"}`}
                    >
                      <span className={p.highlight ? "text-white/50" : "text-neutral-400"}>—</span>
                      {f}
                    </li>
                  ))}
                </ul>
                {p.monthly === 0 ? (
                  <Link
                    to="/auth"
                    className={`text-center text-[13px] uppercase tracking-[0.14em] py-3 border transition-colors ${
                      p.highlight
                        ? "border-white bg-white text-neutral-950 hover:bg-transparent hover:text-white"
                        : "border-neutral-950 hover:bg-neutral-950 hover:text-white"
                    }`}
                  >
                    Załóż darmowe konto
                  </Link>
                ) : (
                  <Link
                    to="/billing"
                    search={yearly ? { yearly: true } : {}}
                    className={`text-center text-[13px] uppercase tracking-[0.14em] py-3 border transition-colors ${
                      p.highlight
                        ? "border-white bg-white text-neutral-950 hover:bg-transparent hover:text-white"
                        : "border-neutral-950 hover:bg-neutral-950 hover:text-white"
                    }`}
                  >
                    Wybierz plan
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] text-neutral-600">
          <span className="inline-flex items-center gap-2">
            <span className="serif italic">✓</span> Bez karty na start (Free)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="serif italic">✓</span> Kredyty i plan w jednym panelu po zalogowaniu
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="serif italic">✓</span> Anuluj w każdej chwili
          </span>
        </div>
      </div>
    </section>
  );
}

/* ============================== FOOTER ============================== */

function Footer() {
  return _Footer();
}

/* ============================== PRODUCT EXAMPLES ============================== */
function ProductExamples() {
  const items = [
    { src: hoodieAsset.url, title: "Bluza z kapturem", tag: "Odzież" },
    { src: tshirtsAsset.url, title: "Klasyczny t-shirt", tag: "Odzież" },
    { src: sneakersAsset.url, title: "Sneakersy premium", tag: "Obuwie" },
    { src: derbyAsset.url, title: "Skórzane derby", tag: "Obuwie" },
  ];
  return (
    <section className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-5xl px-6 md:px-10 py-14 md:py-20">
        <div className="mb-8 md:mb-10 max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-4">
            Przykładowe produkty
          </p>
          <h2 className="serif text-[clamp(1.9rem,4.5vw,3.25rem)] leading-[1.05] tracking-[-0.02em]">
            Tak wyglądają grafiki produktów{" "}
            <span className="italic font-light">generowane w MarketingNow</span>.
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {items.map((it) => (
            <figure key={it.title} className="bg-white border border-neutral-200 rounded-lg overflow-hidden flex flex-col">
              <div className="aspect-[4/3] overflow-hidden bg-neutral-100">
                <img
                  src={it.src}
                  alt={it.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              </div>
              <figcaption className="p-3 md:p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                  {it.tag}
                </p>
                <p className="mt-1 serif text-[15px] md:text-[16px] tracking-tight text-neutral-950">
                  {it.title}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function _Footer() {
  return (
    <footer className="bg-white border-t border-neutral-200">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10 py-12 grid grid-cols-12 gap-6 text-[12px] uppercase tracking-[0.18em] text-neutral-500">
        <div className="col-span-12 md:col-span-4 normal-case tracking-normal">
          <p className="text-neutral-950 serif text-[16px] normal-case tracking-tight">
            MarketingNow
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-neutral-600 normal-case tracking-normal max-w-sm">
            Produkt stworzony przez ludzi z doświadczeniem marketingowym.
          </p>
          <div className="mt-4">
            <PolandFirmBadge />
          </div>
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-3">
          <p className="text-neutral-950 mb-3">Kontakt</p>
          <p className="normal-case tracking-normal text-[13px]">
            <a href="mailto:support@marketingnow.tech" className="hover:text-neutral-950">
              support@marketingnow.tech
            </a>
          </p>
          <p className="normal-case tracking-normal text-[13px] mt-1">
            <a
              href="https://calendly.com/szymon-bocianowski/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-950"
            >
              Umów konsultację →
            </a>
          </p>
        </div>
        <div className="col-span-12 sm:col-span-6 md:col-span-5 md:text-right flex flex-wrap md:justify-end gap-x-6 gap-y-2">
          <Link to="/program-partnerski" className="hover:text-neutral-950">
            Program partnerski
          </Link>
          <Link to="/regulamin" className="hover:text-neutral-950">
            Regulamin
          </Link>
          <Link to="/polityka-prywatnosci" className="hover:text-neutral-950">
            Prywatność
          </Link>
        </div>
      </div>
    </footer>
  );
}
