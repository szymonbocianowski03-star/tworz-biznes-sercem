import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { FREE_TIER_USD_CAP_CENTS, type TokenUsage } from "./aiCost.ts";
import { fixedCreditsForSource, resolveBillingUsdCents } from "./featurePricing.ts";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireUser(req: Request): Promise<User | Response> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Wymagane logowanie." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Brak tokena sesji." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = getServiceClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Nieprawidłowa lub wygasła sesja." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function assertFreeAiAllowed(userId: string): Promise<Response | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("assert_can_use_free_ai", { _user_id: userId });
  if (error) {
    console.error("assert_can_use_free_ai", error);
    return new Response(JSON.stringify({ error: "Nie udało się sprawdzić limitu konta." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (data !== true) {
    return new Response(
      JSON.stringify({
        error: "no_credits",
        message:
          "Nie masz kredytów albo wykorzystałeś limit planu Free. Otwórz „Plan i kredyty”, żeby dokupić pakiet lub zmienić plan.",
      }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return null;
}

function isLikelyRpcSignatureMismatch(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  const code = String(err.code ?? "");
  if (code === "PGRST202" || code === "42883") return true;
  if (/could not find|matching function|unknown function|does not exist|argument/i.test(msg)) return true;
  return false;
}

export async function finalizeAiUsage(opts: {
  userId: string;
  source: string;
  actualUsdCents?: number;
  tokenUsage?: { model: string; usage: TokenUsage };
  billingMultiplier?: number;
  extraDetail?: Record<string, unknown>;
}): Promise<void> {
  const mult = Math.max(1, Math.min(4, Number(opts.billingMultiplier) || 1));
  const usd = resolveBillingUsdCents({
    source: opts.source,
    actualUsdCents: opts.actualUsdCents,
    tokenUsage: opts.tokenUsage,
    billingMultiplier: mult,
  });
  const fixedCredits = fixedCreditsForSource(opts.source, mult);

  const supabase = getServiceClient();
  const detail = {
    ...opts.extraDetail,
    billing_usd_cents: usd,
    token_usage: opts.tokenUsage ?? null,
    billing_multiplier: mult,
  };
  try {
    let { error } = await supabase.rpc("apply_free_ai_usage_after_call", {
      _user_id: opts.userId,
      _usd_cents: usd,
      _source: opts.source,
      _detail: detail as never,
      _fixed_credits: fixedCredits,
    });
    if (error && isLikelyRpcSignatureMismatch(error)) {
      ({ error } = await supabase.rpc("apply_free_ai_usage_after_call", {
        _user_id: opts.userId,
        _usd_cents: usd,
        _fixed_credits: fixedCredits,
      }));
    }
    if (error) {
      console.error("finalizeAiUsage RPC error", opts.userId, opts.source, error);
      await applyFreeUsageDirectFallback(supabase, opts.userId, usd);
    }
  } catch (e) {
    console.error("finalizeAiUsage", e);
    try {
      await applyFreeUsageDirectFallback(getServiceClient(), opts.userId, usd);
    } catch {
      /* ignore */
    }
  }
}

async function applyFreeUsageDirectFallback(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  addCents: number,
): Promise<void> {
  const { data: row, error: readErr } = await supabase
    .from("user_credits")
    .select("current_plan, free_ai_usage_usd_cents")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) {
    console.error("applyFreeUsageDirectFallback read", readErr);
    return;
  }
  if (!row) {
    const { error: insErr } = await supabase.from("user_credits").insert({
      user_id: userId,
      balance: 20,
      current_plan: "free",
      free_ai_usage_usd_cents: Math.min(FREE_TIER_USD_CAP_CENTS, addCents),
    });
    if (insErr) console.error("applyFreeUsageDirectFallback insert", insErr);
    return;
  }
  const plan = row.current_plan ?? "free";
  if (plan !== "free") return;
  const next = Math.min(FREE_TIER_USD_CAP_CENTS, (row.free_ai_usage_usd_cents ?? 0) + addCents);
  const { error: updErr } = await supabase
    .from("user_credits")
    .update({ free_ai_usage_usd_cents: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (updErr) console.error("applyFreeUsageDirectFallback update", updErr);
}
