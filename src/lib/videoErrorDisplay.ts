/** Krótki komunikat dla użytkownika zamiast surowego JSON z API. */
export function friendlyVideoError(detail: string | null | undefined): string {
  if (!detail?.trim()) return "Generacja nie powiodła się.";
  const d = detail.toLowerCase();
  if (d.includes("image_url") && d.includes("field required")) {
    return "Stary błąd generatora (wymagany obraz zamiast tekstu). Usuń wpis i wygeneruj ponownie — po aktualizacji aplikacji zadanie pójdzie jako tekst→wideo.";
  }
  if (d.includes("401") || d.includes("403")) {
    return "Błąd logowania do Higgsfield — administrator musi ustawić klucze API w Supabase.";
  }
  if (d.includes("brak kluczy higgsfield")) {
    return "Brak kluczy Higgsfield w chmurze — skontaktuj się z supportem lub ustaw sekrety Edge Function.";
  }
  if (detail.length > 220) return `${detail.slice(0, 220)}…`;
  return detail;
}
