import { supabaseEdgeFunctionUrl } from "@/integrations/supabase/publicEnv";

export type AdCopyKind =
  | "headline"
  | "headlines"
  | "longHeadlines"
  | "descriptions"
  | "primaryText"
  | "adText"
  | "campaignName"
  | "businessName";

export type AdCopyRequest = {
  kind: AdCopyKind;
  provider: "meta" | "linkedin" | "tiktok" | "google";
  campaignType?: string;
  campaignName?: string;
  finalUrl?: string;
  businessName?: string;
  language?: string;
  count?: number;
  maxChars?: number;
  hint?: string;
  existing?: string;
};

export type AdCopyResult =
  | { ok: true; lines: string[]; text: string }
  | { ok: false; error: string; isCredits?: boolean; creditsMessage?: string };

const KIND_LABEL: Record<AdCopyKind, string> = {
  headline: "nagłówek reklamy",
  headlines: "nagłówki reklamy (RSA / PMax)",
  longHeadlines: "długie nagłówki",
  descriptions: "opisy reklamy",
  primaryText: "tekst główny reklamy",
  adText: "tekst / caption reklamy",
  campaignName: "nazwa kampanii (wewnętrzna)",
  businessName: "nazwa firmy w kreacji",
};

function defaultCount(kind: AdCopyKind): number {
  if (kind === "headlines") return 5;
  if (kind === "longHeadlines") return 2;
  if (kind === "descriptions") return 3;
  return 1;
}

function defaultMaxChars(kind: AdCopyKind, provider: string): number {
  if (kind === "headline" || kind === "headlines") {
    if (provider === "google") return 30;
    if (provider === "linkedin") return 70;
    return 40;
  }
  if (kind === "longHeadlines") return 90;
  if (kind === "descriptions") return 90;
  if (kind === "businessName") return 25;
  if (kind === "campaignName") return 80;
  if (kind === "adText") return 100;
  return 125;
}

function extractJsonArray(raw: string): string[] {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() ?? trimmed;
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      /* przejdź do parsowania liniami */
    }
  }
  return body
    .split("\n")
    .map((l) => l.replace(/^[-*\d.)\s]+/, "").replace(/^["„]|["”]$/g, "").trim())
    .filter(Boolean);
}

function normalizeLines(lines: string[], count: number, maxChars: number): string[] {
  return lines
    .map((s) => s.replace(/^["„]|["”]$/g, "").trim().slice(0, maxChars))
    .filter(Boolean)
    .slice(0, count);
}

/** Fallback: generuje teksty przez działającą Edge Function `chat` (tryb analityka, bez Q&A). */
async function generateViaChat(
  headers: Record<string, string>,
  req: AdCopyRequest,
  count: number,
  maxChars: number,
): Promise<AdCopyResult> {
  const url = supabaseEdgeFunctionUrl("chat");
  if (!url) return { ok: false, error: "Brak konfiguracji połączenia z AI." };

  const language = req.language?.trim() || "pl";
  const prompt = `Jesteś copywriterem reklam performance. Piszesz po ${language === "pl" ? "polsku" : language}.
Wygeneruj ${KIND_LABEL[req.kind]} dla kampanii reklamowej.

Platforma: ${req.provider}
Typ kampanii: ${req.campaignType || "—"}
Nazwa kampanii: ${req.campaignName || "—"}
URL: ${req.finalUrl || "—"}
Firma / marka: ${req.businessName || "—"}
Podpowiedź użytkownika: ${req.hint || "—"}
Istniejący tekst (możesz ulepszyć / rozwinąć): ${req.existing || "—"}

Zasady:
- Zwróć WYŁĄCZNIE poprawny JSON: tablicę stringów (bez komentarzy, bez markdown, bez cudzysłowów wokół całości).
- Dokładnie ${count} pozycji, każda ≤ ${maxChars} znaków.
- Teksty konkretne, sprzedażowe, bez ogólników typu „najlepsza jakość”. Bez emoji (chyba że TikTok caption).`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        skipAgentPersona: true,
        noQaStreamGuard: true,
        usageSource: "campaign-ad-copy",
      }),
    });
  } catch {
    return { ok: false, error: "Brak połączenia z AI. Sprawdź internet i spróbuj ponownie." };
  }

  if (resp.status === 402) {
    let msg = "Brak kredytów — doładuj plan.";
    try {
      const j = (await resp.json()) as { message?: string; error?: string };
      msg = j.message || j.error || msg;
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg, isCredits: true, creditsMessage: msg };
  }
  if (resp.status === 401) return { ok: false, error: "Zaloguj się, aby użyć AI." };
  if (!resp.ok || !resp.body) return { ok: false, error: "Nie udało się wygenerować tekstu AI." };

  let acc = "";
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;
  while (!done) {
    const { done: d, value } = await reader.read();
    if (d) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const j = line.slice(6).trim();
      if (j === "[DONE]") {
        done = true;
        break;
      }
      try {
        const p = JSON.parse(j);
        const c = p.choices?.[0]?.delta?.content;
        if (typeof c === "string") acc += c;
      } catch {
        /* ignore */
      }
    }
  }

  const lines = normalizeLines(extractJsonArray(acc), count, maxChars);
  if (!lines.length) return { ok: false, error: "AI nie zwróciło tekstu. Spróbuj ponownie." };
  return { ok: true, lines, text: lines.join("\n") };
}

/**
 * Generuje teksty reklamowe. Najpierw próbuje dedykowanej funkcji `generate-ad-copy`,
 * a przy problemie z połączeniem (np. funkcja niewdrożona → „Failed to fetch”)
 * automatycznie korzysta z działającej funkcji `chat`.
 */
export async function generateAdCopy(
  headers: Record<string, string>,
  req: AdCopyRequest,
): Promise<AdCopyResult> {
  const count = Math.min(Math.max(req.count ?? defaultCount(req.kind), 1), 15);
  const maxChars = req.maxChars ?? defaultMaxChars(req.kind, req.provider);

  const dedicatedUrl = supabaseEdgeFunctionUrl("generate-ad-copy");
  if (dedicatedUrl) {
    try {
      const resp = await fetch(dedicatedUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          kind: req.kind,
          provider: req.provider,
          campaignType: req.campaignType,
          campaignName: req.campaignName,
          finalUrl: req.finalUrl,
          businessName: req.businessName,
          language: req.language ?? "pl",
          maxChars,
          count,
          hint: req.hint,
          existing: req.existing?.trim() || undefined,
        }),
      });

      if (resp.status === 402) {
        let msg = "Brak kredytów — doładuj plan.";
        try {
          const j = (await resp.json()) as { message?: string; error?: string };
          msg = j.message || j.error || msg;
        } catch {
          /* ignore */
        }
        return { ok: false, error: msg, isCredits: true, creditsMessage: msg };
      }

      if (resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { lines?: string[]; text?: string };
        const rawLines = Array.isArray(data.lines)
          ? data.lines
          : typeof data.text === "string"
            ? data.text.split("\n")
            : [];
        const lines = normalizeLines(rawLines, count, maxChars);
        if (lines.length) return { ok: true, lines, text: lines.join("\n") };
      }
      // Funkcja odpowiedziała, ale bez treści (np. 404/5xx) → fallback do chatu.
    } catch {
      // „Failed to fetch” / CORS / brak wdrożenia → fallback do chatu.
    }
  }

  return generateViaChat(headers, req, count, maxChars);
}
