import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { signHandoff } from "@/lib/oauthHandoff.server";

/**
 * Exchange a Supabase access token (sent in the Authorization header, not the URL)
 * for a short-lived HMAC-signed handoff nonce. The nonce is then safe to pass as a
 * query parameter to /api/public/{provider}/start without leaking the long-lived
 * access token to server logs, proxy logs, or browser history.
 */
export const Route = createFileRoute("/api/public/oauth/handoff")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const m = /^Bearer\s+(.+)$/i.exec(auth);
        const token = m?.[1]?.trim();
        if (!token) {
          return new Response(JSON.stringify({ error: "missing_token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data?.user) {
          return new Response(JSON.stringify({ error: "invalid_session" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const handoff = signHandoff(data.user.id);
        return new Response(JSON.stringify({ handoff }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      },
    },
  },
});