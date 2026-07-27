import {
  assertFreeAiAllowed,
  corsHeaders,
  finalizeAiUsage,
  requireUser,
} from "../_shared/aiUsage.ts";
import {
  parseAnthropicMessageUsage,
  usdCentsFromTokenUsage,
} from "../_shared/aiCost.ts";

const MAX_HTML_BYTES = 1_400_000;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0") return true;
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return true;
    if (h.startsWith("::ffff:127.") || h.startsWith("::ffff:10.") ||
        h.startsWith("::ffff:192.168.") || h.startsWith("::ffff:169.254.")) return true;
    return false;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

function assertPublicHttpUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("Nieprawidłowy adres URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Dozwolone są tylko linki http i https.");
  }
  if (isBlockedHost(u.hostname)) {
    throw new Error("Ten adres nie może być pobrany.");
  }
  return u;
}

function normalizeIncomingUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^\/\//.test(t)) return `https:${t}`;
  if (/^[a-z0-9][a-z0-9._/-]*\.[a-z]{2,}([/?#]|$)/i.test(t)) return `https://${t}`;
  return t;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function metaTag(html: string, attr: "property" | "name", key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${key}["'][^>]*>`,
    "i",
  );
  const m = html.match(re) || html.match(re2);
  return m?.[1] ? decodeEntities(m[1]) : null;
}

function stripTagsForText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).slice(0, 14_000);
}

function escapeHtmlBasic(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function readResponseBodyLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Nie udało się odczytać treści strony.");
  const dec = new TextDecoder();
  let buf = "";
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    buf += dec.decode(value, { stream: true });
    if (bytes >= MAX_HTML_BYTES) {
      buf = buf.slice(0, MAX_HTML_BYTES);
      break;
    }
  }
  return buf;
}

async function fetchHtmlDirect(pageUrl: string): Promise<string> {
  const res = await fetch(pageUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "MarketingNow-SeoAudit/1.0 (+https://marketingnow.tech)",
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pl,en;q=0.8",
    },
    signal: AbortSignal.timeout(28_000),
  });
  if (!res.ok) throw new Error(`Strona zwróciła HTTP ${res.status}.`);
  return readResponseBodyLimited(res);
}

async function fetchHtmlViaJinaMirror(pageUrl: string): Promise<string> {
  const endpoint = `https://r.jina.ai/${pageUrl}`;
  const res = await fetch(endpoint, {
    redirect: "follow",
    headers: {
      Accept: "text/markdown,text/plain,*/*;q=0.8",
      "User-Agent": "MarketingNow-SeoAudit/1.0 (+https://marketingnow.tech)",
      "X-Return-Format": "markdown",
    },
    signal: AbortSignal.timeout(35_000),
  });
  if (!res.ok) throw new Error(`Mirror HTTP ${res.status}`);
  const txt = (await res.text()).trim();
  if (txt.length < 50) throw new Error("Mirror zwrócił zbyt mało treści.");
  return (
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Źródło (mirror)</title>` +
    `<meta name="description" content=""/></head><body><article>${escapeHtmlBasic(txt)}</article></body></html>`
  ).slice(0, MAX_HTML_BYTES);
}

async function fetchHtmlLimited(pageUrl: string): Promise<string> {
  try {
    return await fetchHtmlDirect(pageUrl);
  } catch (e) {
    console.warn("seo-audit: bezpośrednie pobranie nieudane, próba mirror", e);
    try {
      return await fetchHtmlViaJinaMirror(pageUrl);
    } catch (e2) {
      const first = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Nie udało się pobrać strony (${first}). Sprawdź URL lub czy strona nie blokuje botów.`,
      );
    }
  }
}

function extractCanonical(html: string): string | null {
  const re = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i;
  const re2 = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i;
  const m = html.match(re) || html.match(re2);
  return m?.[1] ? decodeEntities(m[1].trim()) : null;
}

function countTags(html: string, tag: string): number {
  const re = new RegExp(`<${tag}[\\s>]`, "gi");
  return (html.match(re) || []).length;
}

function firstH1(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m?.[1]) return "";
  return decodeEntities(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 300);
}

