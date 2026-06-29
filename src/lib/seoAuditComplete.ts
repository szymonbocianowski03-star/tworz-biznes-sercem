import type { SeoAuditAnalysis } from "@/lib/seoAuditAnalysis";
import { checklistTitle, quickWinTitle } from "@/lib/seoAuditAnalysis";

function nonEmptyStrings(items: string[]): string[] {
  return items.map((s) => s.trim()).filter(Boolean);
}

function chunkTasks(tasks: string[], weeks = 4, perWeek = 3): string[][] {
  const unique = [...new Set(tasks)];
  const result: string[][] = [];
  for (let w = 0; w < weeks; w++) {
    result.push(unique.slice(w * perWeek, w * perWeek + perWeek));
  }
  return result;
}

function planIsEmpty(plan: SeoAuditAnalysis["thirtyDayPlan"]): boolean {
  return !plan.week1.length && !plan.week2.length && !plan.week3.length && !plan.week4.length;
}

function suggestFixForChecklist(title: string, detail?: string | null): string {
  const t = title.toLowerCase();
  if (t.includes("h1")) return "Dodaj jeden unikalny nagłówek H1 z główną frazą kluczową.";
  if (t.includes("meta description")) return "Uzupełnij meta description (ok. 150–160 znaków) z jasną wartością i CTA.";
  if (t.includes("title")) return "Ustaw unikalny tag title (ok. 50–60 znaków) z frazą kluczową i marką.";
  if (t.includes("canonical")) return "Dodaj tag link rel=canonical wskazujący na kanoniczny URL strony.";
  if (t.includes("schema") || t.includes("json-ld")) return "Dodaj schema.org JSON-LD (Organization, WebSite lub Product).";
  if (t.includes("indeks")) return "Usuń noindex z meta robots, jeśli strona ma być widoczna w Google.";
  if (t.includes("treści") || t.includes("słów")) return "Rozbuduj treść strony o sekcje edukacyjne, FAQ i korzyści produktu.";
  if (t.includes("h2")) return "Uporządkuj strukturę nagłówków H2–H3 pod tematy i frazy kluczowe.";
  return detail?.trim() || "Wdróż poprawkę zgodnie z rekomendacją audytu SEO.";
}

/** Standalone (nie zależy od schematu Zod) — żeby nie tworzyć cyklu typów z seoAuditAnalysis.ts. */
export type SeoKeyProblem = {
  problem: string;
  whyItMatters: string;
  howToFix: string;
  priority: string;
  difficulty: string;
  estimatedImpact: string;
};

export function normalizeKeyProblemRow(raw: unknown): SeoKeyProblem | null {
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    return {
      problem: s.slice(0, 160),
      whyItMatters: "Wpływa na widoczność organiczną i zaufanie użytkowników.",
      howToFix: s,
      priority: "medium",
      difficulty: "medium",
      estimatedImpact: "medium",
    };
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const problem = String(r.problem ?? r.title ?? r.issue ?? r.name ?? "").trim();
  if (!problem) return null;
  return {
    problem,
    whyItMatters: String(r.whyItMatters ?? r.why ?? r.reason ?? "Wpływa na widoczność w wyszukiwarkach.").trim(),
    howToFix: String(r.howToFix ?? r.fix ?? r.recommendation ?? r.solution ?? suggestFixForChecklist(problem)).trim(),
    priority: String(r.priority ?? "medium"),
    difficulty: String(r.difficulty ?? "medium"),
    estimatedImpact: String(r.estimatedImpact ?? r.impact ?? r.priority ?? "medium"),
  };
}

function buildKeyProblemsFromChecklist(checklist: SeoAuditAnalysis["checklist"]): SeoAuditAnalysis["keyProblems"] {
  const out: SeoAuditAnalysis["keyProblems"] = [];
  for (const item of checklist) {
    if (typeof item === "string") continue;
    const status = item.status;
    if (status !== "fail" && status !== "warn") continue;
    out.push({
      problem: item.title,
      whyItMatters: item.detail ?? "Wpływa na widoczność organiczną i jakość strony w wynikach wyszukiwania.",
      howToFix: suggestFixForChecklist(item.title, item.detail),
      priority: status === "fail" ? "high" : "medium",
      difficulty: status === "fail" ? "medium" : "easy",
      estimatedImpact: status === "fail" ? "high" : "medium",
    });
  }
  return out;
}

