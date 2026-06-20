import { forwardRef } from "react";
import { Check } from "lucide-react";
import { type AdCreative, type AdLayout, FORMAT_DIMENSIONS } from "@/lib/adComposer/types";

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full || "8b5cf6", 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Helper = (hex: string, alpha: number) => string;

interface Props {
  creative: AdCreative;
}

/**
 * Składa finalną reklamę z warstw:
 * 1. background image (AI, bez napisów)
 * 2. main visual / mockup (programowy telefon)
 * 3. headline, subheadline, CTA, price, brand, badges (prawdziwa typografia)
 */
export const AdCanvas = forwardRef<HTMLDivElement, Props>(function AdCanvas({ creative }, ref) {
  const dims = FORMAT_DIMENSIONS[creative.format] ?? FORMAT_DIMENSIONS["9:16"];
  const { style } = creative;
  const scrimStrength = creative.suppressEmbeddedText ? 0.55 : 0.35;

  return (
    <div
      ref={ref}
      style={{
        width: dims.w,
        height: dims.h,
        position: "relative",
        overflow: "hidden",
        borderRadius: 20,
        background: `linear-gradient(160deg, ${style.bgFrom}, ${style.bgTo})`,
        fontFamily: "'Inter', system-ui, sans-serif",
        color: style.text,
        flexShrink: 0,
      }}
    >
      {creative.backgroundUrl && (
        <img
          src={creative.backgroundUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: creative.suppressEmbeddedText ? 0.72 : 0.85,
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(5,7,15,${scrimStrength}) 0%, rgba(5,7,15,${scrimStrength * 0.45}) 40%, rgba(5,7,15,${scrimStrength + 0.35}) 100%)`,
        }}
      />

      {style.glow && (
        <div
          style={{
            position: "absolute",
            top: "18%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "75%",
            height: "45%",
            background: `radial-gradient(circle, ${hexToRgba(style.accent, 0.45)} 0%, rgba(0,0,0,0) 70%)`,
            filter: "blur(8px)",
          }}
        />
      )}

      <LayoutRenderer creative={creative} rgba={hexToRgba} />
    </div>
  );
});

function LayoutRenderer({ creative, rgba }: { creative: AdCreative; rgba: Helper }) {
  switch (creative.layout) {
    case "text-left-visual-right":
      return <SplitLayout creative={creative} rgba={rgba} textSide="left" />;
    case "visual-left-text-right":
      return <SplitLayout creative={creative} rgba={rgba} textSide="right" />;
    case "center-mockup-bubbles":
      return <BubbleLayout creative={creative} rgba={rgba} />;
    case "price-cta-focus":
      return <PriceCtaLayout creative={creative} rgba={rgba} />;
    case "poster-headline":
      return <PosterLayout creative={creative} rgba={rgba} />;
    case "headline-top-cta-bottom":
    default:
      return <TopBottomLayout creative={creative} rgba={rgba} />;
  }
}

/* ─── Wspólne warstwy tekstowe ─── */

function BrandBadge({ copy, style, rgba }: { copy: AdCreative["copy"]; style: AdCreative["style"]; rgba: Helper }) {
  if (!copy.brand_name) return null;
  return (
    <div
      style={{
        display: "inline-flex",
        alignSelf: "flex-start",
        background: `linear-gradient(135deg, ${rgba(style.accent, 0.95)}, ${rgba(style.accent, 0.6)})`,
        padding: "6px 14px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 13,
        boxShadow: `0 8px 22px ${rgba(style.accent, 0.45)}`,
      }}
    >
      {copy.brand_name}
    </div>
  );
}

function Headline({ text, size = 26, centered = false }: { text: string; size?: number; centered?: boolean }) {
  if (!text) return null;
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 800,
        lineHeight: 1.1,
        letterSpacing: -0.5,
        textAlign: centered ? "center" : "left",
        textShadow: "0 2px 12px rgba(0,0,0,0.55)",
      }}
    >
      {text}
    </div>
  );
}

function Subheadline({ text, centered = false }: { text: string; centered?: boolean }) {
  if (!text) return null;
  return (
    <div style={{ fontSize: 14, opacity: 0.88, marginTop: 8, textAlign: centered ? "center" : "left", lineHeight: 1.35 }}>
      {text}
    </div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      {items.slice(0, 6).map((it, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              width: 20,
              height: 20,
              borderRadius: 999,
              background: "#22c55e",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Check size={12} color="#06210f" strokeWidth={3.5} />
          </span>
          {it}
        </div>
      ))}
    </div>
  );
}

function BadgeList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
      {items.slice(0, 5).map((b, i) => (
        <div
          key={i}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 999,
            padding: "5px 10px 5px 6px",
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              width: 16,
              height: 16,
              borderRadius: 999,
              background: "#22c55e",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={11} color="#06210f" strokeWidth={3.5} />
          </span>
          {b}
        </div>
      ))}
    </div>
  );
}

function CtaPrice({ copy, style, rgba, large }: { copy: AdCreative["copy"]; style: AdCreative["style"]; rgba: Helper; large?: boolean }) {
  if (!copy.cta && !copy.price) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
      {copy.cta && (
        <div
          style={{
            background: `linear-gradient(135deg, ${rgba(style.accent, 1)}, ${rgba(style.accent, 0.7)})`,
            padding: large ? "13px 26px" : "10px 20px",
            borderRadius: 999,
            fontWeight: 800,
            fontSize: large ? 17 : 14,
            boxShadow: `0 10px 26px ${rgba(style.accent, 0.5)}`,
          }}
        >
          {copy.cta}
        </div>
      )}
      {copy.price && (
        <div style={{ fontSize: large ? 28 : 16, fontWeight: 800, letterSpacing: -0.5 }}>{copy.price}</div>
      )}
    </div>
  );
}

function Disclaimer({ text }: { text: string }) {
  if (!text) return null;
  return <div style={{ fontSize: 9.5, opacity: 0.6, marginTop: 8 }}>{text}</div>;
}

function PhoneMockup({
  creative,
  rgba,
  compact,
}: {
  creative: AdCreative;
  rgba: Helper;
  compact?: boolean;
}) {
  const { copy, style } = creative;
  const w = compact ? 150 : 188;

  return (
    <div
      style={{
        width: w,
        background: "rgba(10,12,22,0.72)",
        border: `1px solid ${rgba(style.accent, 0.5)}`,
        borderRadius: 28,
        padding: 12,
        boxShadow: `0 18px 50px rgba(0,0,0,0.55), 0 0 40px ${rgba(style.accent, 0.35)}`,
        backdropFilter: "blur(4px)",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <div style={{ width: 46, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.25)" }} />
      </div>
      {copy.user_message && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <div
            style={{
              maxWidth: "85%",
              background: "rgba(255,255,255,0.12)",
              padding: "8px 11px",
              borderRadius: "14px 14px 4px 14px",
              fontSize: 11,
              lineHeight: 1.35,
            }}
          >
            {copy.user_message}
          </div>
        </div>
      )}
      {copy.ai_response && (
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <div
            style={{
              maxWidth: "92%",
              background: `linear-gradient(135deg, ${rgba(style.accent, 0.92)}, ${rgba(style.accent, 0.65)})`,
              padding: "9px 12px",
              borderRadius: "14px 14px 14px 4px",
              fontSize: 11,
              lineHeight: 1.4,
              fontWeight: 500,
            }}
          >
            {copy.brand_name && <span style={{ fontWeight: 800 }}>{copy.brand_name}</span>}
            {copy.brand_name && copy.ai_response ? " — " : ""}
            {copy.ai_response}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Layout: headline top, CTA bottom ─── */

function TopBottomLayout({ creative, rgba }: { creative: AdCreative; rgba: Helper }) {
  const { copy, style } = creative;
  const items = copy.features.length ? copy.features : copy.side_badges;

  return (
    <div style={{ position: "absolute", inset: 0, padding: "24px 22px", display: "flex", flexDirection: "column" }}>
      <div style={{ textAlign: "center" }}>
        <BrandBadge copy={copy} style={style} rgba={rgba} />
        <div style={{ marginTop: copy.brand_name ? 10 : 0 }}>
          <Headline text={copy.headline} size={24} centered />
          <Subheadline text={copy.subheadline} centered />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {items.length > 0 && <BadgeList items={items} />}
      </div>

      <div style={{ textAlign: "center" }}>
        {copy.slogan && <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>{copy.slogan}</div>}
        <CtaPrice copy={copy} style={style} rgba={rgba} />
        <Disclaimer text={copy.disclaimer} />
      </div>
    </div>
  );
}

/* ─── Layout: split text / visual ─── */

function SplitLayout({
  creative,
  rgba,
  textSide,
}: {
  creative: AdCreative;
  rgba: Helper;
  textSide: "left" | "right";
}) {
  const { copy, style } = creative;
  const items = copy.features.length ? copy.features : copy.side_badges;
  const isLeft = textSide === "left";

  return (
    <div style={{ position: "absolute", inset: 0, padding: "22px 18px", display: "flex", gap: 14, flexDirection: isLeft ? "row" : "row-reverse" }}>
      <div style={{ flex: "0 0 48%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <BrandBadge copy={copy} style={style} rgba={rgba} />
        <div style={{ marginTop: copy.brand_name ? 10 : 0 }}>
          <Headline text={copy.headline} size={22} />
          <Subheadline text={copy.subheadline} />
        </div>
        <FeatureList items={items} />
        <CtaPrice copy={copy} style={style} rgba={rgba} />
        <Disclaimer text={copy.disclaimer} />
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.95 }}>
        {/* Pusta strefa wizualna — tło AI widoczne pod spodem */}
        <div
          style={{
            width: "88%",
            height: "72%",
            borderRadius: 16,
            border: `1px dashed ${rgba(style.accent, 0.35)}`,
            background: `radial-gradient(circle at 50% 50%, ${rgba(style.accent, 0.12)} 0%, transparent 70%)`,
          }}
        />
      </div>
    </div>
  );
}

/* ─── Layout: mockup + dymki ─── */

function BubbleLayout({ creative, rgba }: { creative: AdCreative; rgba: Helper }) {
  const { copy, style } = creative;
  const align =
    style.phonePosition === "center-left" ? "flex-start" : style.phonePosition === "center-right" ? "flex-end" : "center";

  return (
    <div style={{ position: "absolute", inset: 0, padding: "22px 18px", display: "flex", flexDirection: "column" }}>
      <Headline text={copy.headline} size={22} centered />
      <Subheadline text={copy.subheadline} centered />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: align, gap: 10, marginTop: 12 }}>
        <PhoneMockup creative={creative} rgba={rgba} />
        {copy.side_badges.length > 0 && <BadgeList items={copy.side_badges} />}
      </div>

      <div style={{ textAlign: "center" }}>
        {copy.slogan && <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>{copy.slogan}</div>}
        <CtaPrice copy={copy} style={style} rgba={rgba} />
        <Disclaimer text={copy.disclaimer} />
      </div>
    </div>
  );
}

/* ─── Layout: duża cena + CTA ─── */

function PriceCtaLayout({ creative, rgba }: { creative: AdCreative; rgba: Helper }) {
  const { copy, style } = creative;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "28px 24px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <BrandBadge copy={copy} style={style} rgba={rgba} />
        <div style={{ marginTop: 12 }}>
          <Headline text={copy.headline} size={26} />
          <Subheadline text={copy.subheadline} />
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        {copy.price && (
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1, textShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
            {copy.price}
          </div>
        )}
        {copy.slogan && <div style={{ fontSize: 13, opacity: 0.85, marginTop: 10 }}>{copy.slogan}</div>}
      </div>

      <div style={{ textAlign: "center" }}>
        <CtaPrice copy={copy} style={style} rgba={rgba} large />
        <Disclaimer text={copy.disclaimer} />
      </div>
    </div>
  );
}

/* ─── Layout: plakat z dużym hasłem ─── */

function PosterLayout({ creative, rgba }: { creative: AdCreative; rgba: Helper }) {
  const { copy, style } = creative;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {copy.brand_name && (
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: style.accent, marginBottom: 14 }}>
          {copy.brand_name}
        </div>
      )}
      <Headline text={copy.headline} size={36} centered />
      <Subheadline text={copy.subheadline} centered />
      {copy.slogan && <div style={{ fontSize: 15, fontWeight: 600, marginTop: 16, opacity: 0.9 }}>{copy.slogan}</div>}
      <div style={{ marginTop: 24 }}>
        <CtaPrice copy={copy} style={style} rgba={rgba} large />
      </div>
      <Disclaimer text={copy.disclaimer} />
    </div>
  );
}

export type { AdLayout };
