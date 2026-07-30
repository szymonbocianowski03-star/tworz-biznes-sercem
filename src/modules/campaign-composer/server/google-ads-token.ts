import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AdminClient = SupabaseClient<Database>;

export class GoogleAdsTokenError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "GoogleAdsTokenError";
  }
}

function tokenExpiredOrUnknown(value: string | null | undefined): boolean {
  if (!value) return true;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return true;
  return time < Date.now() + 5 * 60_000;
}

/** Odświeża token Google Ads, gdy wygasa w ciągu 5 minut. */
export async function ensureGoogleAdsAccessToken(admin: AdminClient, connectionId: string): Promise<string> {
  const { data: conn } = await (admin as any)
    .from("google_ads_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("id", connectionId)
    .maybeSingle();

  if (!conn?.access_token) return "";

  const needsRefresh = tokenExpiredOrUnknown(conn.token_expires_at as string | null | undefined);
  if (!needsRefresh || !conn.refresh_token) return conn.access_token as string;

  if (!conn.refresh_token) {
    await (admin as any)
      .from("google_ads_connections")
      .update({
        status: "reauth_required",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);
    throw new GoogleAdsTokenError(
      "Połączenie Google Ads nie ma refresh tokenu. Wejdź w Integracje i połącz Google Ads ponownie.",
      "GOOGLE_ADS_REAUTH_REQUIRED",
    );
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new GoogleAdsTokenError(
      "Brak konfiguracji Google OAuth na serwerze. Uzupełnij GOOGLE_OAUTH_CLIENT_ID i GOOGLE_OAUTH_CLIENT_SECRET.",
      "GOOGLE_OAUTH_MISSING_CONFIG",
    );
  }

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
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    console.error("[google ads token refresh]", json);
    await (admin as any)
      .from("google_ads_connections")
      .update({
        status: "reauth_required",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);
    throw new GoogleAdsTokenError(
      "Token Google Ads wygasł i nie da się go odświeżyć. Wejdź w Integracje i kliknij „Zmień konto Google” / połącz Google Ads ponownie.",
      json.error ?? "GOOGLE_ADS_REFRESH_FAILED",
    );
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
