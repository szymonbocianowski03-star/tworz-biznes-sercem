import { createFileRoute } from "@tanstack/react-router";
import {
  buildAuthSessionRedirect,
  createSupabaseSessionForGoogleUser,
} from "@/lib/googleLoginSession.server";

export const Route = createFileRoute("/api/public/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        const redirectUri = `${url.origin}/api/public/auth/google/callback`;

        const redirectPath = parseRedirectPathFromCookie(request.headers.get("cookie"));
        const authPath = redirectPath ?? "/auth";

        if (error || !code || !state) {
          const detail =
            errorDescription ??
            error ??
            "Google nie zwróciło kodu autoryzacji. Sprawdź redirect URI w Google Cloud Console.";
          return redirectAuthError(url.origin, authPath, String(detail).slice(0, 200));
        }

        const cookieHeader = request.headers.get("cookie") ?? "";
        const cookieState = cookieHeader
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("google_auth_state="))
          ?.split("=")[1];

        if (!cookieState || cookieState !== state || !state.startsWith("auth.")) {
          return redirectAuthError(url.origin, authPath, "state_mismatch");
        }

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
        if (!clientId || !clientSecret) {
          return redirectAuthError(
            url.origin,
            authPath,
            "Brak GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET w .env",
          );
        }

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
          const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const me = await meRes.json();
          if (!meRes.ok) throw new Error(JSON.stringify(me));

          const email = me.email as string | undefined;
          if (!email) throw new Error("Google nie zwróciło adresu email dla tego konta.");

          const session = await createSupabaseSessionForGoogleUser({
            email,
            fullName: (me.name as string | undefined) ?? undefined,
            avatarUrl: (me.picture as string | undefined) ?? undefined,
            googleSub: (me.sub as string | undefined) ?? undefined,
          });

          const location = buildAuthSessionRedirect(url.origin, authPath, session);
          return new Response(null, {
            status: 302,
            headers: {
              Location: location,
              "Set-Cookie": [
                "google_auth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
                "google_auth_redirect=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
              ],
            },
          });
        } catch (e: unknown) {
          console.error("[google auth callback]", e);
          const message = e instanceof Error ? e.message : String(e);
          return redirectAuthError(url.origin, authPath, message.slice(0, 200));
        }
      },
    },
  },
});

function parseRedirectPathFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return "/auth";
  const raw = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("google_auth_redirect="))
    ?.split("=")
    .slice(1)
    .join("=");
  if (!raw) return "/auth";
  try {
    const path = decodeURIComponent(raw);
    if (path.startsWith("/") && !path.startsWith("//")) return path;
  } catch {
    /* ignore */
  }
  return "/auth";
}

function redirectAuthError(origin: string, redirectPath: string, error: string): Response {
  const safePath = redirectPath.startsWith("/") ? redirectPath : "/auth";
  const qs = new URLSearchParams({ error: "google_auth_failed", error_description: error });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}${safePath}?${qs.toString()}`,
      "Set-Cookie": [
        "google_auth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
        "google_auth_redirect=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
      ],
    },
  });
}
