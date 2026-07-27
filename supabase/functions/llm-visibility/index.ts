import {
  assertFreeAiAllowed,
  corsHeaders,
  finalizeAiUsage,
  requireUser,
} from "../_shared/aiUsage.ts";
import { usdCentsFromGatewayCompletion } from "../_shared/aiCost.ts";

type Json = Record<string, unknown>;

function parseAiJson(text: string): Json | null {
  let t = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  t = t.slice(start, end + 1);
  try {
    return JSON.parse(t) as Json;
  } catch {
    const repaired = t.replace(/,\s*([}\]])/g, "$1").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    try {
      return JSON.parse(repaired) as Json;
    } catch {
      return null;
    }
  }
}

const strItem = { type: "string" as const };
const llmVisibilityTool = {
  name: "submit_llm_visibility",
  description:
    "Zwraca profesjonalny raport widoczności marki w wyszukiwarkach AI (GEO / LLM visibility), gotowy do przekazania klientowi.",
  input_schema: {
    type: "object",
    required: [
      "executiveSummary",
      "visibilityScore",
      "confidence",
      "summary",
      "limitations",
      "topActions",
      "metrics",
      "queryResults",
      "competitorAnalysis",
      "recommendations",
      "contentIdeas",
      "thirtyDayPlan",
      "missingQueries",
    ],
    properties: {
      executiveSummary: { type: "string" },
      visibilityScore: { type: "number" },
      confidence: {
        type: "object",
        required: ["level", "rationale"],
        properties: {
          level: { type: "string" },
          rationale: { type: "string" },
        },
      },
      summary: { type: "string" },
      limitations: { type: "array", items: strItem },
      topActions: { type: "array", items: strItem },
      metrics: {
        type: "object",
        required: [
          "visibilityInQueries",
          "brandMentions",
          "totalQueries",
          "mentionsWithSources",
          "aiShareOfVoice",
          "sentiment",
        ],
        properties: {
          visibilityInQueries: { type: "number" },
          brandMentions: { type: "number" },
          totalQueries: { type: "number" },
          mentionsWithSources: { type: "number" },
          aiShareOfVoice: { type: "number" },
          sentiment: {
            type: "object",
            required: ["positive", "neutral", "negative"],
            properties: {
              positive: { type: "number" },
              neutral: { type: "number" },
              negative: { type: "number" },
            },
          },
        },
      },
      queryResults: {
        type: "array",
        items: {
          type: "object",
          required: [
            "query",
            "model",
            "brandMentioned",
            "brandPosition",
            "competitorsMentioned",
            "sourceMentioned",
            "sentiment",
            "comment",
          ],
          properties: {
            query: { type: "string" },
            model: { type: "string" },
            brandMentioned: { type: "boolean" },
            brandPosition: { type: "number" },
            competitorsMentioned: { type: "array", items: strItem },
            sourceMentioned: { type: "boolean" },
            sourceUrls: { type: "array", items: strItem },
            sentiment: { type: "string" },
            comment: { type: "string" },
          },
        },
      },
      competitorAnalysis: {
        type: "array",
        items: {
          type: "object",
          required: ["competitor", "mentions", "shareOfVoice", "strengths", "contentGaps"],
          properties: {
            competitor: { type: "string" },
            mentions: { type: "number" },
            shareOfVoice: { type: "number" },
            strengths: { type: "array", items: strItem },
            contentGaps: { type: "array", items: strItem },
          },
        },
      },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "problem", "whyItMatters", "howToFix", "priority", "difficulty", "impact", "owner"],
          properties: {
            title: { type: "string" },
            problem: { type: "string" },
            whyItMatters: { type: "string" },
            howToFix: { type: "string" },
            priority: { type: "string" },
            difficulty: { type: "string" },
            impact: { type: "string" },
            owner: { type: "string" },
          },
        },
      },
      contentIdeas: {
        type: "array",
        items: {
          type: "object",
          required: ["title", "type", "targetQuery", "goal"],
          properties: {
            title: { type: "string" },
            type: { type: "string" },
            targetQuery: { type: "string" },
            goal: { type: "string" },
          },
        },
      },
      thirtyDayPlan: {
        type: "object",
        required: ["week1", "week2", "week3", "week4"],
        properties: {
          week1: { type: "array", items: strItem },
          week2: { type: "array", items: strItem },
          week3: { type: "array", items: strItem },
          week4: { type: "array", items: strItem },
        },
      },
      missingQueries: {
        type: "array",
        items: {
          type: "object",
          required: ["query", "reason", "recommendedAction"],
          properties: {
            query: { type: "string" },
            reason: { type: "string" },
            recommendedAction: { type: "string" },
          },
        },
      },
    },
  },
} as const;

