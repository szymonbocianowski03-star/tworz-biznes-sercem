import { createFileRoute } from "@tanstack/react-router";
import { isLocalGoogleAuthConfigured } from "@/lib/googleAuthEnv.server";
import { oauthStartErrorResponse } from "@/lib/oauthHtml";

const AUTH_SCOPES = ["openid", "email", "profile"];

export const Route = createFileRoute("/api/public/auth/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirectTo = sanitizeRedirectPath(url.searchParams.get("redirect_to"));

        if (!isLocalGoogleAuthConfigured()) {
          return oauthStartErrorResponse(500, {
            title: "Logowanie Google na localhost wymaga lokalnego .env",
            detail:
              "Zmienne z Lovable (Settings → Environment) działają tylko na podglądzie *.lovable.app — nie trafiają automatycznie do localhost.",
            hint:
              "Skopiuj z Lovable do pliku .env w folderze projektu: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY. W Google Cloud dodaj redirect URI: http://localhost:8080/api/public/auth/google/callback. Zrestartuj npm run dev. Alternatywa: testuj logowanie na adresie podglądu Lovable.",
          });
        }

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!.trim();

        const redirectUri = `${url.origin}/api/public/auth/google/callback`;
        const state = `auth.${crypto.randomUUID()}`;

        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("access_type", "online");
        authUrl.searchParams.set("prompt", "select_account");
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("scope", AUTH_SCOPES.join(" "));

        const isSecure =
          url.protocol === "https:" &&
          url.hostname !== "localhost" &&
          url.hostname !== "127.0.0.1";

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": [
              `google_auth_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`,
              `google_auth_redirect=${encodeURIComponent(redirectTo)}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`,
            ],
          },
        });
      },
    },
  },
});

function sanitizeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/auth";
  return raw;
}
