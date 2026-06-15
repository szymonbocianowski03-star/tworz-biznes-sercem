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
 * Domyślnie bieżący origin żądania — musi być zarejestrowany w Google Cloud Console.
 * Nadpisz tylko gdy świadomie ustawiasz GOOGLE_OAUTH_REDIRECT_URI w env.
 */
export function getGoogleIntegrationOAuthRedirectUri(request: Request): string {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.origin}/api/public/google/callback`;
}

export function googleIntegrationRedirectHint(redirectUri: string): string {
  return `W Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs dodaj dokładnie: ${redirectUri} (to inny adres niż logowanie przez /api/public/auth/google/callback).`;
}
