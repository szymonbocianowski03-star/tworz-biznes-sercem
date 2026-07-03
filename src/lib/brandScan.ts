import type { BrandAiContext } from "@/hooks/useBrands";
import type { RunCompetitorScanResult } from "@/lib/competitorScan.functions";

type ScanPayload = {
  pageUrl?: string;
  title?: string;
  description?: string;
  analysisMarkdown?: string;
  brandGuess?: string;
  industry?: string;
  summaryBullets?: string[];
  landingBullets?: string[];
  recommendationsBullets?: string[];
};

function bulletsToText(bullets: string[] | undefined, max = 8): string {
  if (!bullets?.length) return "";
  return bullets.slice(0, max).map((b) => `- ${b}`).join("\n");
}

export function mapCompetitorScanToBrandContext(
  url: string,
  result: RunCompetitorScanResult,
): { ok: true; context: BrandAiContext } | { ok: false; error: string } {
  if (!result.ok) {
    const msg =
      result.kind === "http"
        ? result.error || result.message || "Błąd skanowania strony."
        : result.message || "Błąd skanowania strony.";
    return { ok: false, error: msg };
  }

  const data = result.data as ScanPayload;
  const summaryParts = [
    data.description?.trim(),
    data.brandGuess?.trim() ? `Marka / oferta: ${data.brandGuess.trim()}` : null,
    bulletsToText(data.summaryBullets),
    bulletsToText(data.landingBullets),
    data.analysisMarkdown?.trim()?.slice(0, 2000),
  ].filter(Boolean);

  const context: BrandAiContext = {
    summary: summaryParts.join("\n\n") || "Brak opisu — uzupełnij ręcznie w panelu marki.",
    industry: data.industry?.trim() || undefined,
    valueProposition: data.brandGuess?.trim() || undefined,
    scrapedAt: Date.now(),
    sourceUrl: data.pageUrl || url,
    pageTitle: data.title,
    pageDescription: data.description,
    rawMarkdown: [data.analysisMarkdown, bulletsToText(data.recommendationsBullets, 6)]
      .filter(Boolean)
      .join("\n\n"),
  };

  return { ok: true, context };
}