function buildKeyProblemsFromPageOverview(data: SeoAuditAnalysis): SeoAuditAnalysis["keyProblems"] {
  const snap = data.pageOverview;
  const rows: SeoAuditAnalysis["keyProblems"] = [];

  if (!snap.title?.trim()) {
    rows.push({
      problem: "Brak tagu title",
      whyItMatters: "Title to główny sygnał tematu strony w wynikach Google.",
      howToFix: "Dodaj unikalny tag title z frazą kluczową i nazwą marki.",
      priority: "high",
      difficulty: "easy",
      estimatedImpact: "high",
    });
  }
  if (!snap.metaDescription?.trim() || snap.metaDescription.length < 50) {
    rows.push({
      problem: snap.metaDescription?.trim() ? "Meta description zbyt krótka lub obcięta" : "Brak meta description",
      whyItMatters: "Opis meta wpływa na CTR w SERP i zrozumienie tematu strony.",
      howToFix: "Napisz meta description 150–160 znaków z wartością oferty i wezwaniem do działania.",
      priority: "high",
      difficulty: "easy",
      estimatedImpact: "high",
    });
  }
  if (!snap.h1?.trim() || snap.h1Count === 0) {
    rows.push({
      problem: "Brak nagłówka H1",
      whyItMatters: "H1 określa główny temat strony dla botów i użytkowników.",
      howToFix: "Dodaj jeden H1 widoczny w HTML (nie tylko w JS) z główną frazą.",
      priority: "high",
      difficulty: "medium",
      estimatedImpact: "high",
    });
  } else if (snap.h1Count > 1) {
    rows.push({
      problem: `Wiele nagłówków H1 (${snap.h1Count})`,
      whyItMatters: "Więcej niż jeden H1 rozmywa główny temat strony.",
      howToFix: "Zostaw jeden H1 na stronę, pozostałe obniż do H2.",
      priority: "medium",
      difficulty: "easy",
      estimatedImpact: "medium",
    });
  }
  if (snap.h2Count < 2) {
    rows.push({
      problem: "Słaba struktura nagłówków H2",
      whyItMatters: "H2 porządkują treść i pomagają rankować podtematy.",
      howToFix: "Podziel treść na sekcje z opisowymi nagłówkami H2.",
      priority: "medium",
      difficulty: "medium",
      estimatedImpact: "medium",
    });
  }
  if (!snap.canonical?.trim()) {
    rows.push({
      problem: "Brak tagu canonical",
      whyItMatters: "Bez canonical Google może indeksować duplikaty URL.",
      howToFix: "Dodaj link rel=canonical do preferowanego adresu strony.",
      priority: "high",
      difficulty: "easy",
      estimatedImpact: "high",
    });
  }
  if (snap.indexStatus.toLowerCase().includes("noindex")) {
    rows.push({
      problem: "Strona może być wykluczona z indeksu",
      whyItMatters: "Noindex blokuje pojawianie się strony w wynikach wyszukiwania.",
      howToFix: "Usuń noindex z meta robots, jeśli strona ma być widoczna organicznie.",
      priority: "high",
      difficulty: "easy",
      estimatedImpact: "high",
    });
  }
  if (!snap.schemaJsonLd?.trim() || snap.schemaJsonLd === "brak" || snap.schemaJsonLd === "—") {
    rows.push({
      problem: "Brak danych strukturalnych schema.org",
      whyItMatters: "Schema pomaga wyszukiwarkom zrozumieć typ strony i ofertę.",
      howToFix: "Dodaj JSON-LD (Organization, WebSite, SoftwareApplication itp.).",
      priority: "medium",
      difficulty: "medium",
      estimatedImpact: "medium",
    });
  }
  if ((snap.wordCount ?? 0) < 300) {
    rows.push({
      problem: `Niska objętość treści (~${snap.wordCount ?? 0} słów)`,
      whyItMatters: "Cienka treść utrudnia rankowanie na konkurencyjne frazy.",
      howToFix: "Rozbuduj stronę o korzyści, FAQ, case studies i sekcje edukacyjne.",
      priority: "high",
      difficulty: "medium",
      estimatedImpact: "high",
    });
  }
  if (data.scores.technical < 40) {
    rows.push({
      problem: "Niski wynik techniczny SEO",
      whyItMatters: "Problemy techniczne ograniczają crawlowanie i indeksację.",
      howToFix: "Wdroż SSR/SSG, popraw canonical, robots, sitemap i szybkość ładowania.",
      priority: "high",
      difficulty: "hard",
      estimatedImpact: "high",
    });
  }

  return rows;
}

