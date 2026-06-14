import type { ReactNode } from "react";
import { ChevronDown, LayoutGrid, List, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearFilterKey,
  DEFAULT_VIRAL_FILTERS,
  getActiveFilterTags,
  type ViralSearchFilters,
  type ViralSortBy,
} from "@/lib/viralFilters";
type Props = {
  filters: ViralSearchFilters;
  onChange: (next: ViralSearchFilters) => void;
  resultCount: number;
  layout: "grid" | "list";
  onLayoutChange: (l: "grid" | "list") => void;
};

function FilterPill({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            active
              ? "border-emerald-600/40 bg-emerald-50 text-emerald-900"
              : "border-border bg-muted/30 text-foreground hover:bg-muted/60"
          }`}
        >
          {label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 space-y-3">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={0}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === "" ? null : Math.max(0, Number(raw)));
        }}
        className="h-8 text-sm"
      />
    </div>
  );
}

export function ViralFiltersBar({ filters, onChange, resultCount, layout, onLayoutChange }: Props) {
  const tags = getActiveFilterTags(filters);
  const patch = (partial: Partial<ViralSearchFilters>) => onChange({ ...filters, ...partial });

  const toggleMedia = (m: "video" | "image" | "carousel") => {
    const set = new Set(filters.mediaTypes);
    if (set.has(m)) set.delete(m);
    else set.add(m);
    patch({ mediaTypes: [...set] });
  };

  const sortLabels: Record<ViralSortBy, string> = {
    relevance: "Trafność",
    views: "Wyświetlenia",
    likes: "Polubienia",
    engagement: "Zaangażowanie",
    recent: "Najnowsze",
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mr-1">
          Filtry
        </span>

        <FilterPill label="Typ media" active={filters.mediaTypes.length > 0}>
          <p className="text-xs text-muted-foreground mb-2">Format publikacji (gdy API zwraca typ)</p>
          {(
            [
              ["video", "Wideo"],
              ["image", "Obraz"],
              ["carousel", "Karuzela"],
            ] as const
          ).map(([id, lab]) => (
            <label key={id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
              <Checkbox checked={filters.mediaTypes.includes(id)} onCheckedChange={() => toggleMedia(id)} />
              {lab}
            </label>
          ))}
        </FilterPill>

        <FilterPill
          label="Wyświetlenia"
          active={filters.minViews != null || filters.maxViews != null}
        >
          <NumField label="Minimum" value={filters.minViews} onChange={(v) => patch({ minViews: v })} placeholder="np. 10000" />
          <NumField label="Maksimum" value={filters.maxViews} onChange={(v) => patch({ maxViews: v })} />
        </FilterPill>

        <FilterPill label="Polubienia" active={filters.minLikes != null || filters.maxLikes != null}>
          <NumField label="Minimum" value={filters.minLikes} onChange={(v) => patch({ minLikes: v })} placeholder="np. 500" />
          <NumField label="Maksimum" value={filters.maxLikes} onChange={(v) => patch({ maxLikes: v })} />
        </FilterPill>

        <FilterPill label="Wiek publikacji" active={filters.minAgeDays != null || filters.maxAgeDays != null}>
          <NumField
            label="Min. dni temu (starsze)"
            value={filters.minAgeDays}
            onChange={(v) => patch({ minAgeDays: v })}
            placeholder="np. 10"
          />
          <NumField
            label="Max. dni temu (świeższe)"
            value={filters.maxAgeDays}
            onChange={(v) => patch({ maxAgeDays: v })}
            placeholder="np. 30"
          />
        </FilterPill>

        <FilterPill
          label="Długość wideo"
          active={filters.minDurationSec != null || filters.maxDurationSec != null}
        >
          <NumField
            label="Min. sekund"
            value={filters.minDurationSec}
            onChange={(v) => patch({ minDurationSec: v })}
            placeholder="np. 5"
          />
          <NumField
            label="Max. sekund"
            value={filters.maxDurationSec}
            onChange={(v) => patch({ maxDurationSec: v })}
            placeholder="np. 60"
          />
        </FilterPill>

        <FilterPill
          label="Długość opisu"
          active={filters.minCaptionLen != null || filters.maxCaptionLen != null}
        >
          <NumField
            label="Min. znaków"
            value={filters.minCaptionLen}
            onChange={(v) => patch({ minCaptionLen: v })}
          />
          <NumField
            label="Max. znaków"
            value={filters.maxCaptionLen}
            onChange={(v) => patch({ maxCaptionLen: v })}
          />
        </FilterPill>

        <FilterPill label="Słowo w opisie" active={!!filters.captionKeyword.trim()}>
          <Input
            value={filters.captionKeyword}
            onChange={(e) => patch({ captionKeyword: e.target.value })}
            placeholder="np. hook, tutorial, AI"
            className="h-8 text-sm"
          />
        </FilterPill>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/80">
        <Select value={filters.sortBy} onValueChange={(v) => patch({ sortBy: v as ViralSortBy })}>
          <SelectTrigger className="h-8 w-[140px] rounded-full text-xs font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(sortLabels) as ViralSortBy[]).map((k) => (
              <SelectItem key={k} value={k}>
                {sortLabels[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tags.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(clearFilterKey(filters, t.key))}
            className="inline-flex items-center gap-1 rounded-full bg-background border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            {t.label}
            <X className="h-3 w-3 opacity-50" />
          </button>
        ))}

        <span className="text-xs text-muted-foreground tabular-nums ml-auto">
          {resultCount} wynik{resultCount === 1 ? "" : resultCount < 5 ? "i" : "ów"}
        </span>

        {tags.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-destructive hover:text-destructive"
            onClick={() => onChange({ ...DEFAULT_VIRAL_FILTERS, sortBy: filters.sortBy })}
          >
            Wyczyść filtry
          </Button>
        ) : null}

        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            title="Siatka"
            onClick={() => onLayoutChange("grid")}
            className={`p-1.5 ${layout === "grid" ? "bg-foreground text-background" : "bg-background hover:bg-muted"}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Lista"
            onClick={() => onLayoutChange("list")}
            className={`p-1.5 ${layout === "list" ? "bg-foreground text-background" : "bg-background hover:bg-muted"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        <SlidersHorizontal className="h-4 w-4 text-muted-foreground hidden sm:block" aria-hidden />
      </div>
    </div>
  );
}
