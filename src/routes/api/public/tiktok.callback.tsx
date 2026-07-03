import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TT_API = "https://business-api.tiktok.com/open_api/v1.3";

/**
 * Poświadczenia TikTok (łatwo je pomylić):
 * - TIKTOK_APP_ID    → NUMERYCZNY App ID z TikTok for Business. Trafia do `app_id`
 *                      przy wymianie auth_code na access_token. MUSI być liczbą.
 * - TIKTOK_CLIENT_KEY→ Client Key / App Key aplikacji OAuth (alfanumeryczny).
 *                      NIE używać jako `app_id`.
 * - TIKTOK_APP_SECRET→ Sekret aplikacji, używany przy wymianie tokenu.
 * - TIKTOK_REDIRECT_URI→ Adres przekierowania zarejestrowany w TikTok Developer
 *                      Console — musi dokładnie pasować do callbacku.
 * - TikTok Events Manager App ID → inny identyfikator do mierzenia konwersji
 *                      (Events API), niezwiązany z tym przepływem OAuth.
 */

export const Route = createFileRoute("/api/public/tiktok/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        // TikTok zwraca parametr `auth_code` (czasem `code`) oraz `state`.
        const code = url.searchParams.get("auth_code") ?? url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDesc = url.searchParams.get("error_description");

        if (error || !code || !state) {
          return redirectBack(url.origin, { ok: false, error: errorDesc ?? error ?? "missing_code" });
        }

        const cookieHeader = request.headers.get("cookie") ?? "";
        const cookieState = cookieHeader
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("tiktok_oauth_state="))
          ?.split("=")[1];

        if (!cookieState || cookieState !== state) {
          return redirectBack(url.origin, { ok: false, error: "state_mismatch" });
        }

        const userId = state.split(".")[0];
        const appId = process.env.TIKTOK_APP_ID?.trim();
        const appSecret = process.env.TIKTOK_APP_SECRET?.trim();

        // Walidacja konfiguracji — te same reguły co przy starcie OAuth.
        if (!appId || !/^\d+$/.test(appId)) {
          return redirectBack(url.origin, {
            ok: false,
            error: "config_error: TIKTOK_APP_ID musi być numerycznym App ID (nie Client Key).",
          });
        }
        if (!appSecret) {
          return redirectBack(url.origin, {
            ok: false,
            error: "config_error: brak TIKTOK_APP_SECRET.",
          });
        }

        // redirect_uri przy wymianie tokenu musi być identyczny jak przy starcie.
        const computedRedirectUri = `${url.origin}/api/public/tiktok/callback`;
        const redirectUri = process.env.TIKTOK_REDIRECT_URI?.trim() || computedRedirectUri;

        try {
          // 1. wymiana auth_code na access_token
          const tokenRes = await fetch(`${TT_API}/oauth2/access_token/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              app_id: appId,
              secret: appSecret,
              auth_code: code,
              grant_type: "auth_code",
              redirect_uri: redirectUri,
            }),
          });
          const tokenJson = await tokenRes.json();
          if (!tokenRes.ok || tokenJson.code !== 0) {
            throw new Error(tokenJson.message ?? JSON.stringify(tokenJson));
          }

          const d = tokenJson.data ?? {};
          const accessToken: string = d.access_token;
          const refreshToken: string | null = d.refresh_token ?? null;
          // TikTok zwraca expires_in / refresh_token_expires_in w sekundach (gdy dostępne).
          const expiresIn: number | null = d.expires_in ?? null;
          const refreshExpiresIn: number | null = d.refresh_token_expires_in ?? null;
          const scope: string | null = Array.isArray(d.scope) ? d.scope.join(",") : d.scope ?? null;
          const advertiserIds: string[] = Array.isArray(d.advertiser_ids) ? d.advertiser_ids : [];

          // 2. pobierz nazwy kont reklamowych (advertiser accounts)
          let advertiserAccounts: Array<{ id: string; name?: string; currency?: string }> = [];
          try {
            const advRes = await fetch(
              `${TT_API}/oauth2/advertiser/get/?app_id=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}&access_token=${encodeURIComponent(accessToken)}`,
              { headers: { "Access-Token": accessToken } },
            );
            const advJson = await advRes.json();
            advertiserAccounts = (advJson?.data?.list ?? []).map((a: any) => ({
              id: String(a.advertiser_id),
              name: a.advertiser_name,
              currency: a.currency,
            }));
          } catch (e) {
            console.error("[tiktok advertiser get]", e);
          }
          if (advertiserAccounts.length === 0 && advertiserIds.length > 0) {
            advertiserAccounts = advertiserIds.map((id) => ({ id: String(id) }));
          }

          const selectedAdvertiserId = advertiserAccounts[0]?.id ?? null;
          const tiktokAdvertiserId = selectedAdvertiserId ?? "unknown";
          const advertiserName = advertiserAccounts[0]?.name ?? null;

          // 3. upsert połączenia
          const { error: upsertErr } = await supabaseAdmin
            .from("tiktok_connections")
            .upsert(
              {
                user_id: userId,
                tiktok_advertiser_id: tiktokAdvertiserId,
                advertiser_name: advertiserName,
                access_token: accessToken,
                refresh_token: refreshToken,
                token_expires_at: expiresIn
                  ? new Date(Date.now() + expiresIn * 1000).toISOString()
                  : null,
                refresh_token_expires_at: refreshExpiresIn
                  ? new Date(Date.now() + refreshExpiresIn * 1000).toISOString()
                  : null,
                scope,
                advertiser_accounts: advertiserAccounts,
                selected_advertiser_id: selectedAdvertiserId,
                status: "connected",
                last_synced_at: new Date().toISOString(),
              },
              { onConflict: "user_id,tiktok_advertiser_id" },
            );
          if (upsertErr) throw upsertErr;

          return redirectBack(url.origin, { ok: true, name: advertiserName ?? undefined });
        } catch (e: any) {
          console.error("[tiktok callback]", e);
          return redirectBack(url.origin, { ok: false, error: String(e?.message ?? e).slice(0, 200) });
        }
      },
    },
  },
});

function redirectBack(origin: string, params: { ok: boolean; name?: string; error?: string }) {
  const qs = new URLSearchParams();
  qs.set("tiktok", params.ok ? "connected" : "error");
  if (params.name) qs.set("name", params.name);
  if (params.error) qs.set("error", params.error);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/integrations?${qs.toString()}`,
      "Set-Cookie": "tiktok_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
    },
  });
}