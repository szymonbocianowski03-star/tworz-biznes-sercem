import type { CreditsSnapshot } from "@/lib/imageCreditsGate";
import { COST_PER_VIDEO_USD_CENTS, CREDITS_PER_USD_CENT, VIDEO_CREDITS } from "@/lib/aiPricing";
import { FREE_TIER_AI_USD_CAP_CENTS } from "@/lib/plans";

export type VideoUsageEstimate = {
  creditsCost: number;
  /** Saldo / limit po udanej generacji (w kredytach widocznych w UI). */
  remainingAfter: number | null;
  /** Plan Free: pozostały limit w centach USD. */
  freeRemainingCents: number | null;
  canAfford: boolean;
  reason?: string;
};

export function getVideoUsageEstimate(credits: CreditsSnapshot | null | undefined): VideoUsageEstimate {
  const creditsCost = VIDEO_CREDITS;

  if (!credits) {
    return {
      creditsCost,
      remainingAfter: null,
      freeRemainingCents: null,
      canAfford: false,
      reason: "Zaloguj się, aby generować wideo.",
    };
  }

  const plan = credits.current_plan ?? "free";

  if (plan === "free") {
    const used = credits.free_ai_usage_usd_cents ?? 0;
    const freeRemainingCents = Math.max(0, FREE_TIER_AI_USD_CAP_CENTS - used);
    const canAfford = freeRemainingCents >= COST_PER_VIDEO_USD_CENTS;
    return {
      creditsCost,
      remainingAfter: canAfford
        ? Math.max(0, freeRemainingCents - COST_PER_VIDEO_USD_CENTS) * CREDITS_PER_USD_CENT
        : freeRemainingCents * CREDITS_PER_USD_CENT,
      freeRemainingCents,
      canAfford,
      reason: canAfford
        ? undefined
        : "Na planie Free wideo zużywa cały limit AI (400 kred.). Wykorzystałeś go lub zostało za mało — ulepsz plan.",
    };
  }

  const balance = Math.max(0, credits.balance ?? 0);
  const canAfford = balance >= creditsCost;
  return {
    creditsCost,
    remainingAfter: canAfford ? balance - creditsCost : balance,
    freeRemainingCents: null,
    canAfford,
    reason: canAfford
      ? undefined
      : `Potrzebujesz ${creditsCost} kredytów na jedno wideo — na koncie masz ${balance}.`,
  };
}

export function checkVideoGenerationAffordability(
  credits: CreditsSnapshot | null | undefined,
): { allowed: boolean; reason?: string } {
  const est = getVideoUsageEstimate(credits);
  return { allowed: est.canAfford, reason: est.reason };
}
