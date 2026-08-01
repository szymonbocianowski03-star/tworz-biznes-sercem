/** Wyciąga paletę kolorów marki z HTML strony. */

const HEX_RE = /#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g;
const RGB_RE = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)/gi;
const HSL_RE = /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/gi;

function expandHex(hex: string): string | null {
  const h = hex.replace("#", "").toUpperCase();
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (h.length === 6) return `#${h}`;
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lig - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return rgbToHex(f(0), f(8), f(4));
}

function luminance(hex: string): number {
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function saturation(hex: string): number {
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

function isBoring(hex: string): boolean {
  const sat = saturation(hex);
  const lum = luminance(hex);
  // prawie białe / prawie czarne / szare bez charakteru
  if (lum > 0.92 || lum < 0.05) return true;
  if (sat < 0.08 && lum > 0.15 && lum < 0.85) return true;
  return false;
}

/** Kolory frameworków/bibliotek — zwykle nie są kolorem marki. */
const GENERIC_COLORS = new Set([
  "#007BFF", // bootstrap primary
  "#0D6EFD",
  "#6C757D",
  "#28A745",
  "#DC3545",
  "#FFC107",
  "#17A2B8",
  "#3B82F6", // tailwind blue-500
  "#EF4444",
  "#22C55E",
  "#F3F4F6",
  "#E5E7EB",
  "#111827",
  "#1877F2", // facebook
  "#1DA1F2", // twitter
  "#25D366", // whatsapp
  "#FF0000", // youtube / generic red
  "#4267B2",
  "#0A66C2", // linkedin
  "#E1306C", // instagram
  "#25F4EE",
  "#000000",
  "#FFFFFF",
]);

function scoreColor(hex: string, boost = 0): number {
  const sat = saturation(hex);
  const lum = luminance(hex);
  // preferuj nasycone, czytelne kolory brandowe
  let score = sat * 2 + boost;
  if (lum > 0.2 && lum < 0.75) score += 0.35;
  if (sat > 0.35) score += 0.4;
  return score;
}

function pushColor(counts: Map<string, number>, hex: string | null, weight = 1) {
  if (!hex) return;
  const n = expandHex(hex);
  if (!n) return;
  if (isBoring(n) && weight < 5) return;
  let w = weight;
  if (GENERIC_COLORS.has(n)) w *= 0.25;
  counts.set(n, (counts.get(n) ?? 0) + w);
}

function metaContent(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`,
    "i",
  );
  return html.match(re)?.[1] ?? html.match(re2)?.[1] ?? null;
}

function collectFromCssChunk(chunk: string, counts: Map<string, number>, weight: number) {
  let m: RegExpExecArray | null;
  HEX_RE.lastIndex = 0;
  while ((m = HEX_RE.exec(chunk)) !== null) {
    pushColor(counts, `#${m[1]}`, weight);
  }
  RGB_RE.lastIndex = 0;
  while ((m = RGB_RE.exec(chunk)) !== null) {
    pushColor(counts, rgbToHex(Number(m[1]), Number(m[2]), Number(m[3])), weight);
  }
  HSL_RE.lastIndex = 0;
  while ((m = HSL_RE.exec(chunk)) !== null) {
    pushColor(counts, hslToHex(Number(m[1]), Number(m[2]), Number(m[3])), weight);
  }
}

/**
 * Zwraca do 4 hexów marki z HTML (theme-color, CSS vars, style inline / <style>).
 */
export function extractBrandColorsFromHtml(html: string, max = 4): string[] {
  const counts = new Map<string, number>();

  // Meta — silny sygnał brandu
  for (const key of ["theme-color", "msapplication-TileColor", "apple-mobile-web-app-status-bar-style"]) {
    const v = metaContent(html, key);
    if (v && /#|rgb|hsl/i.test(v)) {
      const hex = v.match(/#[0-9A-Fa-f]{3,6}/)?.[0];
      if (hex) pushColor(counts, hex, 12);
      else if (/rgb/i.test(v)) {
        const m = RGB_RE.exec(v);
        if (m) pushColor(counts, rgbToHex(Number(m[1]), Number(m[2]), Number(m[3])), 12);
      }
    }
  }

  // CSS custom properties w :root / html — często primary/accent
  const varRe =
    /--(?:brand|primary|accent|secondary|main|color[-_]?(?:primary|brand|accent|main)|mn[-_]?[a-z]+)[^:;]*:\s*([^;}{]+)/gi;
  let vm: RegExpExecArray | null;
  while ((vm = varRe.exec(html)) !== null) {
    collectFromCssChunk(vm[1], counts, 8);
  }

  // Bloki <style>
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = styleRe.exec(html)) !== null) {
    collectFromCssChunk(sm[1], counts, 2);
  }

  // Inline style=
  const inlineRe = /style=["']([^"']+)["']/gi;
  while ((sm = inlineRe.exec(html)) !== null) {
    collectFromCssChunk(sm[1], counts, 1.5);
  }

  // SVG fill / stroke w HTML
  const fillRe = /(?:fill|stroke)=["'](#[0-9A-Fa-f]{3,6}|rgb[^"']+)["']/gi;
  while ((sm = fillRe.exec(html)) !== null) {
    collectFromCssChunk(sm[1], counts, 3);
  }

  const ranked = [...counts.entries()]
    .map(([hex, count]) => ({ hex, score: scoreColor(hex) * Math.log2(count + 1) }))
    .sort((a, b) => b.score - a.score);

  const out: string[] = [];
  for (const { hex } of ranked) {
    if (out.includes(hex)) continue;
    // unikaj prawie-identycznych
    const tooClose = out.some((o) => colorDistance(o, hex) < 28);
    if (tooClose) continue;
    out.push(hex);
    if (out.length >= max) break;
  }

  // Zawsze dołóż czerń/biel brandowe jeśli mamy mało kolorów
  if (out.length > 0 && out.length < max) {
    for (const fallback of ["#0A0A0A", "#FFFFFF"]) {
      if (out.length >= max) break;
      if (!out.includes(fallback)) out.push(fallback);
    }
  }

  return out;
}

function colorDistance(a: string, b: string): number {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
}
