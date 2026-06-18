export function friendlyGoogleOAuthError(raw: string | null | undefined): string {
  const t = (raw ?? "").toLowerCase();
  if (!t) return "Nie udało się połączyć z Google.";
  // Aplikacja niezweryfikowana / scope „gmail.send" jest restricted.
  if (
    t.includes("has not completed") ||
    t.includes("verification") ||
    t.includes("unverified") ||
    t.includes("niezweryfik") ||
    t.includes("error 403") ||
    t.includes("app is blocked")
  ) {
    return "Google zablokowało połączenie, bo aplikacja nie przeszła jeszcze weryfikacji dla uprawnienia wysyłki maili (gmail.send). Dodaj swój adres e-mail jako „Test user" w Google Cloud → OAuth consent screen, albo skorzystaj z wysyłki przez Resend (poniżej).";
  }
  if (t.includes("admin_policy_enforced") || t.includes("org_internal")) {
    return "Twoja organizacja Google Workspace blokuje to uprawnienie. Poproś administratora o zgodę lub użyj prywatnego konta Gmail / klucza Resend.";
  }
  if (t.includes("redirect_uri") || t.includes("invalid_request") || t.includes("nieprawidłowe")) {
    return "Nieprawidłowy redirect URI — w Google Cloud dodaj adres /api/public/auth/google/callback (ten sam co przy logowaniu Google).";
  }
  if (t.includes("access_denied")) {
    return "Odmówiono dostępu. Jeśli zobaczyłeś ekran „Access blocked / aplikacja niezweryfikowana", to przez restricted scope gmail.send — dodaj się jako Test user w Google Cloud albo użyj Resend. Jeśli kliknąłeś „Anuluj", po prostu zaakceptuj uprawnienia w oknie Google.";
  }
  if (t.includes("state_mismatch")) return "Sesja OAuth wygasła — połącz kalendarz ponownie.";
  return raw ?? "Błąd połączenia z Google.";
}
