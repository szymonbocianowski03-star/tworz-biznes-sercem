import { Link } from "@tanstack/react-router";
import { sfx } from "@/lib/sounds";

/** Podgląd panelu — bez powtórzonej listy możliwości (jest niżej w sekcji Zakres). */
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

        <figure className="mx-auto max-w-5xl overflow-hidden rounded-xl sm:rounded-2xl border border-neutral-200 bg-white shadow-[0_16px_40px_-20px_rgba(0,0,0,0.2)]">
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

        <div className="mt-8 flex justify-center">
          <Link
            to="/auth"
            onClick={() => sfx.success()}
            className="inline-flex w-full sm:w-auto items-center justify-center border border-neutral-950 bg-neutral-950 text-white px-6 py-3.5 text-[12px] font-semibold uppercase tracking-[0.12em] hover:bg-white hover:text-neutral-950 transition-colors touch-manipulation"
          >
            Wejdź do panelu
          </Link>
        </div>
      </div>
    </section>
  );
}