function buildDefaultChecklist(data: SeoAuditAnalysis): SeoAuditAnalysis["checklist"] {
  const snap = data.pageOverview;
  const items: SeoAuditAnalysis["checklist"] = [
    {
      title: "Tag title",
      status: snap.title ? "ok" : "fail",
      detail: snap.title ? `Obecny: „${snap.title.slice(0, 80)}”` : "Brak tagu title.",
    },
    {
      title: "Meta description",
      status: snap.metaDescription && snap.metaDescription.length >= 50 ? "ok" : "warn",
      detail: snap.metaDescription
        ? `Długość: ${snap.metaDescription.length} znaków`
        : "Brak meta description.",
    },
    {
      title: "Nagłówek H1",
      status: snap.h1Count === 1 ? "ok" : snap.h1Count === 0 ? "fail" : "warn",
      detail: snap.h1 || `Liczba H1: ${snap.h1Count}`,
    },
    {
      title: "Struktura H2",
      status: snap.h2Count >= 2 ? "ok" : "warn",
      detail: `Liczba H2: ${snap.h2Count}`,
    },
    {
      title: "Canonical",
      status: snap.canonical ? "ok" : "warn",
      detail: snap.canonical || "Brak tagu canonical.",
    },
    {
      title: "Indeksacja",
      status: snap.indexStatus.toLowerCase().includes("noindex") ? "fail" : "ok",
      detail: snap.indexStatus,
    },
    {
      title: "Schema JSON-LD",
      status: snap.schemaJsonLd && snap.schemaJsonLd !== "brak" ? "ok" : "warn",
      detail: snap.schemaJsonLd === "brak" ? "Brak danych strukturalnych." : "Wykryto schema.",
    },
    {
      title: "Objętość treści",
      status: (snap.wordCount ?? 0) >= 300 ? "ok" : "warn",
      detail: `~${snap.wordCount ?? 0} słów na stronie.`,
    },
  ];
  return items;
}

