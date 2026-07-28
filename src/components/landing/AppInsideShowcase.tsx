import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  Eye,
  Mail,
  Megaphone,
  Search,
  Sparkles,
} from "lucide-react";
import { sfx } from "@/lib/sounds";

const CAPABILITIES = [
  { icon: Megaphone, label: "Kampanie Google Ads, Meta, TikTok, LinkedIn" },
  { icon: Sparkles, label: "Czat AI i podpowiedzi tekstów reklam" },
  { icon: Mail, label: "Maile i kalendarz w jednym miejscu" },
  { icon: Search, label: "SEO i analiza konkurencji" },
  { icon: Eye, label: "Widoczność marki w odpowiedziach AI" },
  { icon: BarChart3, label: "Raporty, zasoby i panel kampanii" },
  { icon: CalendarDays, label: "Plan publikacji i harmonogram działań" },
] as const;

/** Podgląd panelu + co możesz zrobić w aplikacji. */
export function AppInsideShowcase() {
  return (
    <section id="panel" className="border-b border-neutral-200 bg-neutral-50 scroll-mt-24 sm:scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-24">
        <div className="mb-8 sm:mb-10 md:mb-12 max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
            Panel od środka
          </p>
          <h2 className="serif text-[clamp(1.7rem,5.5vw,3.1rem)] leading-[1.08] tracking-[-0.02em] text-balance text-neutral-950">
            Tak wygląda praca w MarketingNow — i to możesz zrobić od razu.
          </h2>
          <p className="mt-4 text-[15px] sm:text-[16px] leading-relaxed text-neutral-600">
            Od ekranu „Od czego zaczynamy?” przez kampanie reklamowe, treści, maile i raporty — wszystko w jednym
            workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <div className="lg:col-span-7">
            <figure className="overflow-hidden rounded-xl sm:rounded-2xl border border-neutral-200 bg-white shadow-[0_16px_40px_-20px_rgba(0,0,0,0.2)]">
              <img
                src="/marketingnow-app-interior.png"
                alt="Panel MarketingNow — Od czego zaczynamy, propozycje i czat AI"
                width={1600}
                height={1000}
                loading="lazy"
                decoding="async"
                className="w-full h-auto object-cover object-top"
              />
              <figcaption className="border-t border-neutral-100 px-4 py-2.5 text-[12px] text-neutral-500">
                Widok startowy: propozycje działań i czat AI
              </figcaption>
            </figure>
          </div>

          <div className="lg:col-span-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500 mb-4">
              Co możesz zrobić
            </p>
            <ul className="space-y-2.5">
              {CAPABILITIES.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-3 sm:px-4"
                >
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="text-[14px] leading-snug text-neutral-800 pt-1.5">{label}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              onClick={() => sfx.success()}
              className="mt-6 inline-flex w-full sm:w-auto items-center justify-center border border-neutral-950 bg-neutral-950 text-white px-6 py-3.5 text-[12px] font-semibold uppercase tracking-[0.12em] hover:bg-white hover:text-neutral-950 transition-colors touch-manipulation"
            >
              Wejdź do panelu
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
