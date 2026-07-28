export type AdCopyKind =
  | "headline"
  | "headlines"
  | "longHeadlines"
  | "descriptions"
  | "primaryText"
  | "adText"
  | "campaignName"
  | "businessName";

export type GenerateAdCopyInput = {
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
    const parsed = JSON.parse(body.slice(start, end + 1)) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean);
    }
  }
  const lines = body
    .split("\n")
    .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
  return lines;
}

export async function generateAdCopyWithAnthropic(input: GenerateAdCopyInput): Promise<{ lines: string[]; text: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Brak ANTHROPIC_API_KEY w konfiguracji serwera (.env / Settings → Environment).");
  }

  const count = Math.min(Math.max(input.count ?? defaultCount(input.kind), 1), 15);
  const maxChars = input.maxChars ?? defaultMaxChars(input.kind, input.provider);
  const language = input.language?.trim() || "pl";

  const system = `Jesteś copywriterem reklam performance. Piszesz po ${language === "pl" ? "polsku" : language}.
Zwracasz WYŁĄCZNIE poprawny JSON: tablicę stringów (bez komentarzy, bez markdown).
Każdy element to jedna gotowa propozycja tekstu.
Limity: max ${maxChars} znaków na pozycję, dokładnie ${count} pozycji.
Bez emoji (chyba że pasują do TikTok caption). Bez cudzysłowów wokół całej odpowiedzi.
Teksty mają być konkretne, sprzedażowe, bez ogólnych fraz typu „najlepsza jakość”.`;

  const user = `Wygeneruj ${KIND_LABEL[input.kind]} dla kampanii reklamowej.

Platforma: ${input.provider}
Typ kampanii: ${input.campaignType || "—"}
Nazwa kampanii: ${input.campaignName || "—"}
URL: ${input.finalUrl || "—"}
Firma / marka: ${input.businessName || "—"}
Podpowiedź użytkownika: ${input.hint || "—"}
Istniejący tekst (możesz ulepszyć / rozwinąć): ${input.existing || "—"}

Zwróć JSON array z ${count} propozycjami, każda ≤ ${maxChars} znaków.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (resp.status === 429) {
    throw new Error("Za dużo zapytań do Anthropic — spróbuj za chwilę.");
  }
  if (!resp.ok) {
    const t = await resp.text();
    console.error("[ccGenerateAdCopy] anthropic:", resp.status, t.slice(0, 500));
    throw new Error("Błąd Anthropic — sprawdź ANTHROPIC_API_KEY i spróbuj ponownie.");
  }

  const data = (await resp.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const raw = data.content?.find((c) => c.type === "text")?.text ?? "";
  let lines: string[];
  try {
    lines = extractJsonArray(raw);
  } catch {
    throw new Error("Model nie zwrócił poprawnej listy tekstów.");
  }

  lines = lines
    .map((s) => s.replace(/^["„]|["”]$/g, "").trim().slice(0, maxChars))
    .filter(Boolean)
    .slice(0, count);

  if (lines.length === 0) {
    throw new Error("AI nie wygenerowało żadnego tekstu.");
  }

  return { lines, text: lines.join("\n") };
}
