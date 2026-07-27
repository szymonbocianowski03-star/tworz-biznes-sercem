import { createServerFn } from "@tanstack/react-start";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

const FocusIdSchema = z.enum([
  "landing",
  "ads",
  "seo",
  "social",
  "shortVideo",
  "llm",
  "copy",
]);

const InputSchema = z.object({
  url: z.string().optional(),
  manualText: z.string().optional(),
  industry: z.string().optional(),
  compareUrl: z.string().optional(),
  focusAreas: z.array(FocusIdSchema).min(1),
});

export type RunCompetitorScanResult =
  | { ok: true; data: Json }
  | {
      ok: false;
      kind: "http";
      status: number;
      error?: string;
      message?: string;
    }
  | { ok: false; kind: "fetch"; message: string }
  | { ok: false; kind: "other"; message: string };

/** Wywołanie Edge Function z serwera (Workers) — omija blokady przeglądarki wobec *.supabase.co. */
export const runCompetitorScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }): Promise<RunCompetitorScanResult> => {
    const { supabase } = context;
    const { data: payload, error } = await supabase.functions.invoke("competitor-scan", {
      body: {
        url: data.url,
        manualText: data.manualText,
        industry: data.industry,
        compareUrl: data.compareUrl,
        focusAreas: data.focusAreas,
      },
    });

    if (!error) {
      return { ok: true, data: (payload ?? {}) as Json };
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
        message: errBody.message,
      };
    }

    if (error instanceof FunctionsFetchError) {
      return { ok: false, kind: "fetch", message: error.message };
    }

    return { ok: false, kind: "other", message: error.message };
  });
