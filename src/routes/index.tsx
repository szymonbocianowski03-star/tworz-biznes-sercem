import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { sfx, soundsEnabled, setSoundsEnabled } from "@/lib/sounds";
import {
  formatPlanCreditsLabel,
  formatPlanImagesHint,
  planYearlyMonthlyEquivalentGrossPln,
  planYearlyTotalGrossPln,
  PLANS,
  PLAN_YEARLY_DISCOUNT_FRAC,
} from "@/lib/plans";
import { GrowthFeatureBlocks } from "@/components/GrowthFeatureBlocks";
import { MarketingNowLogo } from "@/components/MarketingNowLogo";
import { BillingPeriodToggle } from "@/components/SegmentedControl";
import { TestimonialsShorts } from "@/components/TestimonialsShorts";

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
      <WorkflowPitch />
      <WhatYouHandle />
      <TestimonialsShorts />
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
  return (
    <>
      <div className="sticky top-0 z-50 bg-neutral-950 text-white border-b border-neutral-800 shadow-[0_1px_0_rgba(0,0,0,0.15)]">
        <div className="mx-auto max-w-[1600px] px-4 md:px-10 py-3 md:py-3.5 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
              <Link
                to="/auth"
                onClick={() => sfx.chime()}
                className="inline-flex items-center justify-center rounded-sm border border-white/45 text-white px-4 py-2.5 text-[12px] md:text-[13px] font-semibold tracking-tight hover:bg-white/10 transition-colors"
              >
                Zaloguj się
              </Link>
              <Link
                to="/auth"
                onClick={() => sfx.success()}
                className="inline-flex items-center justify-center rounded-sm bg-white text-neutral-950 px-5 py-2.5 text-[12px] md:text-[13px] font-bold tracking-tight hover:bg-neutral-100 transition-colors"
              >
                Rozpocznij za darmo
              </Link>
            </div>
            <p className="text-[12px] md:text-[13px] text-white/90 leading-snug max-w-xl">
              <span className="text-white font-semibold">Bez karty kredytowej</span> na start —
              załóż konto, korzystaj z planu Free, płatne plany dopiero gdy chcesz.
            </p>
          </div>
        </div>
      </div>
      <header className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-[1600px] flex items-center justify-between gap-4 md:gap-8 h-[72px] px-6 md:px-10">
          <div className="shrink-0 min-w-[9.5rem]">
            <MarketingNowLogo className="text-neutral-950" size="lg" />
          </div>
          <nav className="hidden lg:flex flex-1 items-center justify-center gap-6 xl:gap-8 text-[11px] uppercase tracking-[0.14em] font-sans min-w-0">
            <a href="#co-obslugujesz" className="hover:opacity-60 transition whitespace-nowrap">
              Zakres
            </a>
            <a href="#growth-wheel" className="hover:opacity-60 transition whitespace-nowrap">
              Widoczność w AI
            </a>
            <a href="#poznaj-opinie" className="hover:opacity-60 transition whitespace-nowrap">
              Opinie
            </a>
            <a href="#cennik" className="hover:opacity-60 transition whitespace-nowrap">
              Cennik
            </a>
            <Link
              to="/program-partnerski"
              onClick={() => sfx.chime()}
              className="hover:opacity-60 transition whitespace-nowrap"
            >
              Program partnerski
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <button
              onClick={toggle}
              aria-label={sound ? "Wyłącz dźwięki" : "Włącz dźwięki"}
              title={sound ? "Dźwięki: włączone" : "Dźwięki: wyłączone"}
              className="hidden md:inline-flex items-center justify-center h-9 w-9 border border-neutral-300 hover:border-neutral-950 transition-colors text-neutral-700"
            >
              {sound ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
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
              className="hidden md:inline-flex text-[13px] uppercase tracking-[0.14em] border border-neutral-300 px-4 py-2 hover:bg-neutral-100 transition-colors"
            >
              Umów konsultację
            </a>
            <Link
              to="/auth"
              onClick={() => sfx.chime()}
              className="hidden sm:inline-flex text-[12px] uppercase tracking-[0.14em] border border-neutral-300 px-4 py-2 hover:bg-neutral-100 transition-colors whitespace-nowrap"
            >
              Zaloguj się
            </Link>
            <Link
              to="/auth"
              onClick={() => sfx.success()}
              className="hidden sm:inline-flex text-[12px] uppercase tracking-[0.14em] border border-neutral-950 px-4 py-2 hover:bg-neutral-950 hover:text-white transition-colors whitespace-nowrap"
            >
              Rozpocznij za darmo
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

/* ============================== HERO ============================== */
function Hero() {
  return (
    <section id="growth-wheel" className="relative border-b border-neutral-200 overflow-hidden scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-6 md:px-10 pt-16 md:pt-24 pb-14 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 xl:gap-20 items-center">
          <div className="lg:col-span-6 xl:col-span-5 max-w-xl lg:max-w-none">
            <p className="text-[11px] md:text-[12px] uppercase tracking-[0.2em] text-neutral-500 mb-4 md:mb-5">
              AI marketing workspace
            </p>
            <h1 className="serif text-[clamp(1.95rem,4.2vw,4.1rem)] leading-[1.06] tracking-[-0.03em] text-balance text-neutral-950">
              Marketing firmy
              <span className="block mt-1 md:mt-0.5">w jednym miejscu</span>
            </h1>
            <p className="mt-6 text-[17px] md:text-[18px] leading-[1.55] text-neutral-800 font-medium">
              Reklamy, hooki, analiza konkurencji, treści i widoczność marki w AI — w jednym panelu
              MarketingNow.
            </p>
            <p className="mt-4 text-[15px] md:text-[16px] leading-[1.55] text-neutral-600">
              Wklejasz stronę — narzędzie rozumie ofertę i pomaga przejść od briefu do gotowych
              materiałów bez rozdzielania pracy na wiele aplikacji.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              <Link
                to="/auth"
                onClick={() => sfx.success()}
                className="inline-flex items-center justify-center border border-neutral-950 bg-neutral-950 text-white px-7 py-3.5 text-[12px] md:text-[13px] font-semibold uppercase tracking-[0.12em] hover:bg-white hover:text-neutral-950 transition-colors text-center"
              >
                Rozpocznij za darmo
              </Link>
            </div>
            <p className="mt-8 text-[11px] md:text-[12px] uppercase tracking-[0.16em] text-neutral-500">
              Reklamy · Hooki · Konkurencja · SEO · Maile · Kalendarz · Widoczność w AI
            </p>
            <div className="mt-8 max-w-lg mx-auto lg:mx-0 rounded-2xl bg-zinc-950 p-3 sm:p-5 ring-1 ring-zinc-800/90 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.35)]">
              <img
                src="/tablet-marketingnow-hero.png"
                alt="MarketingNow — panel aplikacji na tablecie"
                width={1200}
                height={1200}
                loading="lazy"
                decoding="async"
                className="w-full h-auto object-contain"
              />
            </div>
          </div>

          <div className="lg:col-span-6 xl:col-span-7 relative">
            <GrowthFeatureBlocks ctaTo="/auth" />
          </div>
        </div>
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
            Nie kolejne narzędzie do pisania tekstów.{" "}
            <span className="italic font-light">Cały marketing w jednym workflow.</span>
          </h2>
          <p className="mt-6 text-[16px] md:text-[17px] leading-[1.6] text-neutral-700">
            MarketingNow łączy strategię, reklamy, hooki, analizę konkurencji, SEO, maile, kalendarz
            działań i widoczność w AI. Przechodzisz od pomysłu do gotowych materiałów bez
            rozdzielania pracy na wiele narzędzi.
          </p>
          <p className="mt-6 text-[16px] md:text-[17px] leading-[1.6] text-neutral-800 font-medium">
            Wklejasz stronę — narzędzie rozumie ofertę i pomaga zamienić ją w kampanie reklamowe,
            treści, sekwencje maili i plan publikacji.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================== CO MOŻESZ OBSŁUŻYĆ ============================== */
function WhatYouHandle() {
  const items: { id: string; title: string; body: string }[] = [
    {
      id: "obs-kampanie",
      title: "Kampanie reklamowe",
      body: "Planuj kampanie reklamowe end-to-end: struktura, kreacje, grupy odbiorców, komunikaty i testy — bez rozdrabniania na pojedyncze sieci.",
    },
    {
      id: "obs-hooki",
      title: "Hooki i pomysły",
      body: "Generuj hooki, warianty pierwszego kontaktu, kąty narracji i pomysły kreatywne pod reklamy, treści organiczne i landing page’e.",
    },
    {
      id: "obs-konkurencja",
      title: "Analiza konkurencji",
      body: "Zbieraj wnioski o konkurentach: przekazy, oferty, mocne i słabe strony komunikacji — jako podstawa pod strategię i kreacje.",
    },
    {
      id: "obs-seo",
      title: "SEO",
      body: "Tematy artykułów, struktury stron, opisy usług, treści pod intencje, meta title, meta description i briefy contentowe.",
    },
    {
      id: "obs-email",
      title: "Email marketing",
      body: "Newslettery, sekwencje sprzedażowe, follow-upy, maile onboardingowe i komunikacja posprzedażowa.",
    },
    {
      id: "obs-kalendarz",
      title: "Kalendarz marketingowy",
      body: "Harmonogram kampanii, publikacji, maili, promocji i launchy — jeden widok zamiast rozstrzelonych arkuszy.",
    },
    {
      id: "obs-llm",
      title: "Widoczność w AI",
      body: "Sprawdzaj, czy marka i oferta są jasno opisane dla modeli AI i co poprawić, żeby były częściej obecne w odpowiedziach asystentów.",
    },
    {
      id: "obs-kreacje",
      title: "Kreacje i materiały wizualne",
      body: "Warianty kreacji reklamowych, grafiki pod kanały, key visual w kilku formatach i spójne nagłówki — bez przeskakiwania między osobnymi narzędziami do copy i do obrazów.",
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
          {items.map((it) => (
            <li
              key={it.title}
              id={it.id}
              className="bg-white p-8 md:p-10 hover:bg-neutral-50/90 transition-colors scroll-mt-32"
            >
              <h3 className="serif text-[22px] md:text-[26px] tracking-tight text-neutral-950 mb-4">
                {it.title}
              </h3>
              <p className="text-[14px] md:text-[15px] leading-[1.65] text-neutral-700">
                {it.body}
              </p>
            </li>
          ))}
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 max-w-4xl">
          <p className="text-[12px] uppercase tracking-[0.18em] text-neutral-500">Rozliczenie</p>
          <BillingPeriodToggle yearly={yearly} onChange={setYearly} variant="landing" discountPct={pctOff} />
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
