import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { sfx } from "@/lib/sounds";

type Props = {
  ctaTo?: string;
};

type FeatureBlock = {
  id: string;
  title: string;
  description: string;
  businessEffect: string;
};

/** Obszary działania — reklamy są scalone w jeden blok „Ads" (Meta, LinkedIn, Google, TikTok). */
const FEATURE_BLOCKS: FeatureBlock[] = [
  {
    id: "ads",
    title: "Ads",
    description:
      "Jedno miejsce do planowania kampanii reklamowych w wielu sieciach — planowane: Meta Ads, LinkedIn Ads, Google Ads i TikTok Ads. MarketingNow pomaga tworzyć kreacje, dobierać grupy odbiorców i testować warianty.",
    businessEffect: "Więcej leadów przy niższym koszcie pozyskania i spójna komunikacja we wszystkich sieciach.",
  },
  {
    id: "shorts",
    title: "Virale",
    description:
      "Hooki, szkielety i dopasowanie formatu pod Reels, Shorts, TikTok i inne krótkie formy — żeby publikować szybciej i uczyć się z danych, a nie zgadywać.",
    businessEffect:
      "Częstsze publikacje i więcej sensownych iteracji pod zasięg i konwersję w tym samym oknie czasowym.",
  },
  {
    id: "seo",
    title: "SEO",
    description:
      "MarketingNow łączy intencję wyszukiwania z treścią i technikalia: propozycje podstron, nagłówków, fraz i struktur pod widoczność organiczną.",
    businessEffect: "Trwalszy ruch z wyszukiwarki i niższa zależność wyłącznie od płatnych klików.",
  },
  {
    id: "mailing",
    title: "Mailing",
    description:
      "Tworzysz sekwencje maili i follow-upy z jasnym CTA — dopasowane do etapu lejka i kontekstu oferty, bez ręcznego przepisywania tych samych schematów.",
    businessEffect: "Więcej uporządkowanych touchpointów z leadami i bazą.",
  },
  {
    id: "calendar",
    title: "Kalendarz",
    description:
      "Jeden widok harmonogramu publikacji, kampanii i działań follow-up z priorytetami pod sprzedaż — mniej chaosu, więcej trafionych momentów kontaktu.",
    businessEffect: "Przewidywalny rytm marketingu i mniej „zgubionych" okazji do konwersji.",
  },
  {
    id: "llm",
    title: "Widoczność AI",
    description:
      "MarketingNow sprawdza, czy Twoja marka pojawia się w ChatGPT, Gemini, Perplexity i Google AI Overviews. Następnie pokazuje, gdzie konkurencja ma przewagę i generuje konkretne działania, które zwiększają Twoją obecność w nowych kanałach wyszukiwania.",
    businessEffect:
      "Większa widoczność marki, więcej zapytań i przewaga zanim konkurencja zdąży zareagować.",
  },
  {
    id: "more",
    title: "I wiele więcej",
    description:
      "Poza tymi kanałami MarketingNow scala strategię, kreacje, analizę, automatyzację maili, kalendarz działań i kolejne integracje w jednym workflow.",
    businessEffect: "Mniej rozproszenia narzędziami, szybsze wdrożenia i większa skala przy tym samym zespole.",
  },
];

/**
 * Zamiennik „koła wzrostu" — proste, klikalne bloki z obszarami działania
 * (Ads, SEO, Widoczność w AI itd.). Wybór bloku pokazuje szczegóły poniżej.
 */
export function GrowthFeatureBlocks({ ctaTo = "/auth" }: Props) {
  const [activeId, setActiveId] = useState<string>(
    FEATURE_BLOCKS.find((s) => s.id === "llm")?.id ?? FEATURE_BLOCKS[0].id,
  );
  const active = FEATURE_BLOCKS.find((s) => s.id === activeId) ?? FEATURE_BLOCKS[0];

  return (
    <div className="w-full">
      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-4">
        Wybierz obszar
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-neutral-300 border border-neutral-300">
        {FEATURE_BLOCKS.map((seg) => {
          const selected = seg.id === active.id;
          return (
            <button
              key={seg.id}
              type="button"
              onClick={() => {
                setActiveId(seg.id);
                sfx.chime();
              }}
              aria-pressed={selected}
              className={`min-h-[64px] px-3 py-4 text-left transition-colors ${
                selected
                  ? "bg-neutral-950 text-white"
                  : "bg-white text-neutral-900 hover:bg-neutral-50"
              }`}
            >
              <span className="block text-[13px] md:text-[14px] font-semibold leading-tight tracking-tight">
                {seg.title}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 border border-neutral-200 bg-white p-6 md:p-8">
        <h3 className="serif text-[24px] md:text-[28px] tracking-tight text-neutral-950">
          {active.title}
        </h3>
        <p className="mt-4 text-[14px] md:text-[15px] leading-[1.65] text-neutral-700">
          {active.description}
        </p>
        <p className="mt-5 pt-5 border-t border-neutral-200 text-[13px] md:text-[14px] leading-[1.6] text-neutral-900">
          <span className="uppercase tracking-[0.14em] text-[11px] text-neutral-500 block mb-1.5">
            Efekt dla biznesu
          </span>
          {active.businessEffect}
        </p>
        <Link
          to={ctaTo}
          onClick={() => sfx.success()}
          className="mt-6 inline-flex items-center justify-center border border-neutral-950 bg-neutral-950 text-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] hover:bg-white hover:text-neutral-950 transition-colors"
        >
          Rozpocznij za darmo
        </Link>
      </div>
    </div>
  );
}