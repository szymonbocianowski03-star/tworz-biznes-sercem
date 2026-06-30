import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  desc: string;
  ctaLabel: string;
  ctaTo?: string;
  onCta?: () => void;
};

export function AssetsEmpty({ icon: Icon, title, desc, ctaLabel, ctaTo = "/agent" }: Props) {
  return (
    <div className="relative mt-10 rounded-3xl border border-border bg-surface-elevated overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)] pointer-events-none" />
      <div className="relative px-6 py-20 md:py-24 text-center">
        <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-muted to-surface border border-border shadow-soft flex items-center justify-center">
          <Icon className="h-9 w-9 text-foreground/70" />
        </div>
        <h3 className="mt-7 text-2xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">{desc}</p>
        <Link
          to={ctaTo}
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all shadow-elevated"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}