/** Uzupełnia puste sekcje raportu na podstawie dostępnych danych. */
export function completeSeoAudit(data: SeoAuditAnalysis): SeoAuditAnalysis {
  const next: SeoAuditAnalysis = {
    ...data,
    keyProblems: data.keyProblems
      .map(normalizeKeyProblemRow)
      .filter((p): p is SeoAuditAnalysis["keyProblems"][number] => p != null),
    quickWins: [...data.quickWins],
    checklist: [...data.checklist],
    tenQuickChanges: [...data.tenQuickChanges],
    thirtyDayPlan: {
      week1: [...data.thirtyDayPlan.week1],
      week2: [...data.thirtyDayPlan.week2],
      week3: [...data.thirtyDayPlan.week3],
      week4: [...data.thirtyDayPlan.week4],
    },
    recommendations: {
      seoSpecialist: [...data.recommendations.seoSpecialist],
      contentMarketer: [...data.recommendations.contentMarketer],
      developer: [...data.recommendations.developer],
    },
  };

  if (next.quickWins.length === 0 && next.tenQuickChanges.length > 0) {
    next.quickWins = next.tenQuickChanges.map((t) => ({ title: t, action: t }));
  }

  if (next.tenQuickChanges.length === 0) {
    const fromWins = next.quickWins.map((w) => quickWinTitle(w));
    const fromProblems = next.keyProblems.map((p) => p.howToFix).filter(Boolean);
    next.tenQuickChanges = nonEmptyStrings([...fromWins, ...fromProblems]).slice(0, 10);
  }

  while (next.tenQuickChanges.length < 10 && next.keyProblems.length > 0) {
    const extra = next.keyProblems
      .map((p) => p.howToFix)
      .filter((x) => x && !next.tenQuickChanges.includes(x));
    if (!extra.length) break;
    next.tenQuickChanges.push(...extra.slice(0, 10 - next.tenQuickChanges.length));
  }

  if (next.checklist.length === 0) {
    next.checklist = buildDefaultChecklist(next);
  }

  if (next.keyProblems.length === 0) {
    next.keyProblems = buildKeyProblemsFromChecklist(next.checklist);
  }
  if (next.keyProblems.length === 0) {
    next.keyProblems = buildKeyProblemsFromPageOverview(next);
  }

  if (next.keyProblems.length === 0 && next.tenQuickChanges.length > 0) {
    next.keyProblems = next.tenQuickChanges.slice(0, 6).map((change, i) => ({
      problem: change.slice(0, 120),
      whyItMatters: "Wpływa na widoczność organiczną i konwersję z wyszukiwarki.",
      howToFix: change,
      priority: i < 2 ? "high" : i < 4 ? "medium" : "low",
      difficulty: "medium",
      estimatedImpact: i < 3 ? "high" : "medium",
    }));
  }

  if (planIsEmpty(next.thirtyDayPlan)) {
    const planTasks = nonEmptyStrings([
      ...next.keyProblems.filter((p) => p.priority === "high").map((p) => p.howToFix),
      ...next.keyProblems.map((p) => p.howToFix),
      ...next.tenQuickChanges,
      ...next.quickWins.map((w) => quickWinTitle(w)),
    ]);
    const [w1, w2, w3, w4] = chunkTasks(planTasks, 4, 3);
    next.thirtyDayPlan = {
      week1: w1.length ? w1 : ["Audyt techniczny: title, meta, H1, canonical i indeksacja."],
      week2: w2.length ? w2 : ["Poprawa treści on-page i struktury nagłówków H2–H3."],
      week3: w3.length ? w3 : ["Rozbudowa linkowania wewnętrznego i sekcji FAQ."],
      week4: w4.length ? w4 : ["Schema.org, monitoring pozycji i kolejna iteracja quick wins."],
    };
  }

  if (!next.recommendations.seoSpecialist.length) {
    next.recommendations.seoSpecialist = next.keyProblems
      .slice(0, 5)
      .map((p) => `${p.problem}: ${p.howToFix}`);
  }
  if (!next.recommendations.contentMarketer.length) {
    next.recommendations.contentMarketer = [
      "Uzupełnij meta description pod intencję wyszukiwania i CTR.",
      "Rozbuduj sekcje edukacyjne odpowiadające na pytania klientów.",
      "Dopasuj nagłówki H1/H2 do fraz docelowych bez keyword stuffingu.",
      ...next.tenQuickChanges.slice(0, 2).map((t) => `Przygotuj treść: ${t}`),
    ].slice(0, 6);
  }
  if (!next.recommendations.developer.length) {
    next.recommendations.developer = [
      "Zweryfikuj canonical, meta robots i poprawność indeksacji.",
      "Dodaj lub popraw schema.org (Organization / WebSite / Product).",
      "Optymalizuj Core Web Vitals i czas ładowania kluczowych podstron.",
      ...next.keyProblems
        .filter((p) => /technicz|canonical|schema|indeks|szybko/i.test(`${p.problem} ${p.howToFix}`))
        .slice(0, 2)
        .map((p) => p.howToFix),
    ].slice(0, 6);
  }

  if (!next.agentBrief.trim()) {
    const url = next.pageOverview.fetchedUrl ?? "";
    next.agentBrief =
      `Audyt SEO — ${url}\n` +
      `Wynik: ${next.overallScore}/100 (tech ${next.scores.technical}, on-page ${next.scores.onPage}, treści ${next.scores.content}, autorytet ${next.scores.authority}).\n` +
      `${next.summary}\n\n` +
      `Priorytetowe działania:\n` +
      next.tenQuickChanges
        .slice(0, 5)
        .map((t, i) => `${i + 1}. ${t}`)
        .join("\n");
  }

  return next;
}

export function countFilledSections(data: SeoAuditAnalysis): {
  total: number;
  filled: number;
  missing: string[];
} {
  const checks: [string, boolean][] = [
    ["Podsumowanie", Boolean(data.summary.trim())],
    ["Problemy", data.keyProblems.length > 0],
    ["Checklista", data.checklist.length > 0],
    ["10 szybkich zmian", data.tenQuickChanges.length >= 5],
    ["Plan 30 dni", !planIsEmpty(data.thirtyDayPlan)],
    ["Rekomendacje SEO", data.recommendations.seoSpecialist.length > 0],
    ["Brief agenta", Boolean(data.agentBrief.trim())],
  ];
  const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
  return { total: checks.length, filled: checks.length - missing.length, missing };
}
