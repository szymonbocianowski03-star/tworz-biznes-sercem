/** Wspólny typ platform reklamowych w całej aplikacji. */
export type AdPlatform = "meta" | "linkedin" | "tiktok";

export const AD_PLATFORM_LABELS: Record<AdPlatform, string> = {
  meta: "Meta Ads",
  linkedin: "LinkedIn Ads",
  tiktok: "TikTok Ads",
};

/** Platformy widoczne w UI, ale jeszcze niedostępne do nowego łączenia / tworzenia szkiców. */
export const AD_PLATFORM_COMING_SOON = new Set<AdPlatform>(["linkedin", "tiktok"]);

export function isAdPlatformComingSoon(platform: AdPlatform): boolean {
  return AD_PLATFORM_COMING_SOON.has(platform);
}