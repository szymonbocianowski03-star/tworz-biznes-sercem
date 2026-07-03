/** Wspólny typ platform reklamowych w całej aplikacji. */
export type AdPlatform = "meta" | "linkedin" | "tiktok";

export const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  meta: "Meta Ads",
  linkedin: "LinkedIn Ads",
  tiktok: "TikTok Ads",
};

/** Platformy widoczne w UI, ale których integracja (łączenie konta / automatyzacja) jest jeszcze niedostępna. Szkice można tworzyć dla wszystkich. */
export const AD_PLATFORM_COMING_SOON = new Set<AdPlatform>(["meta", "linkedin", "tiktok"]);

export function isAdPlatformComingSoon(platform: AdPlatform): boolean {
  return AD_PLATFORM_COMING_SOON.has(platform);
}