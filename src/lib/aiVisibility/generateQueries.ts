import { isPlaceholderCategory } from "@/lib/aiVisibility/validateInput";

/** Propozycje zapytań na podstawie branży i oferty — wymaga precyzyjnej kategorii. */
export function generateSuggestedQueries(input: {
  brandName: string;
  industry: string;
  offerDescription?: string;
  targetAudience?: string;
}): string[] | null {
  const brand = input.brandName.trim();
  const category = input.industry.trim();
  if (!category || isPlaceholderCategory(category)) return null;

  const industry = (category || input.offerDescription || "").toLowerCase();

  const marketingNowDefaults = [
    "Jakie narzędzie pomaga zaplanować kampanię marketingową dla małej firmy?",
    "Jak automatyzować tworzenie treści marketingowych?",
    "Jak sprawdzić widoczność marki w odpowiedziach AI?",
    "Jakie narzędzie łączy planowanie reklam, SEO i kalendarz marketingowy?",
    "Jak poprawić obecność firmy w ChatGPT i Gemini?",
  ];

  if (brand.toLowerCase().includes("marketingnow") || industry.includes("marketing automation")) {
    return marketingNowDefaults;
  }

  if (industry.includes("e-commerce") || industry.includes("sklep")) {
    return [
      `Jakie narzędzie pomoże zwiększyć sprzedaż w sklepie internetowym dla ${input.targetAudience || "małych firm"}?`,
      `Jak poprawić konwersję w e-commerce bez zwiększania budżetu reklamowego?`,
      `Porównanie platform e-commerce dla polskiego rynku`,
      `Jak zautomatyzować marketing produktowy w sklepie online?`,
      `Najlepsze praktyki SEO dla sklepów internetowych w 2026`,
    ];
  }

  if (industry.includes("saas") || industry.includes("b2b") || industry.includes("oprogramowanie")) {
    return [
      `Jakie oprogramowanie pomoże ${input.targetAudience || "zespołom marketingu"} w planowaniu kampanii?`,
      `Porównanie narzędzi ${industry || "SaaS"} dla małych firm`,
      `Jak wybrać platformę marketing automation dla B2B?`,
      `Jak zwiększyć widoczność marki SaaS w odpowiedziach ChatGPT?`,
      `Najlepsze narzędzia do automatyzacji marketingu dla startupów`,
    ];
  }

  return [
    `Jakie narzędzie jest najlepsze w kategorii ${category}?`,
    `Porównanie rozwiązań dla ${input.targetAudience || "firm"} w branży ${category}`,
    `Jak wybrać dostawcę ${category} — na co zwrócić uwagę?`,
    `Alternatywy i konkurencja w segmencie ${category}`,
    brand ? `Czy ${brand} jest dobrą opcją w kategorii ${category}?` : `Rekomendacje w kategorii ${category}`,
    `Ranking firm w kategorii ${category} w Polsce`,
    `Opinie o ${brand || "dostawcach"} w segmencie ${category}`,
  ];
}

export function parseListInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || url;
  }
}
