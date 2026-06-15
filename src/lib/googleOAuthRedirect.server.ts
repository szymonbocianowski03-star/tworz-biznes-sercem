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

/**
 * Redirect URI dla integracji Gmail / Google Calendar.
 * Musi być identyczny w Google Cloud Console (Authorized redirect URIs).
 */
export function getGoogleIntegrationOAuthRedirectUri(request: Request): string {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;

  const url = new URL(request.url);
  const publicBase =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.VITE_LOVABLE_APP_URL?.trim() ||
    process.env.LOVABLE_APP_URL?.trim();

  if (publicBase) {
    try {
      return `${new URL(publicBase).origin}/api/public/google/callback`;
    } catch {
      /* fall through */
    }
  }

  return `${url.origin}/api/public/google/callback`;
}

export function googleIntegrationRedirectHint(redirectUri: string): string {
  return `W Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs dodaj dokładnie: ${redirectUri} (to inny adres niż logowanie przez /api/public/auth/google/callback).`;
}
