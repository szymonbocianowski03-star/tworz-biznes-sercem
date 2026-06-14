import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { requireUser } from "../_shared/aiUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Require authenticated user — never trust caller-supplied userId.
    const userOrResp = await requireUser(req);
    if (userOrResp instanceof Response) return userOrResp;
    const authedUserId = userOrResp.id;

    const body = await req.json();
    const {
      priceId,
      quantity,
      customerEmail,
      returnUrl,
      environment,
    }: {
      priceId: string;
      quantity?: number;
      customerEmail?: string;
      returnUrl: string;
      environment: StripeEnv;
    } = body;

    if (!priceId || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      throw new Error("Invalid priceId");
    }
    if (!returnUrl) throw new Error("returnUrl is required");
    if (environment !== "sandbox" && environment !== "live") {
      throw new Error("Invalid environment");
    }

    const stripe = createStripeClient(environment);

    const prices = await stripe.prices.list({ lookup_keys: [priceId] });
    if (!prices.data.length) throw new Error(`Price not found: ${priceId}`);
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...(customerEmail && { customer_email: customerEmail }),
      metadata: { userId: authedUserId, lovable_price_id: priceId },
      ...(isRecurring && {
        subscription_data: { metadata: { userId: authedUserId } },
      }),
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("create-checkout error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});