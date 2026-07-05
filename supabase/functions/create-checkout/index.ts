import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { requireUser } from "../_shared/aiUsage.ts";

type CatalogItem = {
  productName: string;
  productDescription: string;
  amount: number;
  currency: "pln";
  recurringInterval?: "month" | "year";
  taxCode: string;
};

const PRICE_CATALOG: Record<string, CatalogItem> = {
  starter_monthly: {
    productName: "Starter",
    productDescription: "2 400 kredytów miesięcznie. Rozliczenie co miesiąc.",
    amount: 4900,
    currency: "pln",
    recurringInterval: "month",
    taxCode: "txcd_10103001",
  },
  starter_yearly: {
    productName: "Starter",
    productDescription: "2 400 kredytów miesięcznie. Rozliczenie roczne.",
    amount: 52900,
    currency: "pln",
    recurringInterval: "year",
    taxCode: "txcd_10103001",
  },
  pro_monthly: {
    productName: "Pro",
    productDescription: "7 400 kredytów miesięcznie. Rozliczenie co miesiąc.",
    amount: 14900,
    currency: "pln",
    recurringInterval: "month",
    taxCode: "txcd_10103001",
  },
  pro_yearly: {
    productName: "Pro",
    productDescription: "7 400 kredytów miesięcznie. Rozliczenie roczne.",
    amount: 160900,
    currency: "pln",
    recurringInterval: "year",
    taxCode: "txcd_10103001",
  },
  growth_monthly: {
    productName: "Growth",
    productDescription: "19 900 kredytów miesięcznie. Rozliczenie co miesiąc.",
    amount: 39900,
    currency: "pln",
    recurringInterval: "month",
    taxCode: "txcd_10103001",
  },
  growth_yearly: {
    productName: "Growth",
    productDescription: "19 900 kredytów miesięcznie. Rozliczenie roczne.",
    amount: 430900,
    currency: "pln",
    recurringInterval: "year",
    taxCode: "txcd_10103001",
  },
  business_monthly: {
    productName: "Business",
    productDescription: "24 900 kredytów miesięcznie. Rozliczenie co miesiąc.",
    amount: 49900,
    currency: "pln",
    recurringInterval: "month",
    taxCode: "txcd_10103001",
  },
  business_yearly: {
    productName: "Business",
    productDescription: "24 900 kredytów miesięcznie. Rozliczenie roczne.",
    amount: 538900,
    currency: "pln",
    recurringInterval: "year",
    taxCode: "txcd_10103001",
  },
  enterprise_monthly: {
    productName: "Enterprise",
    productDescription: "74 900 kredytów miesięcznie. Rozliczenie co miesiąc.",
    amount: 149900,
    currency: "pln",
    recurringInterval: "month",
    taxCode: "txcd_10103001",
  },
  enterprise_yearly: {
    productName: "Enterprise",
    productDescription: "74 900 kredytów miesięcznie. Rozliczenie roczne.",
    amount: 1618900,
    currency: "pln",
    recurringInterval: "year",
    taxCode: "txcd_10103001",
  },
  credits_200: {
    productName: "400 kredytów",
    productDescription: "Jednorazowy pakiet 400 kredytów. Kredyty z dokupionych paczek nie wygasają z końcem miesiąca.",
    amount: 1900,
    currency: "pln",
    taxCode: "txcd_10103001",
  },
  credits_1000: {
    productName: "1 900 kredytów",
    productDescription: "Jednorazowy pakiet 1 900 kredytów. Kredyty z dokupionych paczek nie wygasają z końcem miesiąca.",
    amount: 7900,
    currency: "pln",
    taxCode: "txcd_10103001",
  },
  credits_5000: {
    productName: "7 400 kredytów",
    productDescription: "Jednorazowy pakiet 7 400 kredytów. Kredyty z dokupionych paczek nie wygasają z końcem miesiąca.",
    amount: 29900,
    currency: "pln",
    taxCode: "txcd_10103001",
  },
};

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

    const catalogItem = PRICE_CATALOG[priceId];
    if (!catalogItem) throw new Error(`Price not found: ${priceId}`);
    const isRecurring = Boolean(catalogItem.recurringInterval);
    const stripe = createStripeClient(environment);
    const customerId = await resolveOrCreateCustomer(stripe, {
      email: customerEmail,
      userId: authedUserId,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          quantity: quantity || 1,
          price_data: {
            currency: catalogItem.currency,
            unit_amount: catalogItem.amount,
            ...(catalogItem.recurringInterval && { recurring: { interval: catalogItem.recurringInterval } }),
            product_data: {
              name: catalogItem.productName,
              description: catalogItem.productDescription,
              tax_code: catalogItem.taxCode,
              metadata: { lovable_price_id: priceId },
            },
          },
        },
      ],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer: customerId,
      allow_promotion_codes: true,
      metadata: { userId: authedUserId, lovable_price_id: priceId, managed_payments: "false" },
      ...(!isRecurring && { payment_intent_data: { description: catalogItem.productName } }),
      // Wyłączamy managed payments (rail „Link"), żeby Stripe pokazał wszystkie
      // metody włączone na koncie (karta, BLIK, Przelewy24 dla PLN itd.).
      // Stripe sam kalkuluje i pobiera podatek; rozliczenie/remittance po stronie sprzedawcy.
      automatic_tax: { enabled: true },
      // Automatyczny podatek wymaga adresu na kliencie — zapisz adres z checkoutu.
      customer_update: { address: "auto" },
      // Nie wymuszamy ręcznie metod płatności, bo Stripe odrzuca checkout,
      // jeśli dana metoda (np. Przelewy24) nie jest aktywna/dostępna dla konta.
      // Checkout ma się zawsze otworzyć, a Stripe pokaże dostępne metody automatycznie.
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