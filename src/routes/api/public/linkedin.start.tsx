import { createFileRoute } from "@tanstack/react-router";
import { oauthStartErrorResponse } from "@/lib/oauthHtml";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SCOPES = [
  "r_ads",
  "r_ads_reporting",
  "rw_ads",
  "r_organization_social",
  "w_organization_social",
  "r_basicprofile",
].join(" ");

export const Route = createFileRoute("/api/public/linkedin/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
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

        const clientId = process.env.LINKEDIN_CLIENT_ID;
        if (!clientId?.trim()) {
          return oauthStartErrorResponse(500, {
            title: "Połączenie z LinkedIn niedostępne",
            detail:
              "Integracja LinkedIn nie jest jeszcze włączona w tej instalacji aplikacji. Spróbuj ponownie później lub skontaktuj się z supportem.",
          });
        }

        const redirectUri = `${url.origin}/api/public/linkedin/callback`;
        const state = `${userId}.${crypto.randomUUID()}`;

        const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("scope", SCOPES);
        if (forceLogin) authUrl.searchParams.set("prompt", "login");

        const isSecure =
          url.protocol === "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": `linkedin_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`,
          },
        });
      },
    },
  },
});
