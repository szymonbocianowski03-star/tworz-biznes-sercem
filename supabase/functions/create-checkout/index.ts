import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { requireUser } from "../_shared/aiUsage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }

  const foundByUser = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (foundByUser.data.length) return foundByUser.data[0].id;

  if (options.email) {
    const foundByEmail = await stripe.customers.list({ email: options.email, limit: 1 });
    if (foundByEmail.data.length) {
      const customer = foundByEmail.data[0];
      if (customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

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

    const prices = await stripe.prices.list({ lookup_keys: [priceId], active: true, limit: 1 });
    if (!prices.data.length) throw new Error(`Price not found: ${priceId}`);
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";
    const customerId = await resolveOrCreateCustomer(stripe, {
      email: customerEmail,
      userId: authedUserId,
    });

    let productDescription: string | undefined;
    if (!isRecurring) {
      const productId = typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);
      productDescription = product.name;
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer: customerId,
      metadata: { userId: authedUserId, lovable_price_id: priceId, managed_payments: "false" },
      // Wyłączamy managed payments (rail „Link"), żeby Stripe pokazał wszystkie
      // metody włączone na koncie (karta, BLIK, Przelewy24 dla PLN itd.).
      // Stripe sam kalkuluje i pobiera podatek; rozliczenie/remittance po stronie sprzedawcy.
      automatic_tax: { enabled: true },
      ...(!isRecurring && { payment_intent_data: { description: productDescription } }),
      ...(isRecurring && {
        subscription_data: { metadata: { userId: authedUserId, lovable_price_id: priceId } },
      }),
    } as any);

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