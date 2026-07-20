import { createFileRoute } from "@tanstack/react-router";
import { oauthStartErrorResponse } from "@/lib/oauthHtml";
import { verifyHandoff } from "@/lib/oauthHandoff.server";

const SCOPES = [
  "public_profile",
  "ads_read",
  "ads_management",
  "business_management",
  "pages_show_list",
].join(",");

export const Route = createFileRoute("/api/public/meta/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const handoff = url.searchParams.get("handoff");
        const userId = verifyHandoff(handoff);
        if (!userId) {
          return oauthStartErrorResponse(400, {
            title: "Brak sesji użytkownika",
            detail: "Odśwież stronę integracji i upewnij się, że jesteś zalogowany.",
          });
        }

        const appId = process.env.META_APP_ID;
        if (!appId?.trim()) {
          return oauthStartErrorResponse(500, {
            title: "Połączenie z Meta niedostępne",
            detail:
              "Integracja Meta nie jest jeszcze włączona w tej instalacji aplikacji. Spróbuj ponownie później lub skontaktuj się z supportem.",
          });
        }

        const redirectUri = `${url.origin}/api/public/meta/callback`;
        const state = `${userId}.${crypto.randomUUID()}`;

        const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
        authUrl.searchParams.set("client_id", appId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("scope", SCOPES);
        authUrl.searchParams.set("response_type", "code");

        // Diagnostyka: finalny scope i pełny Meta OAuth URL (bez pages_manage_ads).
        console.log("[meta start] scope:", SCOPES);
        console.log("[meta start] redirectUri:", redirectUri);
        console.log("[meta start] authUrl:", authUrl.toString());

        const isSecure =
          url.protocol === "https:" &&
          url.hostname !== "localhost" &&
          url.hostname !== "127.0.0.1";

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl.toString(),
            "Set-Cookie": `meta_oauth_state=${state}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`,
          },
        });
      },
    },
  },
});
