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

    const { messages, count } = await req.json();
    const N = Math.max(3, Math.min(8, Number(count) || 5));
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY brak");

    const last = messages?.slice(-6) ?? [];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              `Jesteś generatorem propozycji promptów dla aplikacji marketingowej (po polsku). Zwróć DOKŁADNIE ${N} propozycji. Każda: konkretna, gotowa do kliknięcia, 1 zdanie (max ~15 słów), bez emoji, bez numerowania, bez kropki końcowej. Mają być realnymi pytaniami/zadaniami, jakie użytkownik wpisałby do agenta marketingowego.`,
          },
          ...last,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_replies",
              description: `Zwróć ${N} sugerowanych promptów użytkownika.`,
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    minItems: N,
                    maxItems: N,
                    items: { type: "string" },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_replies" } },
      }),
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let suggestions: string[] = [];
    try {
      suggestions = JSON.parse(args)?.suggestions ?? [];
    } catch {
      suggestions = [];
    }

    const outJson = JSON.stringify({ suggestions });
    const actualUsdCents = usdCentsFromGatewayCompletion("google/gemini-2.5-flash", data);
    await finalizeAiUsage({
      userId: user.id,
      source: "suggest",
      actualUsdCents: actualUsdCents ?? undefined,
    });

    return new Response(outJson, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest error:", e);
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
