import { createFileRoute } from "@tanstack/react-router";
import { oauthStartErrorResponse } from "@/lib/oauthHtml";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Wyjaśnienie poszczególnych poświadczeń TikTok — łatwo je pomylić:
 *
 * - TIKTOK_APP_ID    → NUMERYCZNY identyfikator aplikacji w TikTok for Business
 *                      (TikTok Business / Marketing API). To właśnie ta wartość
 *                      trafia do parametru `app_id` w URL autoryzacji oraz przy
 *                      wymianie auth_code na access_token. MUSI być liczbą.
 * - TIKTOK_CLIENT_KEY→ "Client Key" / "App Key" aplikacji OAuth (ciąg
 *                      alfanumeryczny, np. `awuzhznh4u2r6oqx`). NIE wolno go
 *                      używać jako `app_id` — to powodowało błąd
 *                      "app_id: ... an invalid integer".
 * - TIKTOK_APP_SECRET→ Sekret aplikacji, używany po stronie serwera przy
 *                      wymianie auth_code na access_token.
 * - TIKTOK_REDIRECT_URI→ Adres przekierowania zarejestrowany w TikTok Developer
 *                      Console. Musi DOKŁADNIE pasować do callbacku aplikacji.
 * - TikTok Events Manager App ID → ZUPEŁNIE INNY identyfikator, używany tylko do
 *                      mierzenia konwersji (Events API / pixel). NIE używamy go
 *                      w przepływie OAuth Business API.
 */

// TikTok Ads (TikTok for Business) — uprawnienia wybierasz w TikTok Developer Portal
// przy tworzeniu aplikacji Marketing API, NIE przez parametr scope w URL portal/auth.

export const Route = createFileRoute("/api/public/tiktok/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) {
          return oauthStartErrorResponse(400, {
            title: "Brak sesji użytkownika",
            detail: "Odśwież stronę integracji i upewnij się, że jesteś zalogowany.",
          });
        }
        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) {
          return oauthStartErrorResponse(401, {
            title: "Sesja wygasła",
            detail: "Zaloguj się ponownie i spróbuj jeszcze raz.",
          });
        }
        const userId = userData.user.id;

        const appId = process.env.TIKTOK_APP_ID?.trim();
        const appSecret = process.env.TIKTOK_APP_SECRET?.trim();

        // Walidacja konfiguracji: app_id MUSI istnieć i być liczbą.
        if (!appId) {
          return oauthStartErrorResponse(500, {
            title: "Połączenie z TikTok Ads niedostępne",
            detail:
              "Brakuje TIKTOK_APP_ID (numeryczny App ID z TikTok for Business). Skonfiguruj integrację TikTok Ads i spróbuj ponownie.",
          });
        }
        if (!/^\d+$/.test(appId)) {
          // Najczęstsza przyczyna błędu "app_id: ... an invalid integer":
          // do TIKTOK_APP_ID wpisano Client Key zamiast numerycznego App ID.
          return oauthStartErrorResponse(500, {
            title: "Błędna konfiguracja TikTok Ads",
            detail:
              "TIKTOK_APP_ID musi być wartością numeryczną (numeryczny App ID z TikTok for Business). Wygląda na to, że ustawiono tam Client Key. Ustaw poprawny numeryczny App ID.",
          });
        }
        if (!appSecret) {
          return oauthStartErrorResponse(500, {
            title: "Błędna konfiguracja TikTok Ads",
            detail: "Brakuje TIKTOK_APP_SECRET (sekret aplikacji TikTok for Business).",
          });
        }

        // redirect_uri musi DOKŁADNIE pasować do adresu zarejestrowanego w TikTok
        // Developer Console. Jeśli ustawiono TIKTOK_REDIRECT_URI, używamy go;
        // w przeciwnym razie wyliczamy callback z bieżącego origin.
        const computedRedirectUri = `${url.origin}/api/public/tiktok/callback`;
        const configuredRedirectUri = process.env.TIKTOK_REDIRECT_URI?.trim();
        const redirectUri = configuredRedirectUri || computedRedirectUri;
        if (configuredRedirectUri && configuredRedirectUri !== computedRedirectUri) {
          console.warn(
            `[tiktok start] TIKTOK_REDIRECT_URI (${configuredRedirectUri}) różni się od adresu callbacku aplikacji (${computedRedirectUri}).`,
          );
        }

        const state = `${userId}.${crypto.randomUUID()}`;

        // TikTok for Business portal auth — tylko app_id, redirect_uri, state.
        // Uprawnienia (Ads Management) ustaw w TikTok for Developers → My Apps → Marketing API.
        const authUrl = new URL("https://business-api.tiktok.com/portal/auth");
        authUrl.searchParams.set("app_id", appId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("state", state);

        console.log("[tiktok start] redirectUri:", redirectUri);

        const isSecure =
          url.protocol === "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": `tiktok_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`,
          },
        });
      },
    },
  },
});