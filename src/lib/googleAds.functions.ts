import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { GOOGLE_ADS_API_BASE } from "@/lib/googleAdsApi";

const GOOGLE_ADS_API = GOOGLE_ADS_API_BASE;

export type GoogleAdsCustomerAccount = {
  id: string;
  resourceName: string;
  descriptiveName?: string;
};

export type RefreshGoogleAdsResult =
  | {
      ok: true;
      accounts: GoogleAdsCustomerAccount[];
      selectedCustomerId: string | null;
    }
  | { ok: false; error: "not_connected" | "no_access" | "list_failed" };

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number } | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !j.access_token) {
    console.error("[google ads] token refresh failed", j);
    return null;
  }
  return { accessToken: j.access_token, expiresIn: j.expires_in ?? 3600 };
}

function adsHeaders(accessToken: string, loginCustomerId?: string): Record<string, string> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (developerToken) headers["developer-token"] = developerToken;
  const login = loginCustomerId?.replace(/[^0-9]/g, "");
  if (login) headers["login-customer-id"] = login;
  return headers;
}

async function listAccessibleCustomerIds(accessToken: string): Promise<string[] | null> {
  const res = await fetch(`${GOOGLE_ADS_API}/customers:listAccessibleCustomers`, {
    headers: adsHeaders(accessToken),
  });
  const text = await res.text();
  let json: { resourceNames?: string[] };
  try {
    json = JSON.parse(text);
  } catch {
    console.warn("[google ads] listAccessibleCustomers non-JSON", { status: res.status, body: text.slice(0, 300) });
    return null;
  }
  if (!res.ok) {
    console.warn("[google ads] listAccessibleCustomers", { status: res.status, json });
    return null;
  }
  return (json.resourceNames ?? []).map((rn) => rn.replace(/^customers\//, ""));
}

/** Pobiera nazwę opisową konta (best-effort). Zwraca undefined przy błędzie. */
async function fetchDescriptiveName(
  accessToken: string,
  customerId: string,
  loginCustomerId?: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(`${GOOGLE_ADS_API}/customers/${customerId}/googleAds:searchStream`, {
      method: "POST",
      headers: adsHeaders(accessToken, loginCustomerId),
      body: JSON.stringify({
        query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1",
      }),
    });
    if (!res.ok) return undefined;
    const batches = (await res.json()) as Array<{
      results?: Array<{ customer?: { descriptiveName?: string } }>;
    }>;
    for (const b of batches ?? []) {
      const name = b.results?.[0]?.customer?.descriptiveName;
      if (name) return name;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Automatycznie pobiera listę kont reklamowych Google Ads użytkownika
 * (odświeża token, listuje dostępne konta + nazwy) i zapisuje w bazie.
 * Jeśli żadne konto nie jest wybrane — wybiera pierwsze.
 */
export const refreshGoogleAdsAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RefreshGoogleAdsResult> => {
    const { userId } = context;

    const { data: conn } = await supabaseAdmin
      .from("google_ads_connections")
      .select("id, access_token, refresh_token, token_expires_at, login_customer_id, selected_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!conn) return { ok: false, error: "not_connected" };

    let accessToken = conn.access_token as string;
    const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
    if ((exp === 0 || Date.now() > exp - 60_000) && conn.refresh_token) {
      const refreshed = await refreshAccessToken(conn.refresh_token as string);
      if (refreshed) {
        accessToken = refreshed.accessToken;
        await supabaseAdmin
          .from("google_ads_connections")
          .update({
            access_token: accessToken,
            token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
          })
          .eq("user_id", userId);
      }
    }

    const ids = await listAccessibleCustomerIds(accessToken);
    if (ids === null) return { ok: false, error: "list_failed" };
    if (ids.length === 0) return { ok: false, error: "no_access" };

    const loginCustomerId = (conn.login_customer_id as string | null) ?? undefined;
    const accounts: GoogleAdsCustomerAccount[] = [];
    for (const id of ids.slice(0, 50)) {
      const descriptiveName = await fetchDescriptiveName(accessToken, id, loginCustomerId);
      accounts.push({ id, resourceName: `customers/${id}`, descriptiveName });
    }

    const selectedCustomerId =
      (conn.selected_customer_id as string | null) && ids.includes(conn.selected_customer_id as string)
        ? (conn.selected_customer_id as string)
        : accounts[0]?.id ?? null;

    await supabaseAdmin
      .from("google_ads_connections")
      .update({
        customer_accounts: accounts,
        selected_customer_id: selectedCustomerId,
        status: "connected",
        last_synced_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return { ok: true, accounts, selectedCustomerId };
  });
