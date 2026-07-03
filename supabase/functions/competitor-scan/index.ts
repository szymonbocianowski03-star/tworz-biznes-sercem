import {
  assertFreeAiAllowed,
  corsHeaders,
  finalizeAiUsage,
  requireUser,
} from "../_shared/aiUsage.ts";
import { usdCentsFromGatewayCompletion } from "../_shared/aiCost.ts";

const MAX_HTML_BYTES = 1_400_000;
const MAX_IMAGES = 18;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0") return true;
  if (h.includes(":")) {
    // IPv6: block loopback (::1), unspecified (::), link-local (fe80::/10),
    // unique-local (fc00::/7 → fc.. / fd..), and IPv4-mapped loopback.
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

/** Użytkownik często wkleja domenę bez schematu — bez tego `new URL` się wywali. */
function normalizeIncomingUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^\/\//.test(t)) return `https:${t}`;
  if (/^[a-z0-9][a-z0-9._/-]*\.[a-z]{2,}([/?#]|$)/i.test(t)) return `https://${t}`;
  return t;
}

function escapeHtmlBasic(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function absUrl(base: string, href: string): string | null {
  try {
    const u = new URL(href.trim(), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function collectImages(html: string, pageUrl: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (h: string | null) => {
    if (!h || h.startsWith("data:")) return;
    const a = absUrl(pageUrl, h);
    if (!a || seen.has(a)) return;
    seen.add(a);
    out.push(a);
  };
  const og = metaTag(html, "property", "og:image");
  push(og ?? null);
  const tw = metaTag(html, "name", "twitter:image");
  push(tw ?? null);
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    push(m[1]);
    if (out.length >= MAX_IMAGES) break;
  }
  const srcsetRe = /<img[^>]+srcset=["']([^"']+)["'][^>]*>/gi;
  while ((m = srcsetRe.exec(html)) !== null) {
    const first = m[1].split(",")[0]?.trim().split(/\s+/)[0];
    push(first ?? null);
    if (out.length >= MAX_IMAGES) break;
  }
  return out.slice(0, MAX_IMAGES);
}

const SOCIAL_RE =
  /href=["'](https?:\/\/[^"']*(?:instagram\.com|tiktok\.com|youtube\.com|youtu\.be|linkedin\.com|twitter\.com|x\.com|facebook\.com)[^"']*)["']/gi;

function collectSocialLinks(html: string): { label: string; url: string }[] {
  const seen = new Set<string>();
  const out: { label: string; url: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = SOCIAL_RE.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    let label = "Social";
    if (url.includes("instagram.com")) label = "Instagram";
    else if (url.includes("tiktok.com")) label = "TikTok";
    else if (url.includes("youtube.com") || url.includes("youtu.be")) label = "YouTube";
    else if (url.includes("linkedin.com")) label = "LinkedIn";
    else if (url.includes("twitter.com") || url.includes("x.com")) label = "X / Twitter";
    else if (url.includes("facebook.com")) label = "Facebook";
    out.push({ label, url });
  }
  return out;
}

function collectHeadings(html: string, tag: "h1" | "h2" | "h3"): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = decodeEntities(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length >= 2 && text.length <= 200 && !seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
    if (out.length >= 12) break;
  }
  return out;
}

/** Wykrywa popularne piksele / tagi trackingowe na podstawie sygnatur w HTML. */
function collectPixels(html: string): string[] {
  const found = new Set<string>();
  const checks: [string, RegExp][] = [
    ["Meta Pixel", /connect\.facebook\.net|fbq\(|facebook-jssdk/i],
    ["Google Analytics (GA4)", /gtag\(|googletagmanager\.com\/gtag|G-[A-Z0-9]{6,}/],
    ["Google Tag Manager", /googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/],
    ["Google Ads", /googleadservices\.com|AW-[0-9]+/],
    ["LinkedIn Insight", /snap\.licdn\.com|_linkedin_partner_id/i],
    ["TikTok Pixel", /analytics\.tiktok\.com|ttq\.load/i],
    ["Hotjar", /static\.hotjar\.com|hjid/i],
    ["HubSpot", /js\.hs-scripts\.com|hs-analytics/i],
    ["Microsoft Clarity", /clarity\.ms\/tag/i],
    ["Pinterest Tag", /s\.pinimg\.com|pintrk\(/i],
  ];
  for (const [name, re] of checks) {
    if (re.test(html)) found.add(name);
  }
  return [...found];
}

/** Zbiera typy schema.org z atrybutów itemtype oraz bloków JSON-LD. */
function collectSchemaTypes(html: string): string[] {
  const types = new Set<string>();
  const itemRe = /itemtype=["']https?:\/\/schema\.org\/([A-Za-z]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html)) !== null) types.add(m[1]);
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = ldRe.exec(html)) !== null) {
    const typeMatches = m[1].match(/"@type"\s*:\s*"([^"]+)"/g);
    if (typeMatches) {
      for (const t of typeMatches) {
        const v = t.match(/"@type"\s*:\s*"([^"]+)"/)?.[1];
        if (v) types.add(v);
      }
    }
  }
  return [...types].slice(0, 12);
}

function findCanonical(html: string): string | null {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  return m?.[1] ?? null;
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
      "User-Agent": "MarketingNow-CompetitorScan/1.0 (+https://marketingnow.tech)",
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pl,en;q=0.8",
    },
    signal: AbortSignal.timeout(28_000),
  });
  if (!res.ok) throw new Error(`Strona zwróciła HTTP ${res.status}.`);
  return readResponseBodyLimited(res);
}

/** Gdy strona blokuje Edge (403/timeout), Jina Reader często zwraca czytelny tekst/markdown. */
async function fetchHtmlViaJinaMirror(pageUrl: string): Promise<string> {
  const endpoint = `https://r.jina.ai/${pageUrl}`;
  const res = await fetch(endpoint, {
    redirect: "follow",
    headers: {
      Accept: "text/markdown,text/plain,*/*;q=0.8",
      "User-Agent": "MarketingNow-CompetitorScan/1.0 (+https://marketingnow.tech)",
      "X-Return-Format": "markdown",
    },
    signal: AbortSignal.timeout(35_000),
  });
  if (!res.ok) throw new Error(`Mirror HTTP ${res.status}`);
  const txt = (await res.text()).trim();
  if (txt.length < 50) throw new Error("Mirror zwrócił zbyt mało treści.");
  const wrapped =
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Źródło (mirror)</title>` +
    `<meta name="description" content=""/></head><body><article>${escapeHtmlBasic(txt)}</article></body></html>`;
  return wrapped.slice(0, MAX_HTML_BYTES);
}

async function fetchHtmlLimited(pageUrl: string): Promise<{ html: string; source: "direct" | "mirror" }> {
  try {
    return { html: await fetchHtmlDirect(pageUrl), source: "direct" };
  } catch (e) {
    console.warn("competitor-scan: bezpośrednie pobranie nieudane, próba mirror", e);
    try {
      return { html: await fetchHtmlViaJinaMirror(pageUrl), source: "mirror" };
    } catch (e2) {
      console.warn("competitor-scan: mirror nieudany", e2);
      const first = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Nie udało się pobrać strony (${first}). Spróbuj innego URL, wklej treść ręcznie albo sprawdź, czy strona nie blokuje botów.`,
      );
    }
  }
}

