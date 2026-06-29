import { createFileRoute } from "@tanstack/react-router";
import { oauthStartErrorResponse } from "@/lib/oauthHtml";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SCOPES_BY_SERVICE: Record<string, string[]> = {
  mail: ["openid", "profile", "email", "offline_access", "Mail.Send", "User.Read"],
  calendar: [
    "openid",
    "profile",
    "email",
    "offline_access",
    "Calendars.ReadWrite",
    "User.Read",
  ],
};

export const Route = createFileRoute("/api/public/microsoft/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const service = url.searchParams.get("service") ?? "mail";
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
        if (!SCOPES_BY_SERVICE[service]) {
          return oauthStartErrorResponse(400, {
            title: "Nieznana usługa",
            detail: `Service '${service}' nie jest wspierany.`,
          });
        }

        const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
        if (!clientId?.trim()) {
          return oauthStartErrorResponse(500, {
            title: "Połączenie z Microsoft niedostępne",
            detail: "Brak MICROSOFT_OAUTH_CLIENT_ID w konfiguracji aplikacji.",
          });
        }

        const redirectUri = `${url.origin}/api/public/microsoft/callback`;
        const state = `${userId}.${service}.${crypto.randomUUID()}`;

        const authUrl = new URL(
          "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        );
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("response_mode", "query");
        authUrl.searchParams.set("prompt", "select_account");
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("scope", SCOPES_BY_SERVICE[service].join(" "));

        const isSecure =
          url.protocol === "https:" &&
          url.hostname !== "localhost" &&
          url.hostname !== "127.0.0.1";

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": `microsoft_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`,
          },
        });
      },
    },
  },
});