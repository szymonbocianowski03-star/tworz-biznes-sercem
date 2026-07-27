import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const PLAN_BY_PRICE: Record<string, { plan: string; credits: number }> = {
  starter_monthly: { plan: "starter", credits: 2400 },
  starter_yearly: { plan: "starter", credits: 2400 },
  pro_monthly: { plan: "pro", credits: 7400 },
  pro_yearly: { plan: "pro", credits: 7400 },
  growth_monthly: { plan: "growth", credits: 19900 },
  growth_yearly: { plan: "growth", credits: 19900 },
  business_monthly: { plan: "business", credits: 24900 },
  business_yearly: { plan: "business", credits: 24900 },
  enterprise_monthly: { plan: "enterprise", credits: 74900 },
  enterprise_yearly: { plan: "enterprise", credits: 74900 },
};

const CREDIT_PACK_BY_PRICE: Record<string, number> = {
  credits_200: 400,
  credits_1000: 1900,
  credits_5000: 7400,
};

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  }
  return _supabase;
}

function extractPriceId(subscription: any): string | null {
  const metadataPriceId = subscription.metadata?.lovable_price_id;
  if (metadataPriceId) return metadataPriceId;
  const item = subscription.items?.data?.[0];
  return item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id || null;
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = extractPriceId(subscription);
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  if ((subscription.status === "active" || subscription.status === "trialing") && priceId && PLAN_BY_PRICE[priceId]) {
    const { plan, credits } = PLAN_BY_PRICE[priceId];
    await getSupabase().rpc("apply_plan_credits", {
      _user_id: userId,
      _new_plan: plan,
      _new_credits: credits,
    });
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await getSupabase()
        .from("subscriptions")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", (event.data.object as any).id)
        .eq("environment", env);
      break;
    case "checkout.session.completed": {
      const session = event.data.object as any;
      if (session.mode === "payment") {
        const userId = session.metadata?.userId;
        const priceId = session.metadata?.lovable_price_id;
        const credits = priceId ? CREDIT_PACK_BY_PRICE[priceId] : 0;
        if (userId && credits) {
          const sb = getSupabase();
          // Idempotent insert by stripe_session_id
          const { error: insertErr } = await sb.from("credit_purchases").insert({
            user_id: userId,
            stripe_session_id: session.id,
            price_id: priceId,
            credits_added: credits,
            amount_pln: session.amount_total ?? 0,
            environment: env,
          });
          if (!insertErr) {
            await sb.rpc("add_credits", { _user_id: userId, _amount: credits });
          } else {
            console.log("credit_purchases insert skipped:", insertErr.message);
          }
        }
      }
      break;
    }
    default:
      console.log("Unhandled event:", event.type);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    await handleWebhook(req, rawEnv);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});