import { FREE_TIER_AI_USD_CAP_CENTS } from "@/lib/plans";

/** Zgłasza wszystkim aktywnym useCredits(), żeby ponownie wczytały wiersz user_credits (po zużyciu AI itd.). */
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeCreditsRefresh(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notifyCreditsRefresh(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

/** Opóźnienie daje czas na zapis zużycia w Supabase po odpowiedzi edge function (streaming + RPC). */
export function scheduleCreditsRefresh(delayMs = 1600): void {
  if (typeof window === "undefined") return;
  notifyCreditsRefresh();
  window.setTimeout(() => notifyCreditsRefresh(), delayMs);
  window.setTimeout(() => notifyCreditsRefresh(), delayMs + 2500);
}

/** Budżet kosztu API planu Free w centach USD ($1,00). */
export const FREE_AI_USAGE_BUDGET_CENTS = FREE_TIER_AI_USD_CAP_CENTS;