function buildSystemPrompt(language: string): string {
  return `Jesteś doświadczonym analitykiem widoczności marek w wyszukiwarkach AI (ChatGPT, Perplexity, Claude, Gemini, Google AI Overviews). Przygotowujesz raport „Widoczność marki w AI”, który ma wyglądać jak analiza napisana przez człowieka — nie jak automatyczny szablon.

JĘZYK I STYL (${language}):
- Pisz naturalnym, poprawnym językiem polskim: konkretnie, spokojnie, bez korpojęzyka i pustych haseł.
- Nie używaj angielskich etykiet ani żargonu (np. „executive summary”, „metrics”, „high/medium/low”, „share of voice”). Tłumacz pojęcia naturalnie (np. udział marki w odpowiedziach AI).
- Nie dramatyzuj. Nie pisz „marka jest niewidoczna”, „marka przegrywa w AI”, „pilnie trzeba wdrożyć strategię”, „brak obecności w danych treningowych”. Zamiast tego pisz ostrożnie: „marka nie pojawiła się w badanym zestawie odpowiedzi”, „wynik może wskazywać na niską rozpoznawalność w tym typie zapytań”, „brak wzmianki nie musi oznaczać braku widoczności w całej kategorii”.

ZAKAZ PLACEHOLDERÓW I MIESZANIA DOMEN:
- Nigdy nie zostawiaj sformułowań typu „tej kategorii”, „ta branża”, „ten segment”, „nazwa marki”, „adres URL firmy”. Zawsze wpisuj konkret.
- Nigdy nie wstawiaj domen spoza bieżącej analizy (np. sonex-meble.pl przy analizie google.com). Używaj wyłącznie domeny analizowanej marki i podanych konkurentów.
- visibilityScore musi wynikać z queryResults — nie zgaduj arbitralnie.
- Określ kategorię konkretnie na podstawie strony, opisu oferty i kontekstu (np. „hurt FMCG”, „oprogramowanie księgowe”, „kancelarie prawne”, „sklepy internetowe”, „narzędzia SaaS”, „deweloperzy mieszkaniowi”). Jeśli kategorii nie da się ustalić, napisz wprost: „kategoria wymaga doprecyzowania”.

DOPASOWANIE DO FIRMY (ustal przed pisaniem):
- czym zajmuje się marka, czy działa B2B, B2C czy B2B2C, kto jest jej klientem, w jakiej konkretnej kategorii powinna być widoczna i jakie realne pytania zadaje jej grupa docelowa.
- Dla firm B2B używaj pytań decyzyjnych, zakupowych i porównawczych (np. „jaki dostawca dla małej firmy”, „porównanie dostawców”, „warunki współpracy”, „koszty wdrożenia”, „opinie klientów biznesowych”, „alternatywy dla [marka]”). Nie oceniaj firmy B2B jak marki konsumenckiej.

ODDZIEL WYNIK OD JAKOŚCI BADANIA:
- Jeśli zapytania były źle dobrane, zbyt ogólne albo niedopasowane do firmy, napisz to wprost i nie wyciągaj z nich mocnych wniosków.
- Gdy badanie jest słabe, w executiveSummary i summary zaznacz: „Na podstawie obecnego zestawu zapytań nie da się rzetelnie ocenić widoczności marki w AI. Wynik należy traktować jako wstępny, ponieważ część pytań była zbyt ogólna lub niedopasowana do kategorii.”
- confidence.level: „wysoka”, „średnia” lub „niska”; w confidence.rationale uzasadnij (liczba i trafność zapytań, jakość danych, źródła, konkurencja, modele).
- limitations: wskaż realne ograniczenia analizy (mała próba, zapytania zbyt ogólne, brak doprecyzowanej kategorii, brak danych historycznych, zmienność odpowiedzi AI).

REKOMENDACJE I ZAPYTANIA — KONKRETNIE:
- Rekomendacje muszą być konkretne: jakie podstrony stworzyć, jakie artykuły napisać, jakie pytania FAQ dodać, jakie porównania przygotować, jakie dane opublikować, jakie źródła zewnętrzne pozyskać, jakie zapytania ponownie przetestować. Unikaj ogólników („zbuduj strategię widoczności”, „twórz AI-friendly content”).
- W polu missingQueries zaproponuj 12 realistycznych zapytań dopasowanych do branży, marki i grupy docelowej (jako lepszy zestaw do kolejnego badania). Przykładowe wzorce: „Jak wybrać dostawcę [konkretna kategoria]?”, „Najlepsze firmy z kategorii [konkretna kategoria] w Polsce”, „Porównanie [marka] z konkurencją”, „Czy [marka] jest dobrą opcją dla [typ klienta]?”, „Ile kosztuje [usługa/produkt]?”, „Alternatywy dla [marka]”, „Ranking firm [konkretna kategoria]”, „Opinie o [marka]”. Nie używaj pytań z placeholderem typu „najlepsze narzędzie w kategorii tej kategorii”.
- Każda liczba w metrics i każdy komentarz w queryResults musi mieć krótką, ostrożną interpretację (co oznacza, czy wiarygodna, co zrobić najpierw). Diagnozuj przyczynę, nie tylko objaw.
- Nie powielaj tych samych zdań w executiveSummary, summary i recommendations.

ETYKIETY PRIORYTETÓW:
- W polach priority i impact zwracaj wyłącznie „high”, „medium” lub „low” (interfejs wyświetla je jako „wysoki/średni/niski priorytet”). Sortuj recommendations od „high”.

Zasady techniczne:
- queryResults: minimum 5 wierszy — marka, pozycja, konkurenci, źródła, wydźwięk.
- metrics spójne z queryResults.
- recommendations: 4–12. thirtyDayPlan: konkretne działania na 4 tygodnie, każde z jasnym celem.
- Zwróć wynik WYŁĄCZNIE przez wywołanie narzędzia submit_llm_visibility — bez markdown i bez tekstu poza narzędziem.`;
}

function normalizeDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

const PLACEHOLDER_CATEGORY = /tej\s+kategorii|ta\s+branża|twoja\s+branża|^np\.\s|^saas$|^b2b$|^marketing$/i;

function validateRequestBody(body: Json): { ok: true } | { ok: false; message: string } {
  const brand = typeof body.brandName === "string" ? body.brandName.trim() : "";
  const url = typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";
  const industry = typeof body.industry === "string" ? body.industry.trim() : "";

  if (!brand) return { ok: false, message: "Podaj nazwę marki." };
  if (!url) return { ok: false, message: "Podaj poprawny URL analizowanej marki." };
  try {
    new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return { ok: false, message: "URL musi być poprawnym adresem domeny." };
  }
  if (!industry) {
    return {
      ok: false,
      message:
        "Nie można wygenerować wiarygodnego raportu, ponieważ brakuje precyzyjnej kategorii rynku. Uzupełnij branżę, np. »systemy reklamowe dla MŚP«, »agencja marketingowa«, »narzędzie SaaS do kampanii Meta Ads«.",
    };
  }
  if (PLACEHOLDER_CATEGORY.test(industry)) {
    return {
      ok: false,
      message:
        "Nie można wygenerować wiarygodnego raportu, ponieważ brakuje precyzyjnej kategorii rynku. Uzupełnij branżę, np. »systemy reklamowe dla MŚP«, »agencja marketingowa«, »narzędzie SaaS do kampanii Meta Ads«.",
    };
  }
  return { ok: true };
}

