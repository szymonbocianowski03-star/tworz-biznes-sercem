export type ZasobyReactionFilterValue = "all" | "like" | "dislike";

const labels: Record<ZasobyReactionFilterValue, string> = {
  all: "Wszystkie",
  like: "Polubione",
  dislike: "Nielubiane",
};

export function ZasobyReactionFilter({
  value,
  onChange,
}: {
  value: ZasobyReactionFilterValue;
  onChange: (v: ZasobyReactionFilterValue) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {(Object.keys(labels) as ZasobyReactionFilterValue[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === k
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground"
          }`}
        >
          {labels[k]}
        </button>
      ))}
    </div>
  );
}
