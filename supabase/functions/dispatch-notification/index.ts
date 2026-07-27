import { corsHeaders, getServiceClient, requireUser } from "../_shared/aiUsage.ts";

type Body = {
  event?: string;
  payload?: Record<string, unknown>;
};

const ALLOWED = new Set(["generation_ready", "campaign_launched", "weekly_report", "integration_test"]);

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Blokuje hosty wskazujące na sieci prywatne/wewnętrzne (ochrona przed SSRF).
 * Identyczna logika jak w competitor-scan/seo-audit.
 */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0") return true;
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return true;
    if (h.startsWith("::ffff:127.") || h.startsWith("::ffff:10.") ||
        h.startsWith("::ffff:192.168.") || h.startsWith("::ffff:169.254.")) return true;
    return false;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

function isSafeWebhookUrl(s: string): boolean {
  if (!isHttpsUrl(s)) return false;
  try {
    return !isBlockedHost(new URL(s).hostname);
  } catch {
    return false;
  }
}

async function postWebhook(url: string, body: Record<string, unknown>): Promise<{ ok: boolean; status?: number; err?: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12_000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "MarketingNow-dispatch-notification/1",
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { ok: false, status: r.status, err: txt.slice(0, 500) };
    }
    return { ok: true, status: r.status };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, err: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const userOrResp = await requireUser(req);
    if (userOrResp instanceof Response) return userOrResp;
    const user = userOrResp;

    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = typeof body.event === "string" ? body.event : "";
    if (!ALLOWED.has(event)) {
      return new Response(JSON.stringify({ error: "Unknown event" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();
    const { data: row } = await supabase
      .from("user_notification_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const webhookUrl = (row?.webhook_url ?? "").trim();
    if (!webhookUrl || !isSafeWebhookUrl(webhookUrl)) {
      return Response.json(
        { ok: true, skipped: true, reason: "no_webhook" },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (event === "integration_test") {
      const out = await postWebhook(webhookUrl, {
        event: "integration_test",
        source: "marketingnow",
        occurred_at: new Date().toISOString(),
        user_id: user.id,
        message: "Test połączenia z MarketingNow — możesz zamknąć ten krok w Zapier.",
      });
      if (!out.ok) {
        console.error("webhook test failed", out);
        return Response.json(
          { ok: false, error: "webhook_failed", detail: out.err ?? out.status },
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return Response.json({ ok: true, webhookDispatched: true }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const gen = row?.notify_generation_ready ?? true;
    const camp = row?.notify_campaign_launched ?? true;
    const week = row?.notify_weekly_report ?? false;

    const enabled =
      event === "generation_ready" ? gen :
      event === "campaign_launched" ? camp :
      event === "weekly_report" ? week :
      false;

    if (!enabled) {
      return Response.json(
        { ok: true, skipped: true, reason: "disabled" },
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const envelope = {
      event,
      source: "marketingnow",
      occurred_at: new Date().toISOString(),
      user_id: user.id,
      user_email: user.email ?? null,
      data: body.payload && typeof body.payload === "object" ? body.payload : {},
    };

    const out = await postWebhook(webhookUrl, envelope);
    if (!out.ok) {
      console.error("webhook dispatch failed", event, out);
      return Response.json(
        { ok: false, error: "webhook_failed", detail: out.err ?? out.status },
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return Response.json({ ok: true, webhookDispatched: true }, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("dispatch-notification", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
