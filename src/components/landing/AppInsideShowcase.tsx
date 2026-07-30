import { Link } from "@tanstack/react-router";
import { sfx } from "@/lib/sounds";

/** Sekcja DNA marki — zamiast screena tabletu / panelu. */
export function AppInsideShowcase() {
  return (
    <section id="panel" className="border-b border-neutral-200 bg-neutral-50 scroll-mt-24 sm:scroll-mt-28">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 md:px-10 py-12 sm:py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-3">
            DNA Twojej firmy
          </p>
          <h2 className="serif text-[clamp(1.7rem,5.5vw,3.1rem)] leading-[1.08] tracking-[-0.02em] text-balance text-neutral-950">
            Platforma, która zapamiętuje DNA Twojej firmy.
          </h2>
          <p className="mt-4 text-[15px] sm:text-[16px] leading-relaxed text-neutral-600">
            Po założeniu konta uzupełniasz dane marki raz — skanujemy Twoją stronę, zapisujemy kolory, ton i
            ofertę jako Twój brand. Potem MarketingNow korzysta z tego w każdej kampanii, treści i grafice.
          </p>
        </div>

        <div className="mx-auto mt-10 sm:mt-12 max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {[
            {
              step: "01",
              title: "Uzupełnij markę",
              body: "Nazwa, strona WWW i kolory — popup po rejestracji prowadzi Cię przez pierwszy setup.",
            },
            {
              step: "02",
              title: "Skanujemy stronę",
              body: "Automatycznie wyciągamy opis, branżę i kontekst oferty, żebyś nie wpisywał wszystkiego ręcznie.",
            },
            {
              step: "03",
              title: "Zapamiętujemy DNA",
              body: "Brand zostaje w workspace — agent i kampanie korzystają z niego przy każdym kolejnym zadaniu.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-neutral-200 bg-white px-5 py-6 text-left shadow-[0_8px_24px_-18px_rgba(0,0,0,0.25)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-400">{item.step}</p>
              <h3 className="mt-3 text-[17px] font-semibold tracking-tight text-neutral-950">{item.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 sm:mt-10 flex justify-center">
          <Link
            to="/auth"
            onClick={() => sfx.success()}
            className="inline-flex w-full sm:w-auto items-center justify-center border border-neutral-950 bg-neutral-950 text-white px-6 py-3.5 text-[12px] font-semibold uppercase tracking-[0.12em] hover:bg-white hover:text-neutral-950 transition-colors touch-manipulation"
          >
            Załóż konto i uzupełnij DNA marki
          </Link>
        </div>
      </div>
    </section>
  );
}
