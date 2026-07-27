/** Ścieżki dostępne bez zalogowania (reszta wymaga konta). */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/auth") return true;
  if (pathname === "/reset-password") return true;
  if (pathname === "/billing") return true;
  if (pathname === "/regulamin") return true;
  if (pathname === "/polityka-prywatnosci") return true;
  if (pathname === "/checkout" || pathname === "/checkout/return") return true;
  if (pathname === "/billingsuccessful") return true;
  if (pathname === "/usuwanie-danych") return true;
  if (pathname === "/program-partnerski") return true;
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname.startsWith("/lovable/")) return true;
  return false;
}
