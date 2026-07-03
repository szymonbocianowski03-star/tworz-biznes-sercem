import { normalizeDomain, parseListInput } from "@/lib/aiVisibility/generateQueries";
import type { LlmVisibilityFormInput } from "@/lib/llmVisibilityRunAnalysis";

export type ValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type InputValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  canContinueWithWarnings: boolean;
  normalizedDomain: string;
  normalizedUrl: string;
};

const CATEGORY_PLACEHOLDER_PATTERNS = [
  /tej\s+kategorii/i,
  /ta\s+branża/i,
  /twoja\s+branża/i,
  /twojej\s+branży/i,
  /^np\.\s/i,
  /przykład:/i,
  /tu\s+wpisz/i,
  /wprowadź\s+branż/i,
  /nazwa\s+marki/i,
  /adres\s+url/i,
];

const GENERIC_CATEGORY_PATTERNS = [
  /^firm[aey]?$/i,
  /^usług[iy]?$/i,
  /^produkt[y]?$/i,
  /^biznes$/i,
  /^internet$/i,
  /^online$/i,
  /^saas$/i,
  /^b2b$/i,
  /^marketing$/i,
  /^e-?commerce$/i,
  /^it$/i,
  /^tech$/i,
];

export function isPlaceholderCategory(industry: string): boolean {
  const trimmed = industry.trim();
  if (!trimmed) return true;
  if (trimmed.length < 8 && GENERIC_CATEGORY_PATTERNS.some((p) => p.test(trimmed))) return true;
  return CATEGORY_PLACEHOLDER_PATTERNS.some((p) => p.test(trimmed));
}

export function isValidBrandUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, "");
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host);
  } catch {
    return false;
  }
}

function normalizeBrandKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function brandDomainConsistency(brandName: string, domain: string): ValidationIssue | null {
  const brandKey = normalizeBrandKey(brandName);
  const domBase = domain.split(".")[0].replace(/[^a-z0-9]/g, "");
  if (!brandKey || !domBase || brandKey.length < 2 || domBase.length < 2) return null;

  const brandInDomain = domBase.includes(brandKey) || brandKey.includes(domBase);
  if (brandInDomain) return null;

  if (brandKey.length >= 3 && domBase.length >= 3) {
    const prefixMatch = brandKey.slice(0, 4) === domBase.slice(0, 4);
    if (prefixMatch) return null;
    return {
      code: "brand_domain_mismatch",
      message:
        "Nazwa marki i domena wyglądają na niespójne. Sprawdź, czy analizujesz właściwą stronę.",
      severity: "warning",
    };
  }
  return null;
}

export function validateAnalysisInput(
  form: LlmVisibilityFormInput,
  options?: { requireCompetitors?: boolean },
): InputValidationResult {
  const issues: ValidationIssue[] = [];
  const brand = form.brandName?.trim() ?? "";
  const url = form.websiteUrl?.trim() ?? "";
  const industry = form.industry?.trim() ?? "";

  if (!brand) {
    issues.push({ code: "missing_brand", message: "Podaj nazwę marki.", severity: "error" });
  }
  if (!url) {
    issues.push({ code: "missing_url", message: "Podaj poprawny URL analizowanej marki.", severity: "error" });
  } else if (!isValidBrandUrl(url)) {
    issues.push({
      code: "invalid_url",
      message: "URL musi być poprawnym adresem domeny (np. https://example.com).",
      severity: "error",
    });
  }

  if (!industry) {
    issues.push({ code: "missing_category", message: "Brak branży / kategorii rynku.", severity: "error" });
  } else if (isPlaceholderCategory(industry)) {
    issues.push({
      code: "placeholder_category",
      message:
        "Nie można wygenerować wiarygodnego raportu, ponieważ brakuje precyzyjnej kategorii rynku. Uzupełnij branżę, np. »systemy reklamowe dla MŚP«, »agencja marketingowa«, »narzędzie SaaS do kampanii Meta Ads«.",
      severity: "error",
    });
  }

  if (options?.requireCompetitors && parseListInput(form.competitors).length === 0) {
    issues.push({
      code: "missing_competitor",
      message: "Dla analizy porównawczej podaj co najmniej jednego konkurenta.",
      severity: "error",
    });
  }

  for (const q of parseListInput(form.targetKeywords)) {
    if (CATEGORY_PLACEHOLDER_PATTERNS.some((p) => p.test(q))) {
      issues.push({
        code: "placeholder_in_queries",
        message: `Zapytanie zawiera placeholder: „${q.slice(0, 60)}${q.length > 60 ? "…" : ""}”`,
        severity: "error",
      });
    }
  }

  let normalizedDomain = "";
  let normalizedUrl = url;
  if (url && isValidBrandUrl(url)) {
    normalizedDomain = normalizeDomain(url);
    try {
      normalizedUrl = new URL(url.startsWith("http") ? url : `https://${url}`).href;
    } catch {
      normalizedUrl = url;
    }
  }

  if (brand && normalizedDomain) {
    const mismatch = brandDomainConsistency(brand, normalizedDomain);
    if (mismatch) issues.push(mismatch);
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return {
    valid: errors.length === 0,
    issues,
    canContinueWithWarnings: errors.length === 0 && warnings.length > 0,
    normalizedDomain,
    normalizedUrl,
  };
}

export const CATEGORY_ERROR_MESSAGE =
  "Nie można wygenerować wiarygodnego raportu, ponieważ brakuje precyzyjnej kategorii rynku. Uzupełnij branżę, np. »systemy reklamowe dla MŚP«, »agencja marketingowa«, »narzędzie SaaS do kampanii Meta Ads«.";