function buildUserPrompt(input: Json, language: string): string {
  const get = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : "");
  const analyzedDomain = normalizeDomain(get("websiteUrl"));
  return `Przeprowadź analizę widoczności marki w wyszukiwarkach AI i zwróć WYŁĄCZNIE poprawny JSON bez markdown.

KONTEKST ANALIZY (izolowany — nie mieszaj z innymi domenami):
- Analizowana marka: ${get("brandName") || "—"}
- Analizowana domena: ${analyzedDomain}
- Kategoria rynku: ${get("industry") || "—"}
- Dozwolone domeny w raporcie: wyłącznie ${analyzedDomain} oraz ewentualni konkurenci z listy poniżej.
- NIGDY nie wstawiaj domen z poprzednich analiz (np. sonex-meble.pl, drivead.eu) jeśli nie są na liście konkurentów.

Wymagany kształt JSON:
{
  "executiveSummary": "string",
  "visibilityScore": 0,
  "confidence": { "level": "wysoka|średnia|niska", "rationale": "string" },
  "summary": "string",
  "limitations": ["string"],
  "topActions": ["string"],
  "metrics": { "visibilityInQueries": 0, "brandMentions": 0, "totalQueries": 0, "mentionsWithSources": 0, "aiShareOfVoice": 0, "sentiment": { "positive": 0, "neutral": 0, "negative": 0 } },
  "queryResults": [{ "query": "string", "model": "string", "brandMentioned": true, "brandPosition": 1, "competitorsMentioned": ["string"], "sourceMentioned": true, "sourceUrls": ["https://..."], "sentiment": "positive|neutral|negative", "comment": "string" }],
  "competitorAnalysis": [{ "competitor": "string", "mentions": 0, "shareOfVoice": 0, "strengths": ["string"], "contentGaps": ["string"] }],
  "recommendations": [{ "title": "string", "problem": "string", "whyItMatters": "string", "howToFix": "string", "priority": "high|medium|low", "difficulty": "easy|medium|hard", "impact": "high|medium|low", "owner": "SEO|content|developer|PR" }],
  "contentIdeas": [{ "title": "string", "type": "string", "targetQuery": "string", "goal": "string" }],
  "thirtyDayPlan": { "week1": ["string"], "week2": ["string"], "week3": ["string"], "week4": ["string"] },
  "missingQueries": [{ "query": "string", "reason": "string", "recommendedAction": "string" }]
}

Nazwa marki: ${get("brandName") || "—"}
URL strony: ${get("websiteUrl") || "—"}
Branża: ${get("industry") || "—"}
Opis oferty: ${get("offerDescription") || "—"}
Grupa docelowa: ${get("targetAudience") || "—"}
Konkurenci: ${get("competitors") || "—"}
Zapytania do analizy (jedno na linię):
${get("targetKeywords") || "(brak — zaproponuj 8–12 realistycznych zapytań dla tej branży)"}
Modele AI do uwzględnienia: ${get("aiModels") || "ChatGPT, Gemini, Claude, Perplexity"}
Język raportu: ${language}

Najpierw ustal, czym konkretnie zajmuje się marka, w jakim modelu działa (B2B, B2C czy B2B2C), kto jest jej klientem i w jakiej konkretnej kategorii powinna być widoczna w odpowiedziach AI. Nazwij tę kategorię wprost — nie używaj określeń typu „ta kategoria”. Jeżeli kategorii nie da się ustalić z dostępnych danych, napisz to jasno.

Jeśli dostarczone zapytania są zbyt ogólne lub niedopasowane do firmy, zaznacz to w podsumowaniu i ograniczeniach oraz obniż poziom pewności — nie wyciągaj z nich mocnych wniosków. W polu missingQueries zaproponuj lepiej dobrane, realistyczne zapytania do kolejnego badania.

Wygeneruj pełny raport teraz.`;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String(x))) : [];
}

function clamp(n: unknown, max = 100): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(max, Math.round(x)));
}

/** Buduje wynik zgodny z LlmVisibilityAnalysisSchema (klient), wypełniając pola legacy z bogatych danych. */
function buildOutput(parsed: Json): Json {
  const queryResults = Array.isArray(parsed.queryResults) ? (parsed.queryResults as Json[]) : [];
  const competitorAnalysis = Array.isArray(parsed.competitorAnalysis) ? (parsed.competitorAnalysis as Json[]) : [];
  const recommendations = Array.isArray(parsed.recommendations) ? (parsed.recommendations as Json[]) : [];

  const brandMentions = queryResults.map((q) => ({
    query: typeof q.query === "string" ? q.query : "",
    appears: Boolean(q.brandMentioned),
    position: typeof q.brandPosition === "number" ? q.brandPosition : null,
    sentiment: typeof q.sentiment === "string" ? q.sentiment : "neutral",
    comment: typeof q.comment === "string" ? q.comment : "",
    aiModel: typeof q.model === "string" ? q.model : "ChatGPT",
    citations: q.sourceMentioned ? 1 : 0,
  }));

  const competitors = competitorAnalysis.map((c) => ({
    name: typeof c.competitor === "string" ? c.competitor : "",
    visibilityScore: clamp(c.shareOfVoice),
    mentions: clamp(c.mentions, 9999),
    sentiment: "neutralny",
    advantage: strArr(c.strengths)[0] ?? "",
  }));

  const recommendedActions = recommendations.map((r) => ({
    priority: typeof r.priority === "string" ? r.priority : "medium",
    action: typeof r.howToFix === "string" && r.howToFix ? r.howToFix : String(r.title ?? ""),
    reason: typeof r.whyItMatters === "string" ? r.whyItMatters : "",
    expectedImpact: typeof r.impact === "string" ? r.impact : "medium",
  }));

  const contentIdeas = Array.isArray(parsed.contentIdeas)
    ? (parsed.contentIdeas as Json[]).map((c) => ({
        title: typeof c.title === "string" ? c.title : "",
        type: typeof c.type === "string" ? c.type : (typeof c.format === "string" ? c.format : "artykuł"),
        targetQuery: typeof c.targetQuery === "string" ? c.targetQuery : "",
        goal: typeof c.goal === "string" ? c.goal : (typeof c.whyItHelps === "string" ? c.whyItHelps : ""),
      }))
    : [];

  const metrics = (parsed.metrics && typeof parsed.metrics === "object" ? parsed.metrics : {}) as Json;
  const plan = (parsed.thirtyDayPlan && typeof parsed.thirtyDayPlan === "object" ? parsed.thirtyDayPlan : {}) as Json;
  const conf = (parsed.confidence && typeof parsed.confidence === "object" ? parsed.confidence : {}) as Json;

  return {
    executiveSummary: typeof parsed.executiveSummary === "string" ? parsed.executiveSummary : "",
    visibilityScore: clamp(parsed.visibilityScore),
    confidence: {
      level: typeof conf.level === "string" ? conf.level : "średnia",
      rationale: typeof conf.rationale === "string" ? conf.rationale : "",
    },
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    limitations: strArr(parsed.limitations),
    topActions: strArr(parsed.topActions),
    metrics: {
      visibilityInQueries: clamp(metrics.visibilityInQueries),
      brandMentions: clamp(metrics.brandMentions, 9999),
      totalQueries: clamp(metrics.totalQueries, 9999),
      mentionsWithSources: clamp(metrics.mentionsWithSources, 9999),
      aiShareOfVoice: clamp(metrics.aiShareOfVoice),
      sentiment: {
        positive: clamp((metrics.sentiment as Json)?.positive, 9999),
        neutral: clamp((metrics.sentiment as Json)?.neutral, 9999),
        negative: clamp((metrics.sentiment as Json)?.negative, 9999),
      },
    },
    queryResults,
    competitorAnalysis,
    recommendations,
    contentIdeas,
    thirtyDayPlan: {
      week1: strArr(plan.week1),
      week2: strArr(plan.week2),
      week3: strArr(plan.week3),
      week4: strArr(plan.week4),
    },
    // pola legacy wymagane przez schemat klienta:
    brandMentions,
    competitors,
    recommendedActions,
    missingQueries: Array.isArray(parsed.missingQueries) ? parsed.missingQueries : [],
    promptTests: [],
    visibilityTrend: [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userOrResp = await requireUser(req);
    if (userOrResp instanceof Response) return userOrResp;
    const user = userOrResp;

    const capBlock = await assertFreeAiAllowed(user.id);
    if (capBlock) return capBlock;

    const body = (await req.json().catch(() => ({}))) as Json;
    const language =
      typeof body.language === "string" && body.language.trim() ? body.language.trim().slice(0, 40) : "polski";

    const reqValidation = validateRequestBody(body);
    if (!reqValidation.ok) {
      return new Response(JSON.stringify({ error: reqValidation.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY nie jest skonfigurowany");

    const system = buildSystemPrompt(language);
    const userPrompt = buildUserPrompt(body, language);
    const inputChars = system.length + userPrompt.length + 200;

    // Szybki model przez bramkę AI — bez tego analiza przekraczała limit czasu (timeout).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 110_000);
    let resp: Response;
    try {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Lovable-API-Key": LOVABLE_API_KEY,
          "X-Lovable-AIG-SDK": "edge-function-fetch",
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const aborted = err instanceof Error && err.name === "AbortError";
      console.error("llm-visibility fetch error:", err);
      return new Response(
        JSON.stringify({
          error: aborted
            ? "Analiza trwała zbyt długo. Spróbuj ponownie lub zmniejsz liczbę zapytań."
            : "Błąd połączenia z modelem AI — spróbuj ponownie.",
        }),
        { status: aborted ? 504 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    clearTimeout(timeoutId);

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Za dużo zapytań — spróbuj za chwilę." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Wykorzystano limit planu. Rozważ upgrade w „Plan i kredyty”." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("llm-visibility gateway:", resp.status, t);
      return new Response(JSON.stringify({ error: "Błąd modelu AI — spróbuj ponownie." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = (await resp.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
          tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
        };
      }>;
    };
    const message = data.choices?.[0]?.message;
    const toolArgs = message?.tool_calls?.find((c) => c.function?.name === llmVisibilityTool.name)?.function
      ?.arguments;
    const rawOut = message?.content ?? "";
    let parsed: Json | null = null;
    if (toolArgs) {
      try {
        parsed = JSON.parse(toolArgs) as Json;
      } catch {
        parsed = parseAiJson(toolArgs);
      }
    }
    if (!parsed) parsed = parseAiJson(rawOut);
    if (!parsed) {
      console.error("llm-visibility parse fail. Raw:", (toolArgs ?? rawOut).slice(0, 1000));
      return new Response(JSON.stringify({ error: "Model nie zwrócił poprawnego JSON raportu." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const out = buildOutput(parsed);

    const actualUsdCents = usdCentsFromGatewayCompletion("google/gemini-3-flash-preview", data);

    await finalizeAiUsage({
      userId: user.id,
      source: "llm-visibility",
      actualUsdCents: actualUsdCents ?? undefined,
      extraDetail: { gatewayUsage: (data as { usage?: unknown }).usage ?? null },
    });

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("llm-visibility error:", e);
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});