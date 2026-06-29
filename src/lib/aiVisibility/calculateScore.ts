import type { AiVisibilityQueryResult } from "@/lib/aiVisibility/types";

export type ScoringBreakdown = {
  brandMentionRate: number;
  answerShare: number;
  averagePositionScore: number;
  sourcePresence: number;
  sentimentQuality: number;
  weightedScore: number;
  weights: {
    brandMentionRate: number;
    answerShare: number;
    averagePositionScore: number;
    sourcePresence: number;
    sentimentQuality: number;
  };
};

const WEIGHTS = {
  brandMentionRate: 0.35,
  answerShare: 0.25,
  averagePositionScore: 0.2,
  sourcePresence: 0.1,
  sentimentQuality: 0.1,
} as const;

function positionToScore(pos: number | null): number {
  if (pos == null || pos <= 0) return 0;
  if (pos === 1) return 100;
  if (pos === 2) return 85;
  if (pos === 3) return 70;
  if (pos === 4) return 55;
  if (pos === 5) return 40;
  return Math.max(10, 100 - pos * 12);
}

function sentimentToScore(sentiment: string): number {
  const s = sentiment.toLowerCase();
  if (s.includes("positive") || s.includes("pozytyw")) return 100;
  if (s.includes("negative") || s.includes("negatyw")) return 20;
  return 60;
}

export function calculateVisibilityScore(queries: AiVisibilityQueryResult[]): ScoringBreakdown {
  const total = queries.length;
  if (total === 0) {
    return {
      brandMentionRate: 0,
      answerShare: 0,
      averagePositionScore: 0,
      sourcePresence: 0,
      sentimentQuality: 50,
      weightedScore: 0,
      weights: { ...WEIGHTS },
    };
  }

  const mentioned = queries.filter((q) => q.brandMentioned);
  const brandMentionRate = Math.round((mentioned.length / total) * 100);

  const brandCount = mentioned.length;
  const competitorCount = queries.reduce((acc, q) => acc + (q.competitorsMentioned?.length ?? 0), 0);
  const answerShare =
    brandCount + competitorCount > 0
      ? Math.round((brandCount / (brandCount + competitorCount)) * 100)
      : brandMentionRate;

  const positionScores = mentioned.map((q) => positionToScore(q.brandPosition)).filter((s) => s > 0);
  const averagePositionScore = positionScores.length
    ? Math.round(positionScores.reduce((a, b) => a + b, 0) / positionScores.length)
    : 0;

  const sourcePresence = mentioned.length
    ? Math.round((mentioned.filter((q) => q.sourceMentioned).length / mentioned.length) * 100)
    : 0;

  const sentimentQuality = mentioned.length
    ? Math.round(mentioned.reduce((acc, q) => acc + sentimentToScore(q.sentiment), 0) / mentioned.length)
    : 50;

  const weightedScore = Math.round(
    brandMentionRate * WEIGHTS.brandMentionRate +
      answerShare * WEIGHTS.answerShare +
      averagePositionScore * WEIGHTS.averagePositionScore +
      sourcePresence * WEIGHTS.sourcePresence +
      sentimentQuality * WEIGHTS.sentimentQuality,
  );

  return {
    brandMentionRate,
    answerShare,
    averagePositionScore,
    sourcePresence,
    sentimentQuality,
    weightedScore: Math.min(100, Math.max(0, weightedScore)),
    weights: { ...WEIGHTS },
  };
}

export function getConfidenceFromQueryCount(
  queryCount: number,
  hasBlockingIssues: boolean,
): { level: string; rationale: string; isLow: boolean } {
  if (hasBlockingIssues) {
    return {
      level: "niska pewność analizy",
      rationale:
        "Dane wejściowe lub wynik analizy zawierają błędy — nie traktuj wyniku jako wiarygodnej oceny widoczności marki.",
      isLow: true,
    };
  }
  if (queryCount < 10) {
    return {
      level: "niska pewność analizy",
      rationale: `Liczba zapytań testowych (${queryCount}) jest mniejsza niż 10 — wynik ma ograniczoną wiarygodność.`,
      isLow: true,
    };
  }
  if (queryCount <= 30) {
    return {
      level: "średnia pewność analizy",
      rationale: `${queryCount} zapytań testowych — wynik jest orientacyjny; większa próba zwiększy dokładność.`,
      isLow: false,
    };
  }
  return {
    level: "wysoka pewność analizy",
    rationale: `${queryCount} zapytań testowych przy poprawnych danych wejściowych.`,
    isLow: false,
  };
}
