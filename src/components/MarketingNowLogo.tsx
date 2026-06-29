import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Domyślnie link do strony głównej; `null` = sam tekst */
  to?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "text-[16px]",
  md: "text-[20px]",
  lg: "text-[clamp(1.35rem,2.5vw,1.65rem)]",
} as const;

export function MarketingNowLogo({ className, to = "/", size = "md" }: Props) {
  const classes = cn(
    "serif tracking-tight leading-none font-normal text-inherit hover:opacity-80 transition-opacity",
    sizeClasses[size],
    className,
  );

  if (to === null) {
    return <span className={classes}>MarketingNow</span>;
  }

  return (
    <Link to={to} className={classes}>
      MarketingNow
    </Link>
  );
}
