import { createFileRoute } from "@tanstack/react-router";
import { oauthStartErrorResponse } from "@/lib/oauthHtml";
import {
  getGoogleIntegrationOAuthRedirectUri,
  googleIntegrationRedirectHint,
  maskGoogleClientId,
  validateGoogleClientId,
} from "@/lib/googleOAuthRedirect.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SCOPES_BY_SERVICE: Record<string, string[]> = {
  gmail: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.send",
  ],
  calendar: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar",
  ],
};

export const Route = createFileRoute("/api/public/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const service = url.searchParams.get("service") ?? "gmail";
        const token = url.searchParams.get("token");
        const forceLogin = url.searchParams.get("force_login") === "1";

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
        if (!SCOPES_BY_SERVICE[service]) {
          return oauthStartErrorResponse(400, {
            title: "Nieznana usługa",
            detail: `Service '${service}' nie jest wspierany.`,
          });
        }

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        if (!clientId?.trim()) {
          const redirectUri = getGoogleIntegrationOAuthRedirectUri(request);
          return oauthStartErrorResponse(500, {
            title: "Połączenie z Google niedostępne",
            detail: "Brak GOOGLE_OAUTH_CLIENT_ID w konfiguracji aplikacji (Settings → Environment).",
            hint: googleIntegrationRedirectHint(redirectUri),
          });
        }
        if (!process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()) {
          return oauthStartErrorResponse(500, {
            title: "Połączenie z Google niedostępne",
            detail: "Brak GOOGLE_OAUTH_CLIENT_SECRET w konfiguracji aplikacji.",
          });
        }

        const clientIdError = validateGoogleClientId(clientId);
        if (clientIdError) {
          console.error("[google start] nieprawidłowy client_id:", clientIdError);
          return oauthStartErrorResponse(500, {
            title: "Nieprawidłowy Google Client ID",
            detail: clientIdError,
            hint: "GOOGLE_OAUTH_CLIENT_ID = OAuth Client ID (…apps.googleusercontent.com). GOOGLE_OAUTH_CLIENT_SECRET = Client Secret (GOCSPX…).",
          });
        }

        const redirectUri = getGoogleIntegrationOAuthRedirectUri(request);
        const state = `${userId}.${service}.${crypto.randomUUID()}`;

        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", forceLogin ? "select_account consent" : "consent");
        authUrl.searchParams.set("include_granted_scopes", "true");
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("scope", SCOPES_BY_SERVICE[service].join(" "));

        console.log("[google start]", {
          service,
          redirectUri,
          clientId: maskGoogleClientId(clientId),
          scopes: SCOPES_BY_SERVICE[service],
        });

        const isSecure =
          url.protocol === "https:" &&
          url.hostname !== "localhost" &&
          url.hostname !== "127.0.0.1";

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": `google_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`,
          },
        });
      },
    },
  },
});
