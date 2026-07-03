import { Search, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Props = {
  placeholder: string;
  ctaLabel: string;
  /** Domyślnie /agent (np. galeria obrazów). Na stronie wideo użyj onCtaClick. */
  ctaTo?: string;
  /** Gdy podane — przycisk CTA nie nawiguje, tylko wywołuje akcję (np. przewiń do formularza). */
  onCtaClick?: () => void;
};

export function AssetsToolbar({ placeholder, ctaLabel, ctaTo = "/agent", onCtaClick }: Props) {
  const ctaClass =
    "ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all shadow-elevated";

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder={placeholder}
          className="w-full rounded-full border border-border bg-surface-elevated pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <select className="rounded-full border border-border bg-surface-elevated px-4 py-2.5 text-sm">
        <option>Najnowsze</option>
        <option>Najstarsze</option>
      </select>
      {onCtaClick ? (
        <button type="button" onClick={onCtaClick} className={ctaClass}>
          <Plus className="h-4 w-4" /> {ctaLabel}
        </button>
      ) : (
        <Link to={ctaTo} className={ctaClass}>
          <Plus className="h-4 w-4" /> {ctaLabel}
        </Link>
      )}
    </div>
  );
}
