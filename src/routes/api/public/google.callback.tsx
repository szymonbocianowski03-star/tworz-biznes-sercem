import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        const redirectUri = `${url.origin}/api/public/google/callback`;

        // Diagnostyka: pełny callback URL i obecność kluczowych parametrów.
        console.log("[google callback]", {
          fullUrl: url.toString(),
          hasCode: Boolean(code),
          hasError: Boolean(error),
          error,
          errorDescription,
          redirectUri,
        });

        // Service zakodowany jest w state (userId.service.uuid) — wyciągnij go zawczasu,
        // aby błąd trafił na właściwą kartę integracji (gmail vs calendar).
        const serviceFromState = state?.split(".")[1];
        const svc = serviceFromState === "calendar" ? "calendar" : "gmail";

        if (error || !code || !state) {
          const detail =
            errorDescription ??
            error ??
            "missing_code: Google nie zwróciło parametru code. Sprawdź, czy redirect_uri jest zarejestrowany w Google Cloud Console.";
          return redirectBack(url.origin, svc, { ok: false, error: String(detail).slice(0, 200) });
        }

        const cookieHeader = request.headers.get("cookie") ?? "";
        const cookieState = cookieHeader
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("google_oauth_state="))
          ?.split("=")[1];

        if (!cookieState || cookieState !== state) {
          return redirectBack(url.origin, "gmail", { ok: false, error: "state_mismatch" });
        }

        const [userId, service] = state.split(".");
        if (!userId || (service !== "gmail" && service !== "calendar")) {
          return redirectBack(url.origin, "gmail", { ok: false, error: "bad_state" });
        }

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;

        try {
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: "authorization_code",
            }),
          });
          const tokenJson = await tokenRes.json();
          if (!tokenRes.ok) throw new Error(JSON.stringify(tokenJson));

          const accessToken: string = tokenJson.access_token;
          const refreshToken: string | undefined = tokenJson.refresh_token;
          const expiresIn: number = tokenJson.expires_in ?? 3600;
          const scope: string = tokenJson.scope ?? "";

          // Get user email
          const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const me = await meRes.json();
          const email = me.email as string;

          const baseRow = {
            user_id: userId,
            email,
            access_token: accessToken,
            token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            scope,
            ...(refreshToken ? { refresh_token: refreshToken } : {}),
          };

          const { error: upsertErr } =
            service === "gmail"
              ? await supabaseAdmin
                  .from("gmail_connections")
                  .upsert(baseRow, { onConflict: "user_id" })
              : await supabaseAdmin
                  .from("google_calendar_connections")
                  .upsert(baseRow, { onConflict: "user_id" });
          if (upsertErr) throw upsertErr;

          return redirectBack(url.origin, service, { ok: true, name: email });
        } catch (e: any) {
          console.error("[google callback]", e);
          return redirectBack(url.origin, service, { ok: false, error: String(e?.message ?? e).slice(0, 200) });
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
  const key = service === "calendar" ? "gcal" : "gmail";
  qs.set(key, params.ok ? "connected" : "error");
  if (params.name) qs.set("name", params.name);
  if (params.error) qs.set("error", params.error);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/integrations?${qs.toString()}`,
      "Set-Cookie": "google_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
    },
  });
}