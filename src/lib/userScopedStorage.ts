/** Izolacja danych localStorage per konto użytkownika Supabase. */

export const LOCAL_DATA_OWNER_KEY = "mn.localDataOwner";
const GUEST_SCOPE = "guest";

/** Zdarzenie po zmianie zalogowanego użytkownika — hooki invalidują cache. */
export const USER_CHANGED_EVENT = "mn:user-changed";

export function getScopedUserId(): string {
  if (typeof window === "undefined") return GUEST_SCOPE;
  return localStorage.getItem(LOCAL_DATA_OWNER_KEY) ?? GUEST_SCOPE;
}

/** Klucz localStorage unikalny dla użytkownika, np. mn.u.<id>.products.v2 */
export function userScopedKey(baseKey: string, userId?: string | null): string {
  const scope = userId ?? getScopedUserId();
  const safe = scope.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `mn.u.${safe}.${baseKey}`;
}

export function readScopedJson<T>(baseKey: string, fallback: T, userId?: string | null): T {
  if (typeof window === "undefined") return fallback;
  const scoped = userScopedKey(baseKey, userId);
  try {
    const raw = localStorage.getItem(scoped);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Migracja legacy → scoped — tylko z useEffect, nie z getSnapshot. */
export function migrateScopedJsonOnce<T>(baseKey: string, userId?: string | null): T | null {
  if (typeof window === "undefined") return null;
  const scoped = userScopedKey(baseKey, userId);
  if (localStorage.getItem(scoped)) return null;
  for (const legacyKey of [baseKey, `mn.${baseKey}`]) {
    try {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) {
        localStorage.setItem(scoped, legacy);
        return JSON.parse(legacy) as T;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function migrateScopedStringOnce(baseKey: string, userId?: string | null): string | null {
  if (typeof window === "undefined") return null;
  const scoped = userScopedKey(baseKey, userId);
  if (localStorage.getItem(scoped)) return null;
  for (const legacyKey of [baseKey, `mn.${baseKey}`]) {
    const legacy = localStorage.getItem(legacyKey);
    if (legacy !== null) {
      localStorage.setItem(scoped, legacy);
      return legacy;
    }
  }
  return null;
}

export function writeScopedJson(baseKey: string, value: unknown, userId?: string | null): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(userScopedKey(baseKey, userId), JSON.stringify(value));
}

export function readScopedString(baseKey: string, userId?: string | null): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(userScopedKey(baseKey, userId));
}

export function writeScopedString(baseKey: string, value: string | null, userId?: string | null): void {
  if (typeof window === "undefined") return;
  const scoped = userScopedKey(baseKey, userId);
  if (value === null) localStorage.removeItem(scoped);
  else localStorage.setItem(scoped, value);
}

export function notifyUserChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(USER_CHANGED_EVENT));
}

/**
 * Przełącza aktywnego właściciela danych lokalnych.
 * NIE kasuje danych innych kont — każde konto ma własny namespace w localStorage.
 */
export function syncLocalDataOwner(userId: string | null): void {
  if (typeof window === "undefined") return;

  const next = userId ?? GUEST_SCOPE;
  const prev = localStorage.getItem(LOCAL_DATA_OWNER_KEY);
  if (prev === next) return;

  localStorage.setItem(LOCAL_DATA_OWNER_KEY, next);
  notifyUserChanged();
}

/** @deprecated Stare czyszczenie — tylko gdy użytkownik wyraźnie resetuje dane */
export function clearAppLocalDataForUser(userId?: string | null): void {
  if (typeof window === "undefined") return;
  const scope = userId ?? getScopedUserId();
  const prefix = `mn.u.${scope.replace(/[^a-zA-Z0-9_-]/g, "_")}.`;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  notifyUserChanged();
}