type ScoreObj = {
  valueProp: number;
  seoSignals: number;
  socialPresence: number;
  aiVisibilityEst: number;
};

type AiOut = {
  analysisMarkdown: string;
  viralQueries: string[];
  brandGuess: string;
  industry: string;
  scores: ScoreObj | null;
  summaryBullets: string[];
  landingBullets: string[];
  adsBullets: string[];
  seoBullets: string[];
  socialBullets: string[];
  llmBullets: string[];
  recommendationsBullets: string[];
};

function asStringList(v: unknown, max = 14): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
}

function clampScore(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function parseScores(v: unknown): ScoreObj | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    valueProp: clampScore(o.valueProp),
    seoSignals: clampScore(o.seoSignals),
    socialPresence: clampScore(o.socialPresence),
    aiVisibilityEst: clampScore(o.aiVisibilityEst),
  };
}

function deriveViralSeeds(pageUrl: string, title: string): string[] {
  const shortTitle = title.split(/[|\-–—]/)[0]?.trim();
  if (shortTitle && shortTitle.length >= 3 && shortTitle.length < 100) return [shortTitle];
  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./, "");
    const part = host.split(".")[0];
    if (part && part.length > 2) return [part];
  } catch { /* ignore */ }
  return ["marketing"];
}

function emptyAiOut(partial: Partial<AiOut> & { analysisMarkdown?: string }): AiOut {
  return {
    analysisMarkdown: partial.analysisMarkdown ?? "",
    viralQueries: partial.viralQueries ?? [],
    brandGuess: partial.brandGuess ?? "",
    industry: partial.industry ?? "",
    scores: partial.scores ?? null,
    summaryBullets: partial.summaryBullets ?? [],
    landingBullets: partial.landingBullets ?? [],
    adsBullets: partial.adsBullets ?? [],
    seoBullets: partial.seoBullets ?? [],
    socialBullets: partial.socialBullets ?? [],
    llmBullets: partial.llmBullets ?? [],
    recommendationsBullets: partial.recommendationsBullets ?? [],
  };
}

