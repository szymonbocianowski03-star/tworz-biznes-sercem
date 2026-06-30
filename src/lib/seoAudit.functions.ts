import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { parseSeoAuditAnalysis, type SeoAuditAnalysis } from "@/lib/seoAuditAnalysis";

const InputSchema = z.object({
  url: z.string().min(3),
  targetKeywords: z.string().optional(),
  industry: z.string().optional(),
});

export type RunSeoAuditResult =
  | { ok: true; data: SeoAuditAnalysis }
  | { ok: false; kind: "http"; status: number; error?: string; message?: string }
  | { ok: false; kind: "fetch"; message: string }
  | { ok: false; kind: "parse"; message: string }
  | { ok: false; kind: "other"; message: string };

export async function runSeoAudit(input: z.infer<typeof InputSchema>): Promise<RunSeoAuditResult> {
  const data = InputSchema.parse(input);
  const { data: payload, error } = await supabase.functions.invoke("seo-audit", {
    body: {
      url: data.url,
      targetKeywords: data.targetKeywords,
      industry: data.industry,
    },
    timeout: 300_000,
  });

    if (!error) {
      const errObj = payload as { error?: unknown } | null;
      if (errObj && typeof errObj === "object" && typeof errObj.error === "string" && errObj.error) {
        return { ok: false, kind: "other", message: errObj.error };
      }
      const parsed = parseSeoAuditAnalysis(payload);
      if (parsed.ok) return { ok: true, data: parsed.data };
      return { ok: false, kind: "parse", message: "Nie udało się odczytać raportu SEO z odpowiedzi serwera." };
    }

    if (error instanceof FunctionsHttpError) {
      const status = error.context.status;
      let errBody: { error?: string; message?: string } = {};
      try {
        errBody = (await error.context.json()) as { error?: string; message?: string };
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        kind: "http",
        status,
        error: errBody.error,
        message: errBody.message ?? errBody.error,
      };
    }

    if (error instanceof FunctionsFetchError) {
      const msg = error.message.toLowerCase().includes("abort")
        ? "Przekroczono czas oczekiwania (audyt SEO może trwać kilka minut). Spróbuj ponownie — wynik zostanie zapisany w tej karcie."
        : error.message;
      return { ok: false, kind: "fetch", message: msg };
    }

    return { ok: false, kind: "other", message: error.message };
}