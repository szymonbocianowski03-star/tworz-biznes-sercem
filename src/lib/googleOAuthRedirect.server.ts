/** Publiczny origin żądania (uwzględnia proxy Lovable / x-forwarded-*). */
export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    const proto = forwardedProto?.split(",")[0]?.trim() || "https";
    if (host) return `${proto}://${host}`;
  }
  return url.origin;
}

/** Parsuje state OAuth Gmail/Kalendarz: `userId.service.uuid`. */
export function parseGoogleIntegrationOAuthState(state: string | null): {
  userId: string;
  service: "gmail" | "calendar";
} | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length < 3) return null;
  const userId = parts[0];
  const service = parts[1];
  if (!userId || (service !== "gmail" && service !== "calendar")) return null;
  return { userId, service };
}

export function isGoogleIntegrationOAuthState(state: string | null): boolean {
  return parseGoogleIntegrationOAuthState(state) !== null;
}

function integrationRedirectFromEnv(): string | null {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  // Only honor it if it actually looks like a redirect URL. Guards against
  // a misconfigured secret (e.g. a client secret pasted into this field),
  // which would otherwise be sent to Google as redirect_uri and break OAuth.
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  return null;
}

/** Redirect URI logowania konta Google. */
export function getGoogleAuthOAuthRedirectUri(request: Request): string {
  const configured = integrationRedirectFromEnv();
  if (configured) return configured;
  return `${getRequestOrigin(request)}/api/public/auth/google/callback`;
}

/**
 * Redirect URI integracji Gmail / Kalendarz.
 * Domyślnie ten sam co logowanie — zwykle już jest w Google Cloud Console.
 */
export function getGoogleIntegrationOAuthRedirectUri(request: Request): string {
  return getGoogleAuthOAuthRedirectUri(request);
}

/** Legacy — osobny callback (dla kont, które mają tylko ten URI w Google Cloud). */
export function getGoogleLegacyIntegrationOAuthRedirectUri(request: Request): string {
  const configured = integrationRedirectFromEnv();
  if (configured) return configured;
  return `${getRequestOrigin(request)}/api/public/google/callback`;
}

export function googleIntegrationRedirectHint(redirectUri: string): string {
  return `W Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs dodaj dokładnie: ${redirectUri}`;
}

export function listGoogleOAuthRedirectUris(request: Request): string[] {
  const origin = getRequestOrigin(request);
  return [
    `${origin}/api/public/auth/google/callback`,
    `${origin}/api/public/google/callback`,
  ];
}