function extractSchemaSnippet(html: string): string {
  const m = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m?.[1]) return "brak";
  return decodeEntities(m[1].replace(/\s+/g, " ").trim()).slice(0, 800);
}

function countLinks(html: string, pageUrl: string): { internal: number; external: number } {
  let internal = 0;
  let external = 0;
  let host = "";
  try {
    host = new URL(pageUrl).hostname.replace(/^www\./i, "");
  } catch {
    /* ignore */
  }
  const re = /<a\b[^>]*\bhref=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      continue;
    }
    if (href.startsWith("/") || href.startsWith("#")) {
      internal++;
      continue;
    }
    try {
      const u = new URL(href, pageUrl);
      const h = u.hostname.replace(/^www\./i, "");
      if (host && h === host) internal++;
      else external++;
    } catch {
      internal++;
    }
  }
  return { internal, external };
}

function extractSeoSignals(html: string, pageUrl: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1] ? decodeEntities(titleMatch[1].trim()) : "";
  const metaDescription =
    metaTag(html, "name", "description") || metaTag(html, "property", "og:description") || "";
  const robotsMeta = (metaTag(html, "name", "robots") || "").toLowerCase();
  const hasRobotsNoindex = robotsMeta.includes("noindex");
  const hasSchema = /application\/ld\+json/i.test(html);
  const text = stripTagsForText(html);
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const imgs = (html.match(/<img\b/gi) || []).length;
  const imgsNoAlt = (html.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length;
  const links = countLinks(html, pageUrl);
  return {
    fetchedUrl: pageUrl,
    title,
    metaDescription,
    h1: firstH1(html),
    h1Count: countTags(html, "h1"),
    h2Count: countTags(html, "h2"),
    canonical: extractCanonical(html),
    hasRobotsNoindex,
    hasSchema,
    indexStatus: hasRobotsNoindex ? "noindex (meta robots)" : "brak noindex w meta robots",
    schemaJsonLd: hasSchema ? extractSchemaSnippet(html) : "brak",
    wordCount,
    imagesCount: imgs,
    imagesMissingAlt: imgsNoAlt,
    internalLinksCount: links.internal,
    externalLinksCount: links.external,
    textSample: text.slice(0, 12_000),
  };
}

function clampScore(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function parseAiJson(text: string): Record<string, unknown> | null {
  let t = text.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  t = t.slice(start, end + 1);
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    // repair: trailing commas + control chars
    const repaired = t
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    try {
      return JSON.parse(repaired) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

const strItem = { type: "string" as const };
const priorityProp = { enum: ["high", "medium", "low"] as const };
const difficultyProp = { enum: ["easy", "medium", "hard"] as const };

const seoAuditTool = {
  name: "submit_seo_audit",
  description: "Zwraca profesjonalny raport SEO gotowy do przekazania klientowi.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "overallScore",
      "scores",
      "pageOverview",
      "keyProblems",
      "quickWins",
      "checklist",
      "tenQuickChanges",
      "thirtyDayPlan",
      "recommendations",
      "agentBrief",
    ],
    properties: {
      summary: { type: "string" },
      overallScore: { type: "number", minimum: 0, maximum: 100 },
      scores: {
        type: "object",
        additionalProperties: false,
        required: ["technical", "onPage", "content", "authority"],
        properties: {
          technical: { type: "number", minimum: 0, maximum: 100 },
          onPage: { type: "number", minimum: 0, maximum: 100 },
          content: { type: "number", minimum: 0, maximum: 100 },
          authority: { type: "number", minimum: 0, maximum: 100 },
        },
      },
      pageOverview: {
        type: "object",
        additionalProperties: true,
        required: [
          "title",
          "metaDescription",
          "h1",
          "h1Count",
          "h2Count",
          "canonical",
          "indexStatus",
          "schemaJsonLd",
          "wordCount",
        ],
        properties: {
          title: { type: "string" },
          metaDescription: { type: "string" },
          h1: { type: "string" },
          h1Count: { type: "number" },
          h2Count: { type: "number" },
          canonical: { type: "string" },
          indexStatus: { type: "string" },
          schemaJsonLd: { type: "string" },
          wordCount: { type: "number" },
        },
      },
      keyProblems: {
        type: "array",
        minItems: 5,
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["problem", "whyItMatters", "howToFix", "priority", "difficulty", "estimatedImpact"],
          properties: {
            problem: { type: "string" },
            whyItMatters: { type: "string" },
            howToFix: { type: "string" },
            priority: priorityProp,
            difficulty: difficultyProp,
            estimatedImpact: priorityProp,
          },
        },
      },
      quickWins: { type: "array", minItems: 5, maxItems: 10, items: strItem },
      checklist: { type: "array", minItems: 12, maxItems: 18, items: strItem },
      tenQuickChanges: { type: "array", minItems: 10, maxItems: 10, items: strItem },
      thirtyDayPlan: {
        type: "object",
        additionalProperties: false,
        required: ["week1", "week2", "week3", "week4"],
        properties: {
          week1: { type: "array", minItems: 3, maxItems: 6, items: strItem },
          week2: { type: "array", minItems: 3, maxItems: 6, items: strItem },
          week3: { type: "array", minItems: 3, maxItems: 6, items: strItem },
          week4: { type: "array", minItems: 3, maxItems: 6, items: strItem },
        },
      },
      recommendations: {
        type: "object",
        additionalProperties: false,
        required: ["seoSpecialist", "contentMarketer", "developer"],
        properties: {
          seoSpecialist: { type: "array", minItems: 4, maxItems: 8, items: strItem },
          contentMarketer: { type: "array", minItems: 4, maxItems: 8, items: strItem },
          developer: { type: "array", minItems: 4, maxItems: 8, items: strItem },
        },
      },
      agentBrief: { type: "string" },
    },
  },
} as const;

function buildSeoAuditSystemPrompt(language: string): string {
  return `Jesteś starszym konsultantem SEO i strategiem growth marketingu dla firm SaaS, B2B, e-commerce i agencji marketingowych.

KRYTYCZNA ZASADA JĘZYKA: Cały raport — KAŻDE pole tekstowe (summary, problem, whyItMatters, howToFix, quickWins, checklist, tenQuickChanges, plan, recommendations, agentBrief) — MUSI być napisany w języku: ${language}. Dotyczy to RÓWNIEŻ wszystkich PROPONOWANYCH przykładów treści: sugerowany H1, tytuły sekcji (np. zamiast "Key Features" napisz "Kluczowe funkcje", zamiast "What is Gro?" → "Czym jest Gro?"), przykładowy meta description, teksty alt, pytania FAQ, etykiety linków w stopce (np. "O nas", "Cennik", "Blog", "Kontakt"). Pisz w języku ${language} NAWET jeśli analizowana strona jest w innym języku (np. po angielsku) — nie kopiuj języka źródła. Wyjątki, które zostawiasz w oryginale: (1) nazwy własne i marki (np. "Gro"), (2) terminy techniczne SEO/HTML ("meta description", "canonical", "H1", "schema.org", "SoftwareApplication"), (3) podgląd treści AKTUALNIE istniejącej na stronie, gdy cytujesz ją dosłownie (np. obecny obcięty opis "You don...").

Analizujesz stronę internetową na podstawie danych pobranych przez serwer: title, meta description, H1, H2, treść strony, canonical, robots, indexability, schema.org, linki wewnętrzne, linki zewnętrzne, długość treści, strukturę nagłówków i podstawowe sygnały techniczne.

Twoim zadaniem jest wygenerować profesjonalny raport SEO w języku: ${language}.

Raport ma być konkretny, praktyczny i gotowy do przekazania klientowi. Nie pisz ogólników. Każda rekomendacja musi mówić dokładnie, co trzeba zrobić, dlaczego i jaki może mieć wpływ.

STYL I JAKOŚĆ JĘZYKA (bardzo ważne): Pisz jak doświadczony konsultant SEO przygotowujący raport dla klienta — NIE jak automatyczne tłumaczenie ani odpowiedź AI. Zadbaj o:
- płynny, biznesowy ton i nienaganną polszczyznę (poprawna odmiana, naturalny szyk zdania),
- logiczne, spójne przejścia i jasne nazwanie problemów oraz rekomendacji,
- konkretne, zrozumiałe zalecenia (co zrobić, dlaczego, jaki efekt),
- naturalne tłumaczenie pojęć technicznych — używaj polskich określeń tam, gdzie są naturalne (np. "treść strony", "nagłówki", "linkowanie wewnętrzne", "dane strukturalne"), a angielskich terminów tylko gdy są standardem w branży (canonical, meta description, schema.org),
- unikaj kalek językowych z angielskiego i sztywnych, mechanicznych sformułowań ("to jest ważne ponieważ…", dosłownych tłumaczeń typu "thin content" → napisz "uboga treść").
Nie zmieniaj faktów ani ocen liczbowych — dopracowuj wyłącznie warstwę językową i sposób formułowania.

Uwzględnij:
- ocenę ogólną strony,
- wynik SEO od 0 do 100 (overallScore),
- wynik techniczny, on-page, treści, autorytetu,
- najważniejsze problemy (keyProblems),
- szybkie wygrane (quickWins),
- checklistę (checklist),
- dokładnie 10 szybkich zmian (tenQuickChanges),
- plan działań na 30 dni (thirtyDayPlan: week1–week4),
- rekomendacje dla specjalisty SEO, content marketera i developera,
- agentBrief: gotowy brief do dalszej pracy w agencie (5–8 zdań).

Zasady:
- pageOverview wypełnij na podstawie sygnałów z HTML (signals) — nie wymyślaj faktów spoza danych.
- Gdy czegoś nie widać w HTML — napisz to wprost w rekomendacjach.
- keyProblems: 5–12 pozycji, posortuj po priority (high first).
- JĘZYK: wszystkie wartości tekstowe wypełnij w języku ${language}, nawet gdy badana strona jest w innym języku.
- Nie zwracaj markdown — tylko wywołanie narzędzia submit_seo_audit.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userOrResp = await requireUser(req);
    if (userOrResp instanceof Response) return userOrResp;
    const user = userOrResp;

    const capBlock = await assertFreeAiAllowed(user.id);
    if (capBlock) return capBlock;

    const body = await req.json().catch(() => ({}));
    const urlRaw = typeof body.url === "string" ? normalizeIncomingUrl(body.url) : "";
    const targetKeywords =
      typeof body.targetKeywords === "string" ? body.targetKeywords.trim().slice(0, 500) : "";
    const industry = typeof body.industry === "string" ? body.industry.trim().slice(0, 400) : "";
    const language =
      typeof body.language === "string" && body.language.trim() ? body.language.trim().slice(0, 40) : "polski";

    if (!urlRaw) {
      return new Response(JSON.stringify({ error: "Podaj adres strony (https://…)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pageUrl = assertPublicHttpUrl(urlRaw).href;
    const html = await fetchHtmlLimited(pageUrl);
    const signals = extractSeoSignals(html, pageUrl);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY nie jest skonfigurowany");

    const system = buildSeoAuditSystemPrompt(language);

    const userPrompt = `Przeprowadź audyt SEO strony.

Jeżeli użytkownik podał frazy docelowe, oceń stronę pod kątem tych fraz:
${targetKeywords || "(brak)"}

Jeżeli użytkownik podał branżę, dostosuj rekomendacje do branży:
${industry || "(brak)"}

SYGNAŁY Z POBRANIA HTML (JSON):
${JSON.stringify(signals)}`;

    const inputChars = system.length + userPrompt.length + 200;

    const buildReport = async () => {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 24000,
        system,
        messages: [{ role: "user", content: userPrompt }],
        tools: [seoAuditTool],
        tool_choice: { type: "tool", name: seoAuditTool.name },
      }),
    });

    if (resp.status === 429) {
      throw new Error("Za dużo zapytań — spróbuj za chwilę.");
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("seo-audit anthropic:", resp.status, t);
      throw new Error("Błąd modelu AI — spróbuj ponownie.");
    }

    const data = (await resp.json()) as {
      content?: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
      stop_reason?: string;
      usage?: unknown;
    };
    if (data.stop_reason === "max_tokens") {
      console.warn("seo-audit: odpowiedź modelu obcięta (max_tokens) — raport może być niekompletny.");
    }
    console.log(
      "seo-audit debug: stop_reason=", data.stop_reason,
      "blocks=", (data.content ?? []).map((c) => c.type).join(","),
    );
    const toolBlock = data.content?.find((c) => c.type === "tool_use" && c.name === seoAuditTool.name);
    const textBlock = data.content?.find((c) => c.type === "text");
    const rawOut = textBlock?.text ?? "";
    const parsed = toolBlock?.input && typeof toolBlock.input === "object"
      ? toolBlock.input as Record<string, unknown>
      : parseAiJson(rawOut);
    if (parsed) {
      const dbg: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed)) {
        dbg[k] = Array.isArray(v) ? `array(${v.length})` : typeof v;
      }
      console.log("seo-audit debug: parsed keys:", JSON.stringify(dbg));
      console.log("seo-audit debug: raw input head:", JSON.stringify(parsed).slice(0, 1500));
    }
    if (!parsed) {
      console.error("seo-audit parse fail. Raw output (first 1000):", rawOut.slice(0, 1000), "content:", JSON.stringify(data.content ?? []).slice(0, 1000));
      throw new Error("Model nie zwrócił poprawnego JSON audytu.");
    }

    // Model czasem zwraca tablice/obiekty jako zakodowane stringi JSON — naprawiamy.
    for (const k of [
      "keyProblems",
      "quickWins",
      "checklist",
      "tenQuickChanges",
      "thirtyDayPlan",
      "recommendations",
      "scores",
      "pageOverview",
    ]) {
      const v = parsed[k];
      if (typeof v === "string") {
        const s = v.trim();
        if (s.startsWith("[") || s.startsWith("{")) {
          try {
            parsed[k] = JSON.parse(s);
          } catch {
            /* zostaw jak jest */
          }
        }
      }
    }

    const snapIn = (parsed.pageOverview && typeof parsed.pageOverview === "object"
      ? parsed.pageOverview
      : parsed.pageSnapshot && typeof parsed.pageSnapshot === "object"
      ? parsed.pageSnapshot
      : {}) as Record<string, unknown>;

    const scoresIn = (parsed.scores ?? parsed.categoryScores ?? {}) as Record<string, unknown>;
    const planIn = (parsed.thirtyDayPlan ?? {}) as Record<string, unknown>;
    const recIn = (parsed.recommendations ?? {}) as Record<string, unknown>;

    const strArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String(x))) : [];

    const legacyPlan = Array.isArray(parsed.plan30Days) ? parsed.plan30Days : [];
    const legacyWeek = (i: number): string[] => {
      const w = legacyPlan[i] as { tasks?: unknown } | undefined;
      return Array.isArray(w?.tasks) ? w.tasks.map((t) => String(t)) : [];
    };

    let week1 = strArr(planIn.week1);
    let week2 = strArr(planIn.week2);
    let week3 = strArr(planIn.week3);
    let week4 = strArr(planIn.week4);
    if (!week1.length && !week2.length && !week3.length && !week4.length && legacyPlan.length) {
      week1 = legacyWeek(0);
      week2 = legacyWeek(1);
      week3 = legacyWeek(2);
      week4 = legacyWeek(3);
    }

    const keyProblems = Array.isArray(parsed.keyProblems) ? parsed.keyProblems : [];
    const quickWins = Array.isArray(parsed.quickWins) ? parsed.quickWins : [];
    let tenQuickChanges = strArr(parsed.tenQuickChanges);
    if (!tenQuickChanges.length && quickWins.length) {
      tenQuickChanges = quickWins.slice(0, 10).map((w) =>
        typeof w === "string" ? w : (w as { title?: string; action?: string }).title ?? String(w),
      );
    }

    if (!week1.length && !week2.length) {
      const planTasks = [
        ...keyProblems.map((p) => (p as { howToFix?: string }).howToFix ?? "").filter(Boolean),
        ...tenQuickChanges,
      ];
      week1 = planTasks.slice(0, 3);
      week2 = planTasks.slice(3, 6);
      week3 = planTasks.slice(6, 9);
      week4 = planTasks.slice(9, 12);
    }

    const out = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      overallScore: clampScore(parsed.overallScore ?? parsed.seoScore),
      scores: {
        technical: clampScore(scoresIn.technical),
        onPage: clampScore(scoresIn.onPage),
        content: clampScore(scoresIn.content),
        authority: clampScore(scoresIn.authority),
      },
      pageOverview: {
        fetchedUrl: pageUrl,
        title: typeof snapIn.title === "string" ? snapIn.title : signals.title,
        metaDescription:
          typeof snapIn.metaDescription === "string"
            ? snapIn.metaDescription
            : signals.metaDescription,
        h1: typeof snapIn.h1 === "string" ? snapIn.h1 : signals.h1,
        h1Count: clampScore(snapIn.h1Count ?? signals.h1Count),
        h2Count: clampScore(snapIn.h2Count ?? signals.h2Count),
        canonical:
          typeof snapIn.canonical === "string"
            ? snapIn.canonical
            : signals.canonical ?? "",
        indexStatus:
          typeof snapIn.indexStatus === "string" ? snapIn.indexStatus : signals.indexStatus,
        schemaJsonLd:
          typeof snapIn.schemaJsonLd === "string" ? snapIn.schemaJsonLd : signals.schemaJsonLd,
        wordCount: clampScore(snapIn.wordCount ?? signals.wordCount),
      },
      keyProblems,
      quickWins,
      checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
      tenQuickChanges,
      thirtyDayPlan: { week1, week2, week3, week4 },
      recommendations: {
        seoSpecialist: strArr(recIn.seoSpecialist).length
          ? strArr(recIn.seoSpecialist)
          : keyProblems.slice(0, 5).map((p) => {
              const row = p as { problem?: string; howToFix?: string };
              return `${row.problem ?? "Problem SEO"}: ${row.howToFix ?? "Wdróż poprawkę."}`;
            }),
        contentMarketer: strArr(recIn.contentMarketer).length
          ? strArr(recIn.contentMarketer)
          : tenQuickChanges.slice(0, 4).map((t) => `Przygotuj treść: ${t}`),
        developer: strArr(recIn.developer).length
          ? strArr(recIn.developer)
          : [
              "Zweryfikuj canonical, meta robots i poprawność indeksacji.",
              "Dodaj lub popraw schema.org JSON-LD.",
              "Optymalizuj szybkość ładowania i Core Web Vitals.",
            ],
      },
      agentBrief: typeof parsed.agentBrief === "string" ? parsed.agentBrief : "",
    };

    const anthropicUsage = parseAnthropicMessageUsage(data);
    const actualUsdCents = anthropicUsage
      ? usdCentsFromTokenUsage("claude-sonnet-4-5-20250929", anthropicUsage)
      : undefined;

    await finalizeAiUsage({
      userId: user.id,
      source: "seo-audit",
      actualUsdCents,
      tokenUsage: anthropicUsage
        ? { model: "claude-sonnet-4-5-20250929", usage: anthropicUsage }
        : undefined,
      extraDetail: { pageUrl, anthropicUsage },
    });

    return out;
    };

    // Stream keep-alive whitespace so the gateway nie zrywa połączenia (limit ~150 s),
    // a na końcu dopisujemy właściwy JSON (wiodące spacje są poprawnym JSON-em).
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const hb = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(" "));
          } catch {
            clearInterval(hb);
          }
        }, 10_000);
        buildReport()
          .then((out) => {
            controller.enqueue(encoder.encode(JSON.stringify(out)));
          })
          .catch((e) => {
            const msg = e instanceof Error ? e.message : "Unknown";
            console.error("seo-audit buildReport error:", e);
            controller.enqueue(encoder.encode(JSON.stringify({ error: msg })));
          })
          .finally(() => {
            clearInterval(hb);
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          });
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seo-audit error:", e);
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
