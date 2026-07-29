/**
 * Wspólna wersja Google Ads API dla całej aplikacji (listowanie kont + publikacja).
 * v21 jest wygaszane (sunset ~sierpień 2026), więc używamy bieżącej wersji.
 * Aktualizuj tutaj — zmiana obejmie wszystkie wywołania.
 */
export const GOOGLE_ADS_API_VERSION = "v25";

export const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
