import type { AiVisibilityQueryResult, AiVisibilityRecommendation } from "@/lib/aiVisibility/types";

const GENERIC_PATTERNS = [
  /wzmocnij\s+obecność\s+techniczn/i,
  /doprecyzuj\s+kategori/i,
  /popraw\s+dokumentację\s+api/i,
  /zbuduj\s+strategię\s+widoczności/i,
  /twórz\s+ai-friendly/i,
  /wdróż\s+strategię/i,
  /zwiększ\s+obecność\s+w\s+internecie/i,
];

function findRelatedQueries(rec: AiVisibilityRecommendation, queries: AiVisibilityQueryResult[]): string[] {
  const blob = `${rec.title} ${rec.problem} ${rec.howToFix} ${rec.whyItMatters}`.toLowerCase();
  return queries
    .filter((q) => {
      const fragment = q.query.toLowerCase().slice(0, 24);
      return fragment.length >= 8 && blob.includes(fragment);
    })
    .map((q) => q.query)
    .slice(0, 5);
}

export function filterGenericRecommendations(
  recommendations: AiVisibilityRecommendation[],
  queries: AiVisibilityQueryResult[],
): AiVisibilityRecommendation[] {
  return recommendations
    .filter((rec) => {
      const text = `${rec.title} ${rec.problem} ${rec.howToFix}`.toLowerCase();
      const isGeneric = GENERIC_PATTERNS.some((p) => p.test(text));
      if (!isGeneric) return true;
      return findRelatedQueries(rec, queries).length > 0;
    })
    .map((rec) => {
      const basedOn = rec.basedOnQueries?.length ? rec.basedOnQueries : findRelatedQueries(rec, queries);
      return {
        ...rec,
        basedOnQueries: basedOn,
        whyItMatters:
          basedOn.length > 0
            ? `${rec.whyItMatters}${rec.whyItMatters.endsWith(".") ? "" : "."} Na podstawie zapytań: ${basedOn.join("; ")}.`
            : rec.whyItMatters,
      };
    });
}