function parseAiJson(text: string): AiOut {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return emptyAiOut({ analysisMarkdown: trimmed });
  }
  try {
    const j = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
    const legacyMd = typeof j.analysisMarkdown === "string" ? j.analysisMarkdown : "";
    const viralQueries = asStringList(j.viralQueries, 8);
    const brandGuess = typeof j.brandGuess === "string" ? j.brandGuess : "";
    const industry = typeof j.industry === "string" ? j.industry : "";
    const scores = parseScores(j.scores);
    const summaryBullets = asStringList(j.summaryBullets);
    const landingBullets = asStringList(j.landingBullets);
    const adsBullets = asStringList(j.adsBullets);
    const seoBullets = asStringList(j.seoBullets);
    const socialBullets = asStringList(j.socialBullets);
    const llmBullets = asStringList(j.llmBullets);
    const recommendationsBullets = asStringList(j.recommendationsBullets);

    const hasNew = summaryBullets.length + landingBullets.length + adsBullets.length > 0;
    const analysisMarkdown = legacyMd || (hasNew ? "" : trimmed);

    return emptyAiOut({
      analysisMarkdown,
      viralQueries,
      brandGuess,
      industry,
      scores,
      summaryBullets,
      landingBullets,
      adsBullets,
      seoBullets,
      socialBullets,
      llmBullets,
      recommendationsBullets,
    });
  } catch {
    return emptyAiOut({ analysisMarkdown: trimmed });
  }
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
    const manualText = typeof body.manualText === "string" ? body.manualText.trim() : "";
    const industry = typeof body.industry === "string" ? body.industry.trim().slice(0, 400) : "";
    const compareUrlRaw = typeof body.compareUrl === "string" ? normalizeIncomingUrl(body.compareUrl) : "";
    const focusAreas = Array.isArray(body.focusAreas)
      ? body.focusAreas.filter((x: unknown): x is string => typeof x === "string" && x.length > 0).slice(0, 12)
      : [];

    if (!urlRaw && manualText.length < 40) {
      return new Response(
        JSON.stringify({
          error:
            "Podaj adres strony (https://…) albo wklej treść konkurenta (min. ok. 40 znaków).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let pageUrl: string;
    let title: string;
    let description: string;
    let textSample: string;
    let images: string[];
    let socialLinks: { label: string; url: string }[];
    let h1: string[] = [];
    let h2: string[] = [];
    let detectedPixels: string[] = [];
    let schemaTypes: string[] = [];
    let canonical: string | null = null;
    const warnings: string[] = [];
    let scrapingStatus: "ok" | "partial" | "failed" | "manual" = "ok";

    if (manualText.length >= 40) {
      pageUrl = "";
      if (urlRaw) {
        try {
          pageUrl = assertPublicHttpUrl(urlRaw).href;
        } catch {
          pageUrl = "";
        }
      }
      title = pageUrl ? "Konkurent (URL + treść ręczna)" : "Treść wklejona ręcznie";
      description = "";
      textSample = manualText.slice(0, 14_000);
      images = [];
      socialLinks = [];
      scrapingStatus = "manual";
      warnings.push("Analiza oparta na treści wklejonej ręcznie — bez pobierania strony.");
    } else {
      pageUrl = assertPublicHttpUrl(urlRaw).href;
      const fetched = await fetchHtmlLimited(pageUrl);
      const html = fetched.html;
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      title = titleMatch?.[1] ? decodeEntities(titleMatch[1].trim()) : "";
      description =
        metaTag(html, "name", "description") ||
        metaTag(html, "property", "og:description") ||
        "";
      textSample = stripTagsForText(html);
      images = collectImages(html, pageUrl);
      socialLinks = collectSocialLinks(html);
      h1 = collectHeadings(html, "h1");
      h2 = collectHeadings(html, "h2");
      detectedPixels = collectPixels(html);
      schemaTypes = collectSchemaTypes(html);
      canonical = findCanonical(html);
      if (fetched.source === "mirror") {
        scrapingStatus = "partial";
        warnings.push(
          "Strona zablokowała bezpośrednie pobranie — dane pobrano przez czytnik zapasowy (mogą być niepełne, np. brak części metadanych i grafik).",
        );
      }
      if (textSample.length < 400) {
        if (scrapingStatus === "ok") scrapingStatus = "partial";
        warnings.push("Strona udostępniła mało treści tekstowej (może ładować treść przez JavaScript).");
      }
      if (!title && !description) {
        warnings.push("Brak tytułu i opisu meta — ograniczone metadane strony.");
      }
    }

    const metadata = {
      title,
      description,
      h1,
      h2,
      socialLinks,
      detectedPixels,
      schemaTypes,
      canonical,
    };
    const dataQuality = { scrapingStatus, warnings };

    let compareSnippet = "";
    if (compareUrlRaw) {
      try {
        const cu = assertPublicHttpUrl(compareUrlRaw).href;
        const ch = await fetchHtmlLimited(cu);
        compareSnippet = stripTagsForText(ch.html).slice(0, 6000);
      } catch {
        /* ignore — comparison optional */
      }
    }

    const focusLine =
      focusAreas.length > 0
        ? focusAreas.join(", ")
        : "landing, reklamy, SEO, social, short video, LLM, copy/oferta";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY nie jest skonfigurowany");

    const payload = {
      pageUrl: pageUrl || "(wklejona treść — brak publicznego URL)",
      title,
      metaDescription: description,
      textSample,
      imageUrls: images,
      socialLinks,
      h1,
      h2,
      detectedPixels,
      schemaTypes,
      industry: industry || null,
      compareUserSiteTextSample: compareSnippet || null,
      analysisFocus: focusLine,
      scrapingStatus,
    };

    const system = `Jesteś doświadczonym analitykiem konkurencji w produkcie MarketingNow (SaaS do marketingu). Piszesz wyłącznie naturalnym, poprawnym językiem polskim — jak człowiek przygotowujący analizę, a nie automatyczny szablon.

Zwróć WYŁĄCZNIE poprawny JSON. Nie dodawaj żadnego tekstu przed ani po JSON. Nie używaj bloków markdown (\`\`\`). Zachowaj DOKŁADNIE te nazwy pól: brandGuess, industry, summaryBullets, landingBullets, adsBullets, seoBullets, socialBullets, llmBullets, recommendationsBullets, analysisMarkdown, scores, viralQueries. Jeżeli nie masz danych dla sekcji, zwróć pustą tablicę [], ale NIE pomijaj pola.

Struktura:
{
  "brandGuess": "krótki skrót marki/produktu lub pusty string",
  "industry": "rozpoznana branża po polsku (np. 'hurt FMCG', 'e-commerce z modą', 'agencja SEO') lub pusty string",
  "viralQueries": ["3–6 krótkich haseł do inspiracji shortów (TikTok / Reels / Shorts)"],
  "scores": { "valueProp": 0-100, "seoSignals": 0-100, "socialPresence": 0-100, "aiVisibilityEst": 0-100 },
  "summaryBullets": ["3–5 krótkich punktów — najważniejsze wnioski dla marketera"],
  "landingBullets": ["2–5 punktów: landing, oferta, CTA, dowody — tylko to, co wynika z danych"],
  "adsBullets": ["2–5 punktów: kąty reklamowe, obietnice, grupy docelowe — bez wymyślania kampanii"],
  "seoBullets": ["2–5 punktów: sygnały SEO z treści/meta/nagłówków, jeśli widać"],
  "socialBullets": ["2–5 punktów: social z wykrytych linków lub informacja o ich braku"],
  "llmBullets": ["2–4 punkty: jak marka może być opisywana w AI / co poprawić — ostrożne szacunki"],
  "recommendationsBullets": ["5–8 konkretnych, wykonalnych kroków dla użytkownika"],
  "analysisMarkdown": "Krótki markdown (max ~800 znaków) z sekcją '### Co warto poprawić' — może być pusty string jeśli bullety wystarczą"
}

ZASADY JĘZYKA I JAKOŚCI:
- Pisz po polsku, naturalnie i konkretnie pod tę firmę. Nie używaj angielskich etykiet ani słów: high, medium, low, executive summary, metrics, recommendations.
- Priorytety nazywaj: „wysoki priorytet”, „średni priorytet”, „niski priorytet”.
- Nigdy nie pisz ogólników typu „tej kategorii”, „ta branża”, „najlepsze narzędzie w kategorii tej kategorii”. Używaj konkretnej, rozpoznanej nazwy branży.
- Nie używaj zwrotu „model mógł nie znaleźć sygnałów”. Jeśli czegoś brakuje, napisz rzeczowo, np. „W próbce nie widać wyraźnych sygnałów SEO”.
- Nie wymyślaj faktów spoza danych.

ROZPOZNAWANIE BRANŻY:
- Jeśli użytkownik podał industry w danych — użyj jej.
- Jeśli nie podał — rozpoznaj branżę z: title, meta description, H1/H2, treści, URL, schema.org.
- Jeśli nadal nie da się rozpoznać, ustaw industry na "" i w summaryBullets dodaj zdanie: „Branża wymaga doprecyzowania — obecna analiza jest wstępna.”

Dopasuj proporcje insightów do pola analysisFocus. Jeśli scrapingStatus to "partial" lub "manual", bądź ostrożniejszy w ocenach i zaznacz ograniczenia danych w odpowiednich bulletach.`;

    const userPrompt = `Przeanalizuj konkurenta.

DANE (JSON):
${JSON.stringify(payload)}`;

    const inputChars = system.length + userPrompt.length + 200;

    // Ustrukturyzowane wyjście przez wywołanie narzędzia — gwarantuje pełny, parsowalny JSON
    // (wcześniej bezpośrednie wywołanie Anthropic z max_tokens=4096 ucinało JSON i bullety były puste).
    const strList = { type: "array" as const, items: { type: "string" as const } };
    const competitorTool = {
      name: "submit_competitor_analysis",
      description: "Zwraca ustrukturyzowaną analizę konkurenta dla MarketingNow.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: [
          "brandGuess",
          "industry",
          "viralQueries",
          "scores",
          "summaryBullets",
          "landingBullets",
          "adsBullets",
          "seoBullets",
          "socialBullets",
          "llmBullets",
          "recommendationsBullets",
          "analysisMarkdown",
        ],
        properties: {
          brandGuess: { type: "string" },
          industry: { type: "string" },
          viralQueries: strList,
          scores: {
            type: "object",
            additionalProperties: false,
            required: ["valueProp", "seoSignals", "socialPresence", "aiVisibilityEst"],
            properties: {
              valueProp: { type: "number", minimum: 0, maximum: 100 },
              seoSignals: { type: "number", minimum: 0, maximum: 100 },
              socialPresence: { type: "number", minimum: 0, maximum: 100 },
              aiVisibilityEst: { type: "number", minimum: 0, maximum: 100 },
            },
          },
          summaryBullets: strList,
          landingBullets: strList,
          adsBullets: strList,
          seoBullets: strList,
          socialBullets: strList,
          llmBullets: strList,
          recommendationsBullets: strList,
          analysisMarkdown: { type: "string" },
        },
      },
    } as const;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 110_000);
    let resp: Response;
    try {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          tools: [{ type: "function", function: competitorTool }],
          tool_choice: { type: "function", function: { name: competitorTool.name } },
        }),
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const aborted = err instanceof Error && err.name === "AbortError";
      console.error("competitor-scan fetch error:", err);
      return new Response(
        JSON.stringify({
          error: aborted
            ? "Analiza trwała zbyt długo — spróbuj ponownie."
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
      console.error("competitor-scan gateway:", resp.status, t);
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
    const toolArgs = message?.tool_calls?.find((c) => c.function?.name === competitorTool.name)?.function
      ?.arguments;
    const rawOut = toolArgs ?? message?.content ?? "";
    const parsed = parseAiJson(rawOut);

    const actualUsdCents = usdCentsFromGatewayCompletion("google/gemini-2.5-flash", data);

    await finalizeAiUsage({
      userId: user.id,
      source: "competitor-scan",
      actualUsdCents: actualUsdCents ?? undefined,
      extraDetail: { pageUrl, imageCount: images.length, gatewayUsage: (data as { usage?: unknown }).usage ?? null },
    });

    const viralQueries = parsed.viralQueries.length
      ? parsed.viralQueries
      : deriveViralSeeds(pageUrl || "https://example.com", title);

    return new Response(
      JSON.stringify({
        pageUrl,
        title,
        description,
        images,
        socialLinks,
        analysisMarkdown: parsed.analysisMarkdown,
        viralQueries,
        brandGuess: parsed.brandGuess,
        industry: parsed.industry || industry || "",
        scores: parsed.scores,
        summaryBullets: parsed.summaryBullets,
        landingBullets: parsed.landingBullets,
        adsBullets: parsed.adsBullets,
        seoBullets: parsed.seoBullets,
        socialBullets: parsed.socialBullets,
        llmBullets: parsed.llmBullets,
        recommendationsBullets: parsed.recommendationsBullets,
        metadata,
        dataQuality,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("competitor-scan error:", e);
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
