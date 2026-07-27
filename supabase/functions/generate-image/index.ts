import {
  assertFreeAiAllowed,
  corsHeaders,
  finalizeAiUsage,
  requireUser,
} from "../_shared/aiUsage.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userOrResp = await requireUser(req);
    if (userOrResp instanceof Response) return userOrResp;
    const user = userOrResp;

    const capBlock = await assertFreeAiAllowed(user.id);
    if (capBlock) return capBlock;

    const { prompt, size = "1024x1024", quality = "high", n = 1 } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const KEY = Deno.env.get("OPENAI_API_KEY");
    if (!KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size,
        quality,
        n: Math.min(Math.max(Number(n) || 1, 1), 4),
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("OpenAI image error", r.status, text);
      const status = r.status === 429 ? 429 : r.status === 401 ? 401 : 500;
      return new Response(JSON.stringify({ error: "OpenAI error", details: text }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await r.json();
    const images = (data?.data ?? []).map((d: { b64_json?: string; url?: string }) =>
      d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url
    ).filter(Boolean);

    const ni = Math.min(4, Math.max(1, Number(n) || 1));
    await finalizeAiUsage({
      userId: user.id,
      source: "generate-image",
      billingMultiplier: ni,
      extraDetail: { n: ni, size, quality, returned: images.length },
    });

    return new Response(JSON.stringify({ images }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
