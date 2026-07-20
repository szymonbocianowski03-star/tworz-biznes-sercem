import { createFileRoute } from "@tanstack/react-router";
import { oauthStartErrorResponse } from "@/lib/oauthHtml";
import {
  buildGoogleIntegrationOAuthState,
  getGoogleIntegrationOAuthRedirectUri,
  googleIntegrationRedirectHint,
  maskGoogleClientId,
  safeGoogleIntegrationReturnTo,
  validateGoogleClientId,
} from "@/lib/googleOAuthRedirect.server";
import { verifyHandoff } from "@/lib/oauthHandoff.server";

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

/** Te same reguły co przy logowaniu Google — trim + walidacja przed wysłaniem do Google. */
function readIntegrationOAuthCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export const Route = createFileRoute("/api/public/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const service = url.searchParams.get("service") ?? "gmail";
        const handoff = url.searchParams.get("handoff");
        const forceLogin = url.searchParams.get("force_login") === "1";
        const returnTo = safeGoogleIntegrationReturnTo(url.searchParams.get("return_to"), request);

        const userId = verifyHandoff(handoff);
        if (!userId) {
          return oauthStartErrorResponse(400, {
            title: "Brak sesji użytkownika",
            detail: "Odśwież stronę integracji i upewnij się, że jesteś zalogowany.",
          });
        }
        if (!SCOPES_BY_SERVICE[service]) {
          return oauthStartErrorResponse(400, {
            title: "Nieznana usługa",
            detail: `Service '${service}' nie jest wspierany.`,
          });
        }

        const creds = readIntegrationOAuthCredentials();
        const redirectUri = getGoogleIntegrationOAuthRedirectUri(request);

        if (!creds) {
          return oauthStartErrorResponse(500, {
            title: "Połączenie z Google niedostępne",
            detail: "Brak GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET w konfiguracji aplikacji (Settings → Environment).",
            hint: googleIntegrationRedirectHint(redirectUri),
          });
        }

        const clientIdError = validateGoogleClientId(creds.clientId);
        if (clientIdError) {
          console.error("[google integration start] nieprawidłowy client_id:", clientIdError);
          return oauthStartErrorResponse(500, {
            title: "Nieprawidłowy Google Client ID",
            detail: clientIdError,
            hint: "GOOGLE_OAUTH_CLIENT_ID = OAuth Client ID (…apps.googleusercontent.com). GOOGLE_OAUTH_CLIENT_SECRET = Client Secret (GOCSPX…).",
          });
        }

        const state = buildGoogleIntegrationOAuthState(userId, service as "gmail" | "calendar", returnTo);

        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", creds.clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", forceLogin ? "select_account consent" : "consent");
        authUrl.searchParams.set("include_granted_scopes", "true");
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("scope", SCOPES_BY_SERVICE[service].join(" "));

        console.log("[google integration start]", {
          service,
          redirectUri,
          clientId: maskGoogleClientId(creds.clientId),
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
