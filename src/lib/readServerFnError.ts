/** Czytelny komunikat z błędu serverFn / fetch (TanStack Start czasem nie rzuca Error). */
export function readServerFnError(e: unknown, fallback = "Nieznany błąd"): string {
  if (e instanceof Error && e.message.trim()) return e.message;
  if (typeof e === "string" && e.trim()) return e;
  if (typeof e === "object" && e !== null) {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message;
    if (typeof o.statusText === "string" && o.statusText.trim()) return o.statusText;
  }
  return fallback;
}
