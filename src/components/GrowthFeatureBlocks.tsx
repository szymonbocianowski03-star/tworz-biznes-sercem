import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { sfx } from "@/lib/sounds";
import { GROWTH_SEGMENTS } from "@/components/GrowthSalesWheel";

type Props = {
  ctaTo?: string;
};

/**
 * Zamiennik „koła wzrostu" — proste, klikalne bloki z obszarami działania
 * (Meta Ads, SEO, Widoczność w AI itd.). Wybór bloku pokazuje szczegóły poniżej.
 */
export function GrowthFeatureBlocks({ ctaTo = "/auth" }: Props) {
  const [activeId, setActiveId] = useState<string>(
    GROWTH_SEGMENTS.find((s) => s.id === "llm")?.id ?? GROWTH_SEGMENTS[0].id,
  );
  const active = GROWTH_SEGMENTS.find((s) => s.id === activeId) ?? GROWTH_SEGMENTS[0];

  return (
    <div className="w-full">
      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-4">
        Wybierz obszar
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-neutral-300 border border-neutral-300">
        {GROWTH_SEGMENTS.map((seg) => {
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