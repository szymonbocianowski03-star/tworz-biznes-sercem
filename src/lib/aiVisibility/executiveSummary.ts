import type { AiVisibilityMetrics } from "@/lib/aiVisibility/types";

export type VisibilityStatusTone = "danger" | "warning" | "neutral" | "success";

export function getVisibilityStatus(score: number): {
  label: string;
  tone: VisibilityStatusTone;
  description: string;
} {
  if (score < 20) {
    return {
      label: "Bardzo niska widoczność",
      tone: "danger",
      description: "Marka prawie nie pojawia się w odpowiedziach AI.",
    };
  }
  if (score < 40) {
    return {
      label: "Niska widoczność",
      tone: "warning",
      description: "Marka pojawia się sporadycznie i wymaga wzmocnienia sygnałów.",
    };
  }
  if (score < 65) {
    return {
      label: "Średnia widoczność",
      tone: "neutral",
      description: "Marka jest częściowo rozpoznawana, ale ma duży potencjał wzrostu.",
    };
  }
  if (score < 85) {
    return {
      label: "Dobra widoczność",
      tone: "success",
      description: "Marka pojawia się w części ważnych odpowiedzi AI.",
    };
  }
  return {
    label: "Bardzo dobra widoczność",
    tone: "success",
    description: "Marka jest silnie widoczna w analizowanej kategorii.",
  };
}

export function buildAiVisibilityExecutiveSummary(data: {
  domain: string;
  brandName?: string;
  score: number;
  metrics: AiVisibilityMetrics;
  industry?: string;
  executiveSummaryFromModel?: string;
  blocked?: boolean;
}): string {
  if (data.blocked) return "Raport nie został wygenerowany — dane wejściowe są niewystarczające lub niespójne.";
  if (data.executiveSummaryFromModel?.trim()) return data.executiveSummaryFromModel.trim();

  const brand = data.brandName?.trim() || data.domain || "marka";
  const domain = data.domain || "Twoja strona";
  const score = data.score;
  const totalQueries = data.metrics.totalQueries || 0;
  const brandMentions = data.metrics.brandMentions || 0;
  const industry = data.industry?.trim() || "wskazanej branży";

  if (score < 20) {
    return `W badanym zestawie zapytań marka ${brand} (${domain}) pojawiła się w ${brandMentions} z ${totalQueries} sprawdzonych odpowiedzi AI w kategorii ${industry}. Brak wzmianek w tej próbie nie musi oznaczać braku widoczności w całej kategorii — wynik warto traktować jako wstępny i powtórzyć analizę na lepiej dobranych pytaniach.`;
  }
  if (score < 40) {
    return `Marka ${brand} (${domain}) ma niską widoczność w odpowiedziach AI w kategorii ${industry}. Marka pojawia się sporadycznie — warto powiązać ją z konkretnymi problemami klientów i zapytaniami, które użytkownicy zadają asystentom AI.`;
  }
  if (score < 65) {
    return `Marka ${brand} (${domain}) ma umiarkowaną widoczność w odpowiedziach AI w kategorii ${industry}. Marka zaczyna być rozpoznawana, ale nadal nie pojawia się wystarczająco często przy najważniejszych zapytaniach.`;
  }
  if (score < 85) {
    return `Marka ${brand} (${domain}) ma dobrą widoczność w odpowiedziach AI w kategorii ${industry}. Marka pojawia się w części istotnych zapytań i ma solidną podstawę do dalszego wzrostu.`;
  }
  return `Marka ${brand} (${domain}) ma bardzo dobrą widoczność w odpowiedziach AI w kategorii ${industry}. Marka jest silnie powiązana z analizowaną kategorią i regularnie pojawia się w odpowiedziach na istotne zapytania.`;
}
