import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
};

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  size?: "sm" | "md";
  /** Styl strony głównej (monochrom) vs panel aplikacji */
  variant?: "landing" | "app";
  /** Rozciąga kontrolkę na całą szerokość z równymi segmentami (dobre na telefonie) */
  fluid?: boolean;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  variant = "app",
  fluid = false,
}: Props<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const count = options.length;
  const segmentPct = 100 / count;

  const shell =
    variant === "landing"
      ? "border-neutral-200 bg-white shadow-sm"
      : "border-border bg-muted/45 shadow-inner";

  const indicator =
    variant === "landing"
      ? "bg-neutral-950 shadow-md"
      : "bg-foreground shadow-sm";

  const activeText = variant === "landing" ? "text-white" : "text-background";
  const inactiveText =
    variant === "landing" ? "text-neutral-600 hover:text-neutral-950" : "text-muted-foreground hover:text-foreground";

  const pad = size === "sm" ? "p-0.5" : "p-1";
  const btnPad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  return (
    <div
      role="tablist"
      className={cn(
        "relative rounded-full border",
        fluid ? "flex w-full" : "inline-flex",
        pad,
        shell,
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1 bottom-1 rounded-full transition-[left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          indicator,
        )}
        style={{
          width: `calc(${segmentPct}% - 4px)`,
          left: `calc(${activeIndex * segmentPct}% + 2px)`,
        }}
      />
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 rounded-full font-semibold transition-colors duration-200",
              fluid ? "flex-1 min-w-0 text-center" : "min-w-[5.5rem]",
              btnPad,
              selected ? activeText : inactiveText,
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Miesięcznie / rocznie (−10%) — cennik i billing */
export function BillingPeriodToggle({
  yearly,
  onChange,
  variant = "app",
  className,
  discountPct = 10,
  fluid = false,
}: {
  yearly: boolean;
  onChange: (yearly: boolean) => void;
  variant?: "landing" | "app";
  className?: string;
  discountPct?: number;
  fluid?: boolean;
}) {
  return (
    <SegmentedControl
      variant={variant}
      fluid={fluid}
      className={className}
      value={yearly ? "yearly" : "monthly"}
      onChange={(v) => onChange(v === "yearly")}
      options={[
        { value: "monthly", label: "Miesięcznie" },
        {
          value: "yearly",
          label: (
            <span className="inline-flex items-center gap-1.5">
              Rocznie
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shrink-0",
                  yearly
                    ? variant === "landing"
                      ? "bg-white/20 text-white"
                      : "bg-background/20 text-background"
                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                )}
              >
                −{discountPct}%
              </span>
            </span>
          ),
        },
      ]}
    />
  );
}
