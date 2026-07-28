import {
  assertFreeAiAllowed,
  corsHeaders,
  finalizeAiUsage,
  requireUser,
} from "../_shared/aiUsage.ts";
import { usdCentsFromTokenUsage, parseAnthropicMessageUsage } from "../_shared/aiCost.ts";

const MODEL = "claude-sonnet-4-5-20250929";

type Kind =
  | "headline"
  | "headlines"
  | "longHeadlines"
  | "descriptions"
  | "primaryText"
  | "adText"
  | "campaignName"
  | "businessName";

const KIND_LABEL: Record<Kind, string> = {
  headline: "nagłówek reklamy",
  headlines: "nagłówki reklamy",
  longHeadlines: "długie nagłówki",
  descriptions: "opisy reklamy",
  primaryText: "tekst główny reklamy",
  adText: "tekst / caption reklamy",
  campaignName: "nazwa kampanii (wewnętrzna)",
  businessName: "nazwa firmy w kreacji",
};

function defaultCount(kind: Kind): number {
  if (kind === "headlines") return 5;
  if (kind === "longHeadlines") return 2;
  if (kind === "descriptions") return 3;
  return 1;
}

function defaultMaxChars(kind: Kind, provider: string): number {
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
    const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean);
    }
  }
  return body
    .split("\n")
    .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userOrResp = await requireUser(req);
    if (userOrResp instanceof Response) return userOrResp;
    const user = userOrResp;

    const capBlock = await assertFreeAiAllowed(user.id);
    if (capBlock) return capBlock;

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY nie jest skonfigurowany" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const kind = (body.kind ?? "headline") as Kind;
    if (!(kind in KIND_LABEL)) {
      return new Response(JSON.stringify({ error: "Nieznany rodzaj pola" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = String(body.provider ?? "google");
    const count = Math.min(Math.max(Number(body.count) || defaultCount(kind), 1), 15);
    const maxChars = Number(body.maxChars) || defaultMaxChars(kind, provider);
    const language = String(body.language ?? "pl");

    const system = `Jesteś copywriterem reklam performance. Piszesz po ${language === "pl" ? "polsku" : language}.
Zwracasz WYŁĄCZNIE poprawny JSON: tablicę stringów (bez komentarzy, bez markdown).
Każdy element to jedna gotowa propozycja tekstu.
Limity: max ${maxChars} znaków na pozycję, dokładnie ${count} pozycji.
Bez emoji (chyba że pasują do TikTok caption). Teksty konkretne i sprzedażowe.`;

    const userPrompt = `Wygeneruj ${KIND_LABEL[kind]} dla kampanii reklamowej.

Platforma: ${provider}
Typ kampanii: ${body.campaignType || "—"}
Nazwa kampanii: ${body.campaignName || "—"}
URL: ${body.finalUrl || "—"}
Firma / marka: ${body.businessName || "—"}
Podpowiedź użytkownika: ${body.hint || "—"}
Istniejący tekst (możesz ulepszyć): ${body.existing || "—"}

Zwróć JSON array z ${count} propozycjami, każda ≤ ${maxChars} znaków.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Za dużo zapytań — spróbuj za chwilę." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("generate-ad-copy anthropic:", resp.status, t.slice(0, 500));
      return new Response(JSON.stringify({ error: "Błąd modelu AI — spróbuj ponownie." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const raw = (data.content ?? []).find((c: { type: string }) => c.type === "text")?.text ?? "";
    let lines: string[];
    try {
      lines = extractJsonArray(raw);
    } catch {
      return new Response(JSON.stringify({ error: "Model nie zwrócił poprawnej listy tekstów." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    lines = lines
      .map((s) => s.replace(/^["„]|["”]$/g, "").trim().slice(0, maxChars))
      .filter(Boolean)
      .slice(0, count);

    if (!lines.length) {
      return new Response(JSON.stringify({ error: "AI nie wygenerowało żadnego tekstu." }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicUsage = parseAnthropicMessageUsage(data);
    const actualUsdCents = anthropicUsage
      ? usdCentsFromTokenUsage(MODEL, anthropicUsage)
      : undefined;

    await finalizeAiUsage({
      userId: user.id,
      source: "campaign-ad-copy",
      actualUsdCents: actualUsdCents ?? undefined,
      tokenUsage: anthropicUsage ? { model: MODEL, usage: anthropicUsage } : undefined,
    });

    return new Response(JSON.stringify({ lines, text: lines.join("\n") }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ad-copy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Błąd serwera" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
