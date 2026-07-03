import { normalizeDomain, parseListInput } from "@/lib/aiVisibility/generateQueries";
import type { ValidationIssue } from "@/lib/aiVisibility/validateInput";
import { isPlaceholderCategory } from "@/lib/aiVisibility/validateInput";
import type { LlmVisibilityAnalysis } from "@/lib/llmVisibilityAnalysis";
import type { LlmVisibilityFormInput } from "@/lib/llmVisibilityRunAnalysis";

const DOMAIN_REGEX =
  /(?:https?:\/\/)?(?:www\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)/gi;

// Only accept strings that end with a real, known TLD. This prevents
// false positives like "GPT-3.5" being parsed as the domain "3.5".
const KNOWN_TLD_REGEX =
  /\.(com|org|net|io|app|pl|co|ai|dev|eu|de|uk|info|biz|me|tech|cloud|so|xyz|gov|edu)$/i;

const OUTPUT_PLACEHOLDER_REGEX =
  /tej\s+kategorii|ta\s+branża|ten\s+segment|nazwa\s+marki|adres\s+url\s+firmy|twoja\s+branża/i;

const IGNORED_DOMAINS = new Set([
  "example.com",
  "localhost",
  "marketingnow.pl",
  "lovable.dev",
  "supabase.co",
]);

// Powszechnie cytowane źródła i domeny techniczne — wzmianki o nich są
// poprawną treścią raportu, nie wyciekiem z innej analizy.
const KNOWN_SOURCE_DOMAINS = new Set([
  "schema.org",
  "searchengineland.com",
  "google.com",
  "openai.com",
  "chatgpt.com",
  "perplexity.ai",
  "anthropic.com",
  "gemini.google.com",
  "wikipedia.org",
  "reddit.com",
  "quora.com",
  "youtube.com",
  "g2.com",
  "capterra.com",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
]);

function extractDomainsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(DOMAIN_REGEX)) {
    const d = m[1].toLowerCase().replace(/^www\./, "");
    if (!IGNORED_DOMAINS.has(d) && d.includes(".") && KNOWN_TLD_REGEX.test(d)) found.add(d);
  }
  return [...found];
}

function competitorDomains(form: LlmVisibilityFormInput): string[] {
  return parseListInput(form.competitors).flatMap((c) => {
    const raw = c.trim();
    if (!raw) return [];
    try {
      const host = raw.includes(".") ? raw : `${raw}.com`;
      return [normalizeDomain(host.startsWith("http") ? host : `https://${host}`).toLowerCase()];
    } catch {
      return [raw.toLowerCase()];
    }
  });
}

export type OutputValidationResult = {
  issues: ValidationIssue[];
  detectedDomains: string[];
  foreignDomains: string[];
  shouldBlock: boolean;
};

export function validateAnalysisOutput(
  analysis: LlmVisibilityAnalysis,
  form: LlmVisibilityFormInput,
  queryCount: number,
): OutputValidationResult {
  const issues: ValidationIssue[] = [];
  const analyzedDomain = normalizeDomain(form.websiteUrl).toLowerCase();
  const allowed = new Set([analyzedDomain, ...competitorDomains(form)]);

  const allText = JSON.stringify(analysis);
  const detectedDomains = extractDomainsFromText(allText);
  const foreignDomains = detectedDomains.filter(
    (d) => !allowed.has(d) && !KNOWN_SOURCE_DOMAINS.has(d),
  );

  // Wzmianki o konkurentach/źródłach to wartość raportu, nie błąd — nie blokuj.
  if (foreignDomains.length > 0) {
    issues.push({
      code: "foreign_domain_mention",
      message: `Wzmianki o domenach spoza analizy: ${foreignDomains.join(", ")}.`,
      severity: "warning",
    });
  }

  if (OUTPUT_PLACEHOLDER_REGEX.test(allText)) {
    issues.push({
      code: "placeholder_in_output",
      message: "Raport zawiera placeholdery (np. „tej kategorii”) zamiast konkretnych danych.",
      severity: "error",
    });
  }

  if (isPlaceholderCategory(form.industry)) {
    issues.push({
      code: "placeholder_category",
      message: "Użyto nieprecyzyjnej kategorii rynku.",
      severity: "error",
    });
  }

  const responseCount = analysis.queryResults?.length ?? analysis.brandMentions?.length ?? 0;
  if (responseCount === 0) {
    issues.push({
      code: "no_ai_responses",
      message: "Brak odpowiedzi AI — nie można policzyć wiarygodnego wyniku.",
      severity: "error",
    });
  }

  if (queryCount < 5) {
    issues.push({
      code: "too_few_queries",
      message: `Zbyt mała liczba zapytań testowych (${queryCount}). Minimum 5 dla wiarygodnej analizy.`,
      severity: "error",
    });
  }

  const shouldBlock = issues.some((i) => i.severity === "error");
  return { issues, detectedDomains, foreignDomains, shouldBlock };
}

export const BLOCKED_REPORT_MESSAGE =
  "Raport nie został wygenerowany, ponieważ dane wejściowe są niewystarczające lub niespójne.";
