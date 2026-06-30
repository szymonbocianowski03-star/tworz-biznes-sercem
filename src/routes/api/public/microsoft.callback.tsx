import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/microsoft/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error || !code || !state) {
          return redirectBack(url.origin, "mail", { ok: false, error: error ?? "missing_code" });
        }

        const cookieHeader = request.headers.get("cookie") ?? "";
        const cookieState = cookieHeader
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("microsoft_oauth_state="))
          ?.split("=")[1];

        if (!cookieState || cookieState !== state) {
          return redirectBack(url.origin, "mail", { ok: false, error: "state_mismatch" });
        }

        const [userId, service] = state.split(".");
        if (!userId || (service !== "mail" && service !== "calendar")) {
          return redirectBack(url.origin, "mail", { ok: false, error: "bad_state" });
        }

        const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID!;
        const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET!;
        const redirectUri = `${url.origin}/api/public/microsoft/callback`;

        try {
          const tokenRes = await fetch(
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
              }),
            },
          );
          const tokenJson = await tokenRes.json();
          if (!tokenRes.ok) throw new Error(JSON.stringify(tokenJson));

          const accessToken: string = tokenJson.access_token;
          const refreshToken: string | undefined = tokenJson.refresh_token;
          const expiresIn: number = tokenJson.expires_in ?? 3600;
          const scope: string = tokenJson.scope ?? "";

          const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const me = await meRes.json();
          const email = (me.mail ?? me.userPrincipalName) as string;

          const baseRow = {
            user_id: userId,
            email,
            access_token: accessToken,
            token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            scope,
            ...(refreshToken ? { refresh_token: refreshToken } : {}),
          };

          const { error: upsertErr } =
            service === "mail"
              ? await supabaseAdmin
                  .from("outlook_connections")
                  .upsert(baseRow, { onConflict: "user_id" })
              : await supabaseAdmin
                  .from("outlook_calendar_connections")
                  .upsert(baseRow, { onConflict: "user_id" });
          if (upsertErr) throw upsertErr;

          return redirectBack(url.origin, service, { ok: true, name: email });
        } catch (e: any) {
          console.error("[microsoft callback]", e);
          return redirectBack(url.origin, service, {
            ok: false,
            error: String(e?.message ?? e).slice(0, 200),
          });
        }
      },
    },
  },
});

function redirectBack(
  origin: string,
  service: string,
  params: { ok: boolean; name?: string; error?: string },
) {
  const qs = new URLSearchParams();
  const key = service === "calendar" ? "outcal" : "outlook";
  qs.set(key, params.ok ? "connected" : "error");
  if (params.name) qs.set("name", params.name);
  if (params.error) qs.set("error", params.error);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/integrations?${qs.toString()}`,
      "Set-Cookie": "microsoft_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
    },
  });
}