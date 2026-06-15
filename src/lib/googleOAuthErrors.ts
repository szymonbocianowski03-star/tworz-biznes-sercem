export function friendlyGoogleOAuthError(raw: string | null | undefined): string {
  const t = (raw ?? "").toLowerCase();
  if (!t) return "Nie udało się połączyć z Google.";
  if (t.includes("redirect_uri") || t.includes("invalid_request") || t.includes("nieprawidłowe")) {
    return "Nieprawidłowy redirect URI — w Google Cloud dodaj adres /api/public/google/callback (osobny od logowania konta).";
  }
  if (t.includes("access_denied")) return "Odmówiono dostępu — zaakceptuj uprawnienia w oknie Google.";
  if (t.includes("state_mismatch")) return "Sesja OAuth wygasła — połącz kalendarz ponownie.";
  return raw ?? "Błąd połączenia z Google.";
}
