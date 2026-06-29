import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type UserNotificationEvent = "generation_ready" | "campaign_launched" | "weekly_report";

type Admin = SupabaseClient<Database>;

function isHttpsUrl(s: string): boolean {
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Blokuje hosty wskazujące na sieci prywatne/wewnętrzne (ochrona przed SSRF).
 * Identyczna logika jak w competitor-scan/seo-audit edge functions.
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

async function postWebhook(url: string, body: Record<string, unknown>): Promise<boolean> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12_000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "MarketingNow-launch-worker/1",
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    return r.ok;
  } catch (e) {
    console.error("userNotificationWebhook POST failed", e);
    return false;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Wywołanie webhooka użytkownika (Zapier / Make) z workerów z service role —
 * np. po zakończeniu launchu kampanii.
 */
export async function maybeDispatchUserWebhook(
  admin: Admin,
  userId: string,
  event: UserNotificationEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const { data: row } = await admin
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const url = (row?.webhook_url ?? "").trim();
  if (!url || !isSafeWebhookUrl(url)) return;

  const enabled =
    event === "generation_ready" ? (row?.notify_generation_ready ?? true) :
    event === "campaign_launched" ? (row?.notify_campaign_launched ?? true) :
    (row?.notify_weekly_report ?? false);

  if (!enabled) return;

  await postWebhook(url, {
    event,
    source: "marketingnow",
    occurred_at: new Date().toISOString(),
    user_id: userId,
    data: payload,
  });
}
