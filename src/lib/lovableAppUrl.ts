/** Domyślny podgląd tego projektu w Lovable (z src/routes/lovable/email/auth/preview.ts). */
const DEFAULT_LOVABLE_APP_URL = "https://tworz-biznes-sercem.lovable.app";

/** Publiczny adres podglądu Lovable (np. https://moj-projekt.lovable.app). */
export function getLovableAppUrl(): string | undefined {
  const raw =
    (import.meta.env.VITE_LOVABLE_APP_URL as string | undefined)?.trim() ||
    DEFAULT_LOVABLE_APP_URL;
  try {
    const url = new URL(raw);
    if (!url.hostname.toLowerCase().endsWith(".lovable.app")) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

/** Czy host to preview Lovable (broker /~oauth/initiate jest dostępny). */
export function isLovableHostedAuth(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return (
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovableproject.com") ||
    h === "lovable.dev" ||
    h.endsWith(".lovable.dev")
  );
}

/** Localhost może użyć brokera OAuth Lovable (sekrety zostają w chmurze Lovable). */
export function canUseLovableBrokerOnLocalhost(): boolean {
  return Boolean(getLovableAppUrl());
}
