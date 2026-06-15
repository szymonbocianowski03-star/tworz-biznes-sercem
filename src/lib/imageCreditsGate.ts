import {
  COST_PER_IMAGE_USD_CENTS,
  CREDITS_PER_IMAGE,
  FREE_TIER_AI_USD_CAP_CENTS,
} from "@/lib/plans";

export type CreditsSnapshot = {
  balance: number;
  current_plan: string;
  free_ai_usage_usd_cents: number | null;
};

export type ImageCreditsCheck = {
  allowed: boolean;
  maxAffordable: number;
  requested: number;
  reason?: string;
};

/** Ile grafik użytkownik może jeszcze wygenerować przy aktualnym planie i zużyciu. */
export function maxAffordableImages(credits: CreditsSnapshot | null | undefined): number {
  if (!credits) return 0;
  const plan = credits.current_plan ?? "free";
  if (plan === "free") {
    const used = credits.free_ai_usage_usd_cents ?? 0;
    const remaining = Math.max(0, FREE_TIER_AI_USD_CAP_CENTS - used);
    return Math.floor(remaining / COST_PER_IMAGE_USD_CENTS);
  }
  return Math.floor(Math.max(0, credits.balance ?? 0) / CREDITS_PER_IMAGE);
}

/** Sprawdza, czy użytkownik może wygenerować `requestedCount` grafik naraz. */
export function checkImageGenerationAffordability(
  credits: CreditsSnapshot | null | undefined,
  requestedCount: number,
): ImageCreditsCheck {
  const requested = Math.max(1, Math.floor(requestedCount));
  const maxAffordable = maxAffordableImages(credits);

  if (!credits) {
    return {
      allowed: false,
      maxAffordable: 0,
      requested,
      reason: "Zaloguj się, aby generować grafiki.",
    };
  }

  const plan = credits.current_plan ?? "free";
  const isFree = plan === "free";

  if (maxAffordable <= 0) {
    return {
      allowed: false,
      maxAffordable: 0,
      requested,
      reason: isFree
        ? "Wykorzystałeś limit planu Free ($1 na AI). Ulepsz plan, aby generować więcej grafik."
        : "Brak kredytów na koncie. Otwórz „Plan i kredyty”, aby dokupić pakiet.",
    };
  }

  if (requested > maxAffordable) {
    const graf = maxAffordable === 1 ? "grafikę" : "grafik";
    const potrzeba = requested === 1 ? "grafikę" : "grafik";
    return {
      allowed: false,
      maxAffordable,
      requested,
      reason: isFree
        ? `Na planie Free zostało Ci miejsce na max ${maxAffordable} ${graf} (limit $1 AI), a prosisz o ${requested}. Zmniejsz liczbę lub ulepsz plan.`
        : `Masz kredytów na max ${maxAffordable} ${graf}, a prosisz o ${requested} ${potrzeba}. Zmniejsz liczbę lub dokup kredyty.`,
    };
  }

  return { allowed: true, maxAffordable, requested };
}
