/**
 * Koszt API → kredyty. Zgodne z creditEconomy.ts / plans.ts:
 * 1 obraz = $0,25 (25 ¢) = 100 kredytów → 4 kred. za cent USD.
 */
export const CREDITS_PER_USD_CENT = 4;
export const IMAGE_USD_CENTS = 25;
export const FREE_TIER_USD_CAP_CENTS = 100;

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreateTokens?: number;
};

type ModelRates = {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok?: number;
  cacheCreatePerMTok?: number;
};

/** Ceny API USD / 1M tokenów (szacunek; aktualizuj przy zmianie modeli). */
const MODEL_RATES: Record<string, ModelRates> = {
  "claude-sonnet-4-5-20250929": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheReadPerMTok: 0.3,
    cacheCreatePerMTok: 3.75,
  },
  "claude-sonnet-4-5": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheReadPerMTok: 0.3,
    cacheCreatePerMTok: 3.75,
  },
  "google/gemini-2.5-flash": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  "google/gemini-3-flash-preview": { inputPerMTok: 0.2, outputPerMTok: 0.8 },
  generic: { inputPerMTok: 1.5, outputPerMTok: 6 },
};

function ratesForModel(model: string): ModelRates {
  if (MODEL_RATES[model]) return MODEL_RATES[model]!;
  const key = Object.keys(MODEL_RATES).find((k) => model.includes(k.split("/").pop() ?? k));
  if (key) return MODEL_RATES[key]!;
  return MODEL_RATES.generic;
}

/** Koszt wywołania w centach USD (min. 1 ¢). */
export function usdCentsFromTokenUsage(model: string, usage: TokenUsage): number {
  const r = ratesForModel(model);
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheCreate = usage.cacheCreateTokens ?? 0;

  const usd =
    (input / 1_000_000) * r.inputPerMTok +
    (output / 1_000_000) * r.outputPerMTok +
    (cacheRead / 1_000_000) * (r.cacheReadPerMTok ?? r.inputPerMTok * 0.1) +
    (cacheCreate / 1_000_000) * (r.cacheCreatePerMTok ?? r.inputPerMTok * 1.25);

  return Math.max(1, Math.round(usd * 100));
}

export function usdCentsFromGatewayCompletion(model: string, data: unknown): number | null {
  const parsed = parseGatewayUsage(data);
  if (!parsed) return null;
  return usdCentsFromTokenUsage(parsed.model ?? model, parsed.usage);
}

export function parseGatewayUsage(
  data: unknown,
): { model?: string; usage: TokenUsage } | null {
  const d = data as {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  const u = d?.usage;
  if (!u) return null;
  const inputTokens = u.prompt_tokens ?? u.input_tokens ?? 0;
  const outputTokens = u.completion_tokens ?? u.output_tokens ?? 0;
  if (inputTokens + outputTokens <= 0 && !u.total_tokens) return null;
  return {
    model: d.model,
    usage: {
      inputTokens: inputTokens || Math.max(0, (u.total_tokens ?? 0) - outputTokens),
      outputTokens,
    },
  };
}

export function parseAnthropicMessageUsage(data: unknown): TokenUsage | null {
  const u = (data as {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  })?.usage;
  if (!u) return null;
  const inputTokens = u.input_tokens ?? 0;
  const outputTokens = u.output_tokens ?? 0;
  if (inputTokens + outputTokens <= 0) return null;
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheCreateTokens: u.cache_creation_input_tokens ?? 0,
  };
}

/** Koszt generacji obrazu: stałe $0,25 za sztukę (25 centów USD). */
export function usdCentsForImageGeneration(opts: { n?: number }): number {
  const n = Math.max(1, Math.min(4, Number(opts.n) || 1));
  return IMAGE_USD_CENTS * n;
}

export function creditsFromUsdCents(usdCents: number): number {
  return Math.max(1, Math.ceil(Math.max(0, usdCents) * CREDITS_PER_USD_CENT));
}
