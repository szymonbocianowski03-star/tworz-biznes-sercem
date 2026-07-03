/** Wzorce layoutów — dopasowanie do biblioteki szablonów marketing/templates. */
const LAYOUT_HINTS: { test: RegExp; guideline: string }[] = [
  {
    test: /\b(vs|versus|porówn|comparison|my vs|konkuren|abonament|narzędzi|tools|workspace)\b/i,
    guideline:
      "LAYOUT (My vs Them): 50/50 split ad. Brand side (dark navy): product/dashboard mockup, green checkmarks, 3 benefit bullets. Competitor side (light gray panel): crossed-out monthly prices, red X marks. Bold VS badge between halves. Top: short caps headline.",
  },
  {
    test: /\b(stat|metryk|pasek|liczb|\b10\b.*\b1\b|min\b|hero.*bar)\b/i,
    guideline:
      "LAYOUT (Stat bar hero): Dark top with bold headline. Center row: 3–4 large stat numbers in outlined boxes (e.g. 10 tools | 1 workspace | 0 PLN | 5 min). Bottom: rounded metrics bar. Purple pill CTA. Optional green FREE corner badge.",
  },
  {
    test: /\b(korzyś|benefit|checklist|lista|feature|funkcj)\b/i,
    guideline:
      "LAYOUT (Benefit list): Headline top-left. Left or center: product UI mockup on dark background. Right/below: vertical list with green checkmarks and short benefit lines. Full-width purple CTA button at bottom.",
  },
  {
    test: /\b(cta|promo|rabat|taniej|oferta|zacznij|darmo|free)\b/i,
    guideline:
      "LAYOUT (Promo hero): Strong headline top 15%. Center: product/device mockup with soft glow. Bottom 20%: wide purple accent bar with white CTA text. Clean margins, one dominant message.",
  },
];

const SAAS_QUALITY_BLOCK = `QUALITY BAR: Premium B2B SaaS static social ad (Meta/LinkedIn 1:1). Must look like a senior performance designer made it — crisp UI, intentional grid, not a generic AI illustration.

VISUAL SYSTEM (unless brief overrides):
- Background: deep navy #0a0f1e, subtle grid or soft radial glow
- CTA buttons: purple #7c3aed, rounded, white label, light shadow
- Positive markers: green #22c55e checkmarks and badges
- Competitor/negative: light gray #e5e7eb panels, red #ef4444 X marks, strikethrough prices
- Type: bold geometric sans-serif (Inter / SF Pro style), high contrast
- Polish text: perfect diacritics (ą ć ę ł ń ó ś ź ż), short lines, no paragraph walls

FORBIDDEN: watermarks, lorem ipsum, blurry or warped letters, misspelled Polish, clutter, stock-photo lifestyle, rainbow decorative gradients, fake third-party logos.`;

/**
 * Składa finalny prompt do gpt-image-1.
 * Agent pisze szczegółowy brief (preferowany EN); builder dokłada standard jakości SaaS i layout.
 */
export function buildAdImagePrompt(
  userPrompt: string,
  brandVisualRules?: string | null,
  singleVariant = true,
): string {
  const clean = String(userPrompt ?? "").trim();
  const brand = brandVisualRules?.trim();

  const layoutHint =
    LAYOUT_HINTS.find((h) => h.test.test(clean))?.guideline ??
    "LAYOUT: Structured feed ad — headline (top), focal visual/mockup (center), single purple CTA (bottom). Grid-aligned, generous whitespace.";

  const variantLine = singleVariant
    ? "OUTPUT: One polished, production-ready static ad."
    : "OUTPUT: Distinct layout variations, same message and brand system.";

  const parts = [
    SAAS_QUALITY_BLOCK,
    layoutHint,
    variantLine,
    "",
    "TEXT ON IMAGE: Polish with perfect diacritics for all visible copy. Render exact quoted strings from the brief — no extra labels.",
    "",
    "CREATIVE BRIEF (follow precisely):",
    clean,
  ];

  if (brand) {
    parts.push("", "BRAND VISUAL IDENTITY (override defaults where specified):", brand.slice(0, 3500));
  }

  return parts.join("\n");
}
