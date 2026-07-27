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

export type GoogleIntegrationService = "gmail" | "calendar" | "ads";

/** Parsuje state OAuth Gmail/Kalendarz/Ads: `userId.service.uuid`. */
export function parseGoogleIntegrationOAuthState(state: string | null): {
  userId: string;
  service: GoogleIntegrationService;
  returnTo?: string;
} | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length < 3) return null;
  const userId = parts[0];
  const service = parts[1];
  if (!userId || (service !== "gmail" && service !== "calendar" && service !== "ads")) return null;
  const returnTo = decodeStateReturnTo(parts[3]);
  return { userId, service, ...(returnTo ? { returnTo } : {}) };
}

export function isGoogleIntegrationOAuthState(state: string | null): boolean {
  return parseGoogleIntegrationOAuthState(state) !== null;
}

function integrationRedirectFromEnv(): string | null {
  const raw = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (raw == null) return null;
  let configured = raw.trim();
  if (
    (configured.startsWith('"') && configured.endsWith('"')) ||
    (configured.startsWith("'") && configured.endsWith("'"))
  ) {
    configured = configured.slice(1, -1).trim();
  }
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

export function buildGoogleIntegrationOAuthState(
  userId: string,
  service: GoogleIntegrationService,
  returnTo: string,
): string {
  return `${userId}.${service}.${crypto.randomUUID()}.${encodeStateReturnTo(returnTo)}`;
}

export function safeGoogleIntegrationReturnTo(raw: string | null, request: Request): string {
  const fallback = `${getRequestOrigin(request)}/integrations`;
  if (!raw) return fallback;
  try {
    const target = new URL(raw, fallback);
    if (!isAllowedIntegrationReturnHost(target.hostname)) return fallback;
    if (target.protocol !== "https:" && target.hostname !== "localhost" && target.hostname !== "127.0.0.1") {
      return fallback;
    }
    if (target.pathname !== "/integrations" && !target.pathname.startsWith("/integrations/")) {
      return fallback;
    }
    return `${target.origin}${target.pathname}${target.search}`;
  } catch {
    return fallback;
  }
}

function isAllowedIntegrationReturnHost(hostname: string): boolean {
  return (
    hostname === "marketingnow.site" ||
    hostname === "www.marketingnow.site" ||
    hostname === "tworz-biznes-sercem.lovable.app" ||
    hostname === "10fa611d-9c78-46b3-b583-d064df8ed9eb.lovableproject.com" ||
    hostname === "id-preview--10fa611d-9c78-46b3-b583-d064df8ed9eb.lovable.app" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  );
}

function encodeStateReturnTo(returnTo: string): string {
  return Buffer.from(returnTo, "utf8").toString("base64url");
}

function decodeStateReturnTo(encoded: string | undefined): string | null {
  if (!encoded) return null;
  try {
    return Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/** Maskuje client_id do logów: pierwsze 10 znaków + końcówka. */
export function maskGoogleClientId(clientId: string | undefined | null): string {
  if (!clientId) return "(brak)";
  if (clientId.length <= 20) return `${clientId.slice(0, 6)}…`;
  return `${clientId.slice(0, 10)}…${clientId.slice(-25)}`;
}

/**
 * Sprawdza, czy wartość to prawidłowy OAuth Client ID.
 * Wyłapuje pomyłki: client secret (GOCSPX), API key (AIza), pusty, redirect URI.
 */
export function validateGoogleClientId(clientId: string | undefined | null): string | null {
  const id = clientId?.trim();
  if (!id) return "client_id jest pusty — ustaw GOOGLE_OAUTH_CLIENT_ID.";
  if (id.startsWith("GOCSPX"))
    return "W GOOGLE_OAUTH_CLIENT_ID jest Client Secret (GOCSPX…) zamiast Client ID.";
  if (id.startsWith("AIza"))
    return "W GOOGLE_OAUTH_CLIENT_ID jest klucz API (AIza…) zamiast Client ID.";
  if (/^https?:\/\//i.test(id))
    return "W GOOGLE_OAUTH_CLIENT_ID jest adres URL zamiast Client ID.";
  if (!id.endsWith(".apps.googleusercontent.com"))
    return "GOOGLE_OAUTH_CLIENT_ID musi kończyć się na .apps.googleusercontent.com.";
  return null;
}

export function listGoogleOAuthRedirectUris(request: Request): string[] {
  const origin = getRequestOrigin(request);
  return [
    `${origin}/api/public/auth/google/callback`,
    `${origin}/api/public/google/callback`,
  ];
}
