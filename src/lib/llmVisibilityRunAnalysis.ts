import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { parseLlmVisibilityAnalysis } from "@/lib/llmVisibilityAnalysis";
import type { LlmVisibilityAnalysis } from "@/lib/llmVisibilityAnalysis";
import { supabase } from "@/integrations/supabase/client";

export type LlmVisibilityFormInput = {
  brandName: string;
  websiteUrl: string;
  industry: string;
  offerDescription?: string;
  targetKeywords: string;
  competitors: string;
  targetAudience: string;
  aiModels?: string;
  language?: "pl" | "en" | "de";
};

export type RunLlmVisibilityResult =
  | { ok: true; data: LlmVisibilityAnalysis }
  | { ok: false; kind: "network" | "parse" | "http"; status?: number; message?: string };

export async function runLlmVisibilityAnalysis(
  input: LlmVisibilityFormInput,
  _headers?: HeadersInit,
): Promise<RunLlmVisibilityResult> {
  const { data: payload, error } = await supabase.functions.invoke("llm-visibility", {
    body: {
      brandName: input.brandName,
      websiteUrl: input.websiteUrl,
      industry: input.industry,
      offerDescription: input.offerDescription ?? "",
      targetKeywords: input.targetKeywords,
      competitors: input.competitors,
      targetAudience: input.targetAudience,
      aiModels: input.aiModels ?? "ChatGPT, Gemini, Claude, Perplexity",
      language: input.language ?? "pl",
    },
    timeout: 300_000,
  });

  if (!error) {
    const parsed = parseLlmVisibilityAnalysis(typeof payload === "string" ? payload : JSON.stringify(payload));
    if (parsed.ok) return { ok: true, data: parsed.data };
    return { ok: false, kind: "parse" };
  }

  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    let errBody: { error?: string; message?: string } = {};
    try {
      errBody = (await error.context.json()) as { error?: string; message?: string };
    } catch {
      /* ignore */
    }
    if (status === 401) return { ok: false, kind: "http", status, message: "Sesja wygasła. Zaloguj się ponownie." };
    if (status === 402)
      return {
        ok: false,
        kind: "http",
        status,
        message: errBody.message ?? "Wykorzystano limit planu. Rozważ upgrade w „Plan i kredyty”.",
      };
    if (status === 429) return { ok: false, kind: "http", status, message: "Za dużo zapytań. Spróbuj za chwilę." };
    return {
      ok: false,
      kind: "http",
      status,
      message: errBody.message ?? errBody.error ?? "Nie udało się ukończyć analizy.",
    };
  }

  if (error instanceof FunctionsFetchError) {
    return {
      ok: false,
      kind: "network",
      message: "Przekroczono czas oczekiwania lub błąd sieci. Spróbuj ponownie.",
    };
  }

  return { ok: false, kind: "http", message: error.message };
}
