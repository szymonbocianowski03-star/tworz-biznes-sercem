import {
  assertFreeAiAllowed,
  corsHeaders,
  finalizeAiUsage,
  requireUser,
} from "../_shared/aiUsage.ts";
import { usdCentsFromGatewayCompletion } from "../_shared/aiCost.ts";

const CREATIVE_TYPES = [
  "phone-chat",
  "tools-comparison",
  "dashboard-hero",
  "product-mockup",
  "viral-social",
] as const;

const FORMATS = ["9:16", "1:1", "4:5", "16:9"] as const;

/**
 * NIGDY nie pozwól modelowi obrazu generować finalnych napisów.
 * Ten suffix jest doklejany do każdego visual_prompt (również po stronie klienta).
 */
const NO_TEXT_RULE =
  "Generate only the visual background, phone mockup, product mockup, lighting, gradients, scene and composition. " +
  "Do not generate readable text, fake text, lorem ipsum, random letters, fake UI labels or distorted words. " +
  "The final text will be generated separately and rendered programmatically as editable typography.";

function typeBrief(t: string): string {
  switch (t) {
    case "phone-chat":
      return "Reklama typu 'Phone Chat Recommendation Ad': smartfon w centrum, premium ciemne tło, gradientowe światło, wiadomość użytkownika w dymku i odpowiedź AI rekomendująca markę, lista narzędzi z zielonymi checkmarkami z boku.";
    case "tools-comparison":
      return "Reklama typu 'AI Tools Comparison Ad': pionowa lista narzędzi/funkcji z checkmarkami, promowana marka mocno wyróżniona na tle konkurencji.";
    case "dashboard-hero":
      return "Reklama typu 'SaaS Dashboard Hero Ad': panel/dashboard jako element wizualny (BEZ czytelnych napisów na obrazie), mocny headline i CTA renderowane osobno.";
    case "product-mockup":
      return "Reklama typu 'Premium Product Mockup Ad': produkt/mockup w centrum, mocny headline, podtytuł, cena i CTA.";
    case "viral-social":
      return "Reklama typu 'Viral Social Proof Ad': pytanie użytkownika, odpowiedź AI, wyróżnienie marki jako najlepszego rozwiązania, social proof.";
    default:
      return "Nowoczesna kreacja reklamowa SaaS.";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userOrResp = await requireUser(req);
    if (userOrResp instanceof Response) return userOrResp;
    const user = userOrResp;

    const capBlock = await assertFreeAiAllowed(user.id);
    if (capBlock) return capBlock;

    const body = await req.json().catch(() => ({}));
    const brief = String(body?.brief ?? "").trim();
    const creativeType = CREATIVE_TYPES.includes(body?.creativeType)
      ? body.creativeType
      : "phone-chat";
    const format = FORMATS.includes(body?.format) ? body.format : "9:16";
    const brandName = String(body?.brandName ?? "").trim();
    const brandRules = String(body?.brandRules ?? "").trim().slice(0, 2500);

    if (!brief) {
      return new Response(JSON.stringify({ error: "Brak opisu (brief)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY brak" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = "google/gemini-2.5-flash";
    const system = [
      "Jesteś dyrektorem kreatywnym platformy reklamowej AI (jak profesjonalne AI ad platforms).",
      "Tworzysz copy reklamy ORAZ visual_prompt do generatora obrazu.",
      "KLUCZOWE ZASADY:",
      "1. Cały tekst (copy) musi być po polsku, poprawny, czytelny, bez Lorem Ipsum i bez losowych słów.",
      "2. visual_prompt opisuje TYLKO warstwę wizualną (tło, mockup, światło, kompozycję) po angielsku — NIGDY nie zawiera finalnych napisów reklamy.",
      "3. Dobierz krótkie, mocne teksty marketingowe pasujące do typu kreacji.",
      `Typ kreacji: ${typeBrief(creativeType)}`,
      brandName ? `Promowana marka: ${brandName}.` : "",
      brandRules ? `Tożsamość wizualna marki: ${brandRules}` : "",
    ].filter(Boolean).join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Brief reklamy: ${brief}\nFormat: ${format}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "ad_creative",
              description: "Zwróć copy reklamy i prompt wizualny (bez napisów na obrazie).",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string", description: "Mocny nagłówek PL (max 8 słów)" },
                  subheadline: { type: "string", description: "Podtytuł PL (max 14 słów)" },
                  user_message: { type: "string", description: "Pytanie użytkownika w dymku czatu PL" },
                  ai_response: { type: "string", description: "Odpowiedź AI rekomendująca markę PL (max 28 słów)" },
                  brand_name: { type: "string", description: "Nazwa promowanej marki" },
                  side_badges: { type: "array", items: { type: "string" }, description: "3-5 etykiet/narzędzi/porównań" },
                  features: { type: "array", items: { type: "string" }, description: "3-5 krótkich korzyści/funkcji z checkmarkami PL" },
                  cta: { type: "string", description: "Krótkie CTA PL (max 4 słowa)" },
                  price: { type: "string", description: "Cena lub promocja PL (opcjonalnie, np. '49 zł/mies.')" },
                  slogan: { type: "string", description: "Krótki slogan PL (opcjonalnie)" },
                  disclaimer: { type: "string", description: "Drobny disclaimer PL (opcjonalnie)" },
                  visual_prompt: {
                    type: "string",
                    description: "EN prompt for the image model describing ONLY background/mockup/lighting/scene. No text.",
                  },
                  accent_color: { type: "string", description: "Kolor akcentu w HEX (np. #8b5cf6)" },
                },
                required: ["headline", "ai_response", "brand_name", "cta", "visual_prompt", "accent_color"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "ad_creative" } },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("ad-creative gateway error", resp.status, text);
      const status = resp.status === 429 ? 429 : 500;
      return new Response(JSON.stringify({ error: "Błąd generatora treści." }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(args) ?? {};
    } catch {
      parsed = {};
    }

    const visualPrompt = String(parsed.visual_prompt ?? "").trim();
    const finalVisual = `${visualPrompt}\n\n${NO_TEXT_RULE}`.trim();

    const creative = {
      creative_type: creativeType,
      format,
      visual_prompt: finalVisual,
      copy: {
        headline: parsed.headline ?? "",
        subheadline: parsed.subheadline ?? "",
        user_message: parsed.user_message ?? "",
        ai_response: parsed.ai_response ?? "",
        brand_name: parsed.brand_name ?? brandName ?? "",
        side_badges: Array.isArray(parsed.side_badges) ? parsed.side_badges.slice(0, 5) : [],
        features: Array.isArray(parsed.features) ? parsed.features.slice(0, 5) : [],
        cta: parsed.cta ?? "",
        price: parsed.price ?? "",
        slogan: parsed.slogan ?? "",
        disclaimer: parsed.disclaimer ?? "",
      },
      accent_color: typeof parsed.accent_color === "string" ? parsed.accent_color : "#8b5cf6",
    };

    const actualUsdCents = usdCentsFromGatewayCompletion(model, data);
    await finalizeAiUsage({
      userId: user.id,
      source: "suggest",
      actualUsdCents: actualUsdCents ?? undefined,
      extraDetail: { feature: "generate-ad-creative", creativeType, format },
    });

    return new Response(JSON.stringify({ creative }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ad-creative", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Nieznany błąd" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});