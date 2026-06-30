import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { friendlyGoogleOAuthError } from "@/lib/googleOAuthErrors";
import {
  getRequestOrigin,
  maskGoogleClientId,
  parseGoogleIntegrationOAuthState,
} from "@/lib/googleOAuthRedirect.server";

export async function handleGoogleIntegrationOAuthCallback(
  request: Request,
  redirectUri: string,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const origin = getRequestOrigin(request);
  const parsedState = parseGoogleIntegrationOAuthState(state);
  const service = parsedState?.service ?? "gmail";

  console.log("[google integration callback]", {
    hasCode: Boolean(code),
    hasError: Boolean(error),
    error,
    errorDescription,
    redirectUri,
    service,
  });

  if (error || !code || !state) {
    const detail = friendlyGoogleOAuthError(
      errorDescription ?? error ?? "missing_code: Google nie zwróciło parametru code.",
    );
    return redirectIntegrationBack(origin, service, { ok: false, error: detail.slice(0, 240) });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieState = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("google_oauth_state="))
    ?.split("=")[1];

  if (!cookieState || cookieState !== state) {
    return redirectIntegrationBack(origin, service, {
      ok: false,
      error: friendlyGoogleOAuthError("state_mismatch"),
    });
  }

  if (!parsedState) {
    return redirectIntegrationBack(origin, service, {
      ok: false,
      error: friendlyGoogleOAuthError("bad_state"),
    });
  }

  const { userId, service: svc } = parsedState;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return redirectIntegrationBack(origin, svc, {
      ok: false,
      error: "Brak GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET w konfiguracji serwera.",
    });
  }

  console.log("[google integration callback] token exchange", {
    redirectUri,
    clientId: maskGoogleClientId(clientId),
  });

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
      svc === "gmail"
        ? await supabaseAdmin.from("gmail_connections").upsert(baseRow, { onConflict: "user_id" })
        : await supabaseAdmin.from("google_calendar_connections").upsert(baseRow, { onConflict: "user_id" });
    if (upsertErr) throw upsertErr;

    return redirectIntegrationBack(origin, svc, { ok: true, name: email });
  } catch (e: unknown) {
    console.error("[google integration callback]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return redirectIntegrationBack(origin, svc, {
      ok: false,
      error: friendlyGoogleOAuthError(msg).slice(0, 240),
    });
  }
}

function redirectIntegrationBack(
  origin: string,
  service: string,
  params: { ok: boolean; name?: string; error?: string },
): Response {
  const qs = new URLSearchParams();
  const key = service === "calendar" ? "gcal" : "gmail";
  qs.set(key, params.ok ? "connected" : "error");
  if (params.name) qs.set("name", params.name);
  if (params.error) qs.set("error", params.error);

  const isSecure = origin.startsWith("https://");

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/integrations?${qs.toString()}`,
      "Set-Cookie": `google_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}`,
    },
  });
}
