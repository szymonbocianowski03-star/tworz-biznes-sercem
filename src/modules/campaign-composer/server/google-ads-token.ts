import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AdminClient = SupabaseClient<Database>;

/** Odświeża token Google Ads, gdy wygasa w ciągu 5 minut. */
export async function ensureGoogleAdsAccessToken(admin: AdminClient, connectionId: string): Promise<string> {
  const { data: conn } = await (admin as any)
    .from("google_ads_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("id", connectionId)
    .maybeSingle();

  if (!conn?.access_token) return "";

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const needsRefresh = expiresAt > 0 && expiresAt < Date.now() + 5 * 60_000;
  if (!needsRefresh || !conn.refresh_token) return conn.access_token as string;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return conn.access_token as string;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    console.error("[google ads token refresh]", json);
    return conn.access_token as string;
  }

  await (admin as any)
    .from("google_ads_connections")
    .update({
      access_token: json.access_token,
      token_expires_at: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  return json.access_token;
}
