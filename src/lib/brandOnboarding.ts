import { readScopedJson, writeScopedJson } from "@/lib/userScopedStorage";

const PENDING_KEY = "brandOnboarding.pending.v1";
const DONE_KEY = "brandOnboarding.done.v1";

/** Konto uznajemy za „nowe” przez 2h od utworzenia (signup / pierwszy Google). */
const NEW_ACCOUNT_WINDOW_MS = 2 * 60 * 60 * 1000;

export function markBrandOnboardingPending(userId?: string | null) {
  writeScopedJson(PENDING_KEY, true, userId);
  writeScopedJson(DONE_KEY, false, userId);
}

export function markBrandOnboardingDone(userId?: string | null) {
  writeScopedJson(PENDING_KEY, false, userId);
  writeScopedJson(DONE_KEY, true, userId);
}

export function isBrandOnboardingDone(userId?: string | null): boolean {
  return readScopedJson<boolean>(DONE_KEY, false, userId);
}

export function isBrandOnboardingPending(userId?: string | null): boolean {
  return readScopedJson<boolean>(PENDING_KEY, false, userId);
}

export function isNewAuthAccount(createdAt: string | undefined | null): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < NEW_ACCOUNT_WINDOW_MS;
}

/**
 * Czy pokazać popup: tylko nowe konta (pending z signup albo świeże created_at),
 * bez ukończonego onboardingu i bez istniejącej marki.
 */
export function shouldShowBrandOnboarding(opts: {
  userId?: string | null;
  createdAt?: string | null;
  hasBrands: boolean;
}): boolean {
  if (opts.hasBrands) return false;
  if (isBrandOnboardingDone(opts.userId)) return false;
  if (isBrandOnboardingPending(opts.userId)) return true;
  if (isNewAuthAccount(opts.createdAt)) {
    // Pierwszy raz widzimy świeże konto — oznacz pending, żeby nie zniknęło przy odświeżeniu
    markBrandOnboardingPending(opts.userId);
    return true;
  }
  return false;
}
