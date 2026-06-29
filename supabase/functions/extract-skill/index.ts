import {
  assertFreeAiAllowed,
  corsHeaders,
  finalizeAiUsage,
  requireUser,
} from "../_shared/aiUsage.ts";
import { usdCentsFromGatewayCompletion } from "../_shared/aiCost.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userOrResp = await requireUser(req);
    if (userOrResp instanceof Response) return userOrResp;
    const user = userOrResp;

    const capBlock = await assertFreeAiAllowed(user.id);
    if (capBlock) return capBlock;

    const { system, prompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY brak");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system ?? "Zwróć wyłącznie JSON zgodny ze schematem narzędzia." },
          { role: "user", content: prompt ?? "" },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "build_skill",
              description: "Zbuduj umiejętność (skill) jako JSON.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  whenToUse: { type: "string" },
                  content: { type: "string" },
                },
                required: ["name", "description", "whenToUse", "content"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "build_skill" } },
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
      console.error("extract-skill upstream:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = typeof args === "string" ? JSON.parse(args) : args;
    } catch { /* ignore */ }
    if (!parsed || typeof parsed !== "object" || !parsed.name) {
      return new Response(JSON.stringify({ error: "Brak danych w odpowiedzi" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const out = JSON.stringify(parsed);
    const actualUsdCents = usdCentsFromGatewayCompletion("google/gemini-3-flash-preview", data);
    await finalizeAiUsage({
      userId: user.id,
      source: "extract-skill",
      actualUsdCents: actualUsdCents ?? undefined,
    });

    return new Response(out, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-skill error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
