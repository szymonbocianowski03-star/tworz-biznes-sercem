import { useId } from "react";

/** Serce w barwach flagi Polski (biel / czerwień). */
export function PolandHeart({ className = "h-5 w-5" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const clipId = `pl-heart-${uid}`;
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <path d="M16 28.2C7.2 21.4 2.5 16.6 2.5 10.9 2.5 6.7 5.7 3.5 10 3.5c2.4 0 4.6 1.1 6 2.9 1.4-1.8 3.6-2.9 6-2.9 4.3 0 7.5 3.2 7.5 7.4 0 5.7-4.7 10.5-13.5 17.3z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="32" height="16" fill="#FFFFFF" />
        <rect x="0" y="16" width="32" height="16" fill="#DC143C" />
      </g>
      <path
        d="M16 28.2C7.2 21.4 2.5 16.6 2.5 10.9 2.5 6.7 5.7 3.5 10 3.5c2.4 0 4.6 1.1 6 2.9 1.4-1.8 3.6-2.9 6-2.9 4.3 0 7.5 3.2 7.5 7.4 0 5.7-4.7 10.5-13.5 17.3z"
        fill="none"
        stroke="rgba(0,0,0,0.12)"
        strokeWidth="1"
      />
    </svg>
  );
}

export function PolandFirmBadge({
  className = "",
  dark = false,
}: {
  className?: string;
  /** Wariant na ciemnym tle (np. górny pasek). */
  dark?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium shadow-sm ${
        dark
          ? "border-white/20 bg-white/10 text-white"
          : "border-neutral-200 bg-white text-neutral-800"
      } ${className}`}
    >
      <PolandHeart className="h-[18px] w-[18px] shrink-0" />
      <span>Polski produkt — wspierasz polską gospodarkę</span>
    </span>
  );
}

/** Oficjalne logo Google Ads (ikona + napis). */
export function GoogleAdsBrand({
  className = "",
  invert = false,
}: {
  className?: string;
  /** Jaśniejszy napis na ciemnym tle */
  invert?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
      <img
        src="/google-ads-icon.svg"
        alt=""
        width={40}
        height={40}
        className="h-9 w-9 sm:h-10 sm:w-10 shrink-0"
        decoding="async"
      />
      <span className="min-w-0 leading-tight">
        <span
          className={`block text-[15px] sm:text-[16px] font-semibold tracking-tight ${
            invert ? "text-white" : "text-[#202124]"
          }`}
        >
          Google Ads
        </span>
        <span className={`block text-[11px] ${invert ? "text-white/50" : "text-neutral-500"}`}>
          w MarketingNow
        </span>
      </span>
    </span>
  );
}
