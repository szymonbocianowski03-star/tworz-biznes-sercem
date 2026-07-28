import { getLovableAppUrl } from "@/lib/lovableAppUrl";

/** Origin do startu OAuth integracji Google (Gmail / Kalendarz / Ads). */
export function getGoogleIntegrationOAuthOrigin(): string {
  if (typeof window === "undefined") return "https://marketingnow.site";

  const host = window.location.hostname.toLowerCase();

  if (host === "localhost" || host === "127.0.0.1") {
    const lovable = getLovableAppUrl();
    if (lovable) return lovable;
    return window.location.origin;
  }

  if (
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.dev")
  ) {
    return window.location.origin;
  }

  if (host === "marketingnow.site" || host === "www.marketingnow.site") {
    return "https://marketingnow.site";
  }

  return window.location.origin;
}
