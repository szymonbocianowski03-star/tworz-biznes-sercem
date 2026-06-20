import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const TT_API = "https://business-api.tiktok.com/open_api/v1.3";

type AdminClient = SupabaseClient<Database>;

/** Odświeża token TikTok, gdy wygasa w ciągu 5 minut. Zwraca aktualny access_token. */
export async function ensureTikTokAccessToken(admin: AdminClient, connectionId: string): Promise<string> {
  const { data: conn } = await admin
    .from("tiktok_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("id", connectionId)
    .maybeSingle();

  if (!conn?.access_token) return "";

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const needsRefresh = expiresAt > 0 && expiresAt < Date.now() + 5 * 60_000;

  if (!needsRefresh || !conn.refresh_token) return conn.access_token;

  const appId = process.env.TIKTOK_APP_ID?.trim();
  const appSecret = process.env.TIKTOK_APP_SECRET?.trim();
  if (!appId || !appSecret) return conn.access_token;

  const res = await fetch(`${TT_API}/oauth2/refresh_token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: appId,
      secret: appSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as {
    code?: number;
    message?: string;
    data?: { access_token?: string; refresh_token?: string; expires_in?: number; refresh_token_expires_in?: number };
  };

  if (!res.ok || json.code !== 0 || !json.data?.access_token) {
    console.error("[tiktok token refresh]", json.message ?? res.status);
    return conn.access_token;
  }

  const d = json.data;
  await admin
    .from("tiktok_connections")
    .update({
      access_token: d.access_token,
      refresh_token: d.refresh_token ?? conn.refresh_token,
      token_expires_at: d.expires_in ? new Date(Date.now() + d.expires_in * 1000).toISOString() : conn.token_expires_at,
      refresh_token_expires_at: d.refresh_token_expires_in
        ? new Date(Date.now() + d.refresh_token_expires_in * 1000).toISOString()
        : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  return d.access_token;
}
