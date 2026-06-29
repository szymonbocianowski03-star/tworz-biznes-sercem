/**
 * Heurystyczne wykrywanie, czy wygenerowany obraz może zawierać osadzony tekst
 * (lorem ipsum, losowe litery, zniekształconą typografię).
 * Nie wymaga OCR — analizuje pasma poziome pod kątem „ostrych” przejść luminancji.
 */

const SUSPICIOUS_BANDS = [0.12, 0.28, 0.42, 0.55, 0.72, 0.88];

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Nie udało się wczytać obrazu do walidacji."));
    img.src = dataUrl;
  });
}

function bandTransitionScore(data: Uint8ClampedArray, w: number, h: number, bandY: number): number {
  const y = Math.floor(bandY * h);
  let transitions = 0;
  let prevLum = -1;
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (prevLum >= 0 && Math.abs(lum - prevLum) > 38) transitions++;
    prevLum = lum;
  }
  return transitions / w;
}

/** Zwraca true, gdy obraz wygląda na zawierający osadzony tekst. */
export async function imageMayContainEmbeddedText(dataUrl: string): Promise<boolean> {
  if (!dataUrl || typeof document === "undefined") return false;
  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(img.width, img.height));
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;

    let suspiciousBands = 0;
    for (const band of SUSPICIOUS_BANDS) {
      if (bandTransitionScore(pixels, w, h, band) > 0.11) suspiciousBands++;
    }
    return suspiciousBands >= 3;
  } catch {
    return false;
  }
}

export const RETRY_NO_TEXT_SUFFIX =
  "CRITICAL RETRY: The image must contain ZERO readable text, letters, numbers, words, logos with text, UI labels, watermarks, lorem ipsum, fake typography or gibberish characters. Only pure visual elements: background, product, person, lighting, composition and empty space reserved for text overlays.";
