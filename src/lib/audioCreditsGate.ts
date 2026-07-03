import type { CreditsSnapshot } from "@/lib/imageCreditsGate";
import { AUDIO_CREDITS, COST_PER_AUDIO_USD_CENTS, CREDITS_PER_USD_CENT } from "@/lib/aiPricing";
import { FREE_TIER_AI_USD_CAP_CENTS } from "@/lib/plans";

export type AudioUsageEstimate = {
  creditsCost: number;
  remainingAfter: number | null;
  freeRemainingCents: number | null;
  canAfford: boolean;
  reason?: string;
};

export function getAudioUsageEstimate(credits: CreditsSnapshot | null | undefined): AudioUsageEstimate {
  const creditsCost = AUDIO_CREDITS;

  if (!credits) {
    return {
      creditsCost,
      remainingAfter: null,
      freeRemainingCents: null,
      canAfford: false,
      reason: "Zaloguj się, aby generować dźwięk.",
    };
  }

  const plan = credits.current_plan ?? "free";

  if (plan === "free") {
    const used = credits.free_ai_usage_usd_cents ?? 0;
    const freeRemainingCents = Math.max(0, FREE_TIER_AI_USD_CAP_CENTS - used);
    const canAfford = freeRemainingCents >= COST_PER_AUDIO_USD_CENTS;
    return {
      creditsCost,
      remainingAfter: canAfford
        ? Math.max(0, freeRemainingCents - COST_PER_AUDIO_USD_CENTS) * CREDITS_PER_USD_CENT
        : freeRemainingCents * CREDITS_PER_USD_CENT,
      freeRemainingCents,
      canAfford,
      reason: canAfford
        ? undefined
        : `Na planie Free dźwięk zużywa ${creditsCost} kred. Limit AI został wykorzystany — ulepsz plan.`,
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
      : `Potrzebujesz ${creditsCost} kredytów na jeden dźwięk — na koncie masz ${balance}.`,
  };
}

export function checkAudioGenerationAffordability(
  credits: CreditsSnapshot | null | undefined,
): { allowed: boolean; reason?: string } {
  const est = getAudioUsageEstimate(credits);
  return { allowed: est.canAfford, reason: est.reason };
}
