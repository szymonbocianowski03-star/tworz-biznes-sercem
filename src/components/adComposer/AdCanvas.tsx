import { forwardRef } from "react";
import { Check } from "lucide-react";
import { type AdCreative, FORMAT_DIMENSIONS } from "@/lib/adComposer/types";

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full || "8b5cf6", 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props {
  creative: AdCreative;
}

/**
 * Składa finalną reklamę z warstw:
 * tło (obraz AI) → mockup/telefon → dymki tekstu → badge → CTA → glow.
 * Cały tekst to prawdziwa typografia (renderowana programowo), nie napisy z modelu obrazu.
 */
export const AdCanvas = forwardRef<HTMLDivElement, Props>(function AdCanvas({ creative }, ref) {
  const dims = FORMAT_DIMENSIONS[creative.format] ?? FORMAT_DIMENSIONS["9:16"];
  const { style, copy } = creative;

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
      {/* Warstwa: obraz tła / mockup z AI (bez napisów) */}
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
            opacity: 0.85,
          }}
        />
      )}
      {/* Warstwa: przyciemnienie dla czytelności tekstu */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(5,7,15,0.35) 0%, rgba(5,7,15,0.15) 40%, rgba(5,7,15,0.78) 100%)",
        }}
      />
      {/* Warstwa: glow gradientowy */}
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

      {creative.creative_type === "phone-chat" && <PhoneChatLayer creative={creative} hexToRgba={hexToRgba} />}
      {creative.creative_type === "viral-social" && <PhoneChatLayer creative={creative} hexToRgba={hexToRgba} socialProof />}
      {creative.creative_type === "tools-comparison" && <ComparisonLayer creative={creative} hexToRgba={hexToRgba} />}
      {creative.creative_type === "dashboard-hero" && <HeroLayer creative={creative} hexToRgba={hexToRgba} />}
      {creative.creative_type === "product-mockup" && <HeroLayer creative={creative} hexToRgba={hexToRgba} centered />}
    </div>
  );
});

type Helper = (hex: string, alpha: number) => string;

/* ---------- Phone Chat Recommendation Ad ---------- */
function PhoneChatLayer({
  creative,
  hexToRgba: rgba,
  socialProof,
}: {
  creative: AdCreative;
  hexToRgba: Helper;
  socialProof?: boolean;
}) {
  const { copy, style } = creative;
  const align =
    style.phonePosition === "center-left"
      ? "flex-start"
      : style.phonePosition === "center-right"
        ? "flex-end"
        : "center";

  return (
    <div style={{ position: "absolute", inset: 0, padding: "22px 18px", display: "flex", flexDirection: "column" }}>
      {copy.headline && (
        <div style={{ textAlign: "center", fontSize: 22, fontWeight: 800, lineHeight: 1.15, letterSpacing: -0.4, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
          {copy.headline}
        </div>
      )}
      {copy.subheadline && (
        <div style={{ textAlign: "center", fontSize: 13, opacity: 0.85, marginTop: 6 }}>{copy.subheadline}</div>
      )}

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: align, gap: 10, marginTop: 12 }}>
        {/* Telefon — mockup renderowany programowo */}
        <div
          style={{
            width: 188,
            background: "rgba(10,12,22,0.72)",
            border: `1px solid ${rgba(style.accent, 0.5)}`,
            borderRadius: 28,
            padding: 12,
            boxShadow: `0 18px 50px rgba(0,0,0,0.55), 0 0 40px ${rgba(style.accent, 0.35)}`,
            backdropFilter: "blur(4px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <div style={{ width: 46, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.25)" }} />
          </div>
          {/* Dymek użytkownika */}
          {copy.user_message && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <div style={{ maxWidth: "85%", background: "rgba(255,255,255,0.12)", padding: "8px 11px", borderRadius: "14px 14px 4px 14px", fontSize: 11.5, lineHeight: 1.35 }}>
                {copy.user_message}
              </div>
            </div>
          )}
          {/* Dymek AI */}
          {copy.ai_response && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  maxWidth: "92%",
                  background: `linear-gradient(135deg, ${rgba(style.accent, 0.92)}, ${rgba(style.accent, 0.65)})`,
                  padding: "9px 12px",
                  borderRadius: "14px 14px 14px 4px",
                  fontSize: 11.5,
                  lineHeight: 1.4,
                  fontWeight: 500,
                  boxShadow: `0 6px 18px ${rgba(style.accent, 0.4)}`,
                }}
              >
                {copy.brand_name && <span style={{ fontWeight: 800 }}>{copy.brand_name}</span>}
                {copy.brand_name && copy.ai_response ? " — " : ""}
                {copy.ai_response}
              </div>
            </div>
          )}
        </div>

        {/* Boczne badge (narzędzia / porównania) */}
        {copy.side_badges.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {copy.side_badges.slice(0, 5).map((b, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
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
                <span style={{ display: "inline-flex", width: 16, height: 16, borderRadius: 999, background: "#22c55e", alignItems: "center", justifyContent: "center" }}>
                  <Check size={11} color="#06210f" strokeWidth={3.5} />
                </span>
                {b}
              </div>
            ))}
          </div>
        )}
      </div>

      <FooterCta creative={creative} rgba={rgba} socialProof={socialProof} />
    </div>
  );
}

/* ---------- AI Tools Comparison Ad ---------- */
function ComparisonLayer({ creative, hexToRgba: rgba }: { creative: AdCreative; hexToRgba: Helper }) {
  const { copy, style } = creative;
  const items = copy.features.length ? copy.features : copy.side_badges;
  return (
    <div style={{ position: "absolute", inset: 0, padding: "26px 22px", display: "flex", flexDirection: "column" }}>
      {copy.headline && (
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.12, letterSpacing: -0.5, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{copy.headline}</div>
      )}
      {copy.subheadline && <div style={{ fontSize: 13.5, opacity: 0.85, marginTop: 8 }}>{copy.subheadline}</div>}

      {copy.brand_name && (
        <div style={{ display: "inline-flex", alignSelf: "flex-start", marginTop: 14, background: `linear-gradient(135deg, ${rgba(style.accent, 0.95)}, ${rgba(style.accent, 0.6)})`, padding: "7px 14px", borderRadius: 999, fontWeight: 800, fontSize: 15, boxShadow: `0 8px 22px ${rgba(style.accent, 0.45)}` }}>
          {copy.brand_name}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, marginTop: 16, justifyContent: "center" }}>
        {items.slice(0, 6).map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "10px 12px", fontSize: 14, fontWeight: 600 }}>
            <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 999, background: "#22c55e", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Check size={14} color="#06210f" strokeWidth={3.5} />
            </span>
            {it}
          </div>
        ))}
      </div>

      <FooterCta creative={creative} rgba={rgba} />
    </div>
  );
}

/* ---------- SaaS Dashboard Hero / Premium Product Mockup ---------- */
function HeroLayer({ creative, hexToRgba: rgba, centered }: { creative: AdCreative; hexToRgba: Helper; centered?: boolean }) {
  const { copy, style } = creative;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "30px 26px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: centered ? "center" : "flex-start",
        textAlign: centered ? "center" : "left",
      }}
    >
      {copy.brand_name && (
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: style.accent, marginBottom: 8 }}>{copy.brand_name}</div>
      )}
      {copy.headline && (
        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.08, letterSpacing: -0.6, maxWidth: "94%", textShadow: "0 2px 14px rgba(0,0,0,0.6)" }}>{copy.headline}</div>
      )}
      {copy.subheadline && <div style={{ fontSize: 15, opacity: 0.88, marginTop: 10, maxWidth: "92%" }}>{copy.subheadline}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap", justifyContent: centered ? "center" : "flex-start" }}>
        {copy.cta && (
          <div style={{ background: `linear-gradient(135deg, ${rgba(style.accent, 1)}, ${rgba(style.accent, 0.7)})`, padding: "11px 22px", borderRadius: 999, fontWeight: 800, fontSize: 15, boxShadow: `0 10px 26px ${rgba(style.accent, 0.5)}` }}>{copy.cta}</div>
        )}
        {copy.price && <div style={{ fontSize: 17, fontWeight: 800 }}>{copy.price}</div>}
      </div>
      {copy.disclaimer && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 12 }}>{copy.disclaimer}</div>}
    </div>
  );
}

function FooterCta({ creative, rgba, socialProof }: { creative: AdCreative; rgba: Helper; socialProof?: boolean }) {
  const { copy, style } = creative;
  if (!copy.cta && !copy.brand_name && !copy.price) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 8 }}>
      {socialProof && copy.slogan && <div style={{ fontSize: 12, opacity: 0.85 }}>{copy.slogan}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {copy.cta && (
          <div style={{ background: `linear-gradient(135deg, ${rgba(style.accent, 1)}, ${rgba(style.accent, 0.7)})`, padding: "10px 20px", borderRadius: 999, fontWeight: 800, fontSize: 14, boxShadow: `0 10px 24px ${rgba(style.accent, 0.5)}` }}>
            {copy.cta}
          </div>
        )}
        {copy.price && <div style={{ fontSize: 15, fontWeight: 800 }}>{copy.price}</div>}
      </div>
      {copy.disclaimer && <div style={{ fontSize: 9.5, opacity: 0.6 }}>{copy.disclaimer}</div>}
    </div>
  );
}