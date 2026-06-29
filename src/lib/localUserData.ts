// Dane aplikacji trzymane w localStorage (czaty, produkty, profil agenta, skille itd.)
// używają prefiksu "mn." i NIE są powiązane z kontem. Bez czyszczenia nowy użytkownik
// zalogowany w tej samej przeglądarce widziałby dane (np. grafiki w czatach) poprzedniego konta.
// Token sesji Supabase ma prefiks "sb-" i nie jest tu ruszany.

const APP_PREFIX = "mn.";
const OWNER_KEY = "mn.localDataOwner";

/** Usuwa wszystkie lokalne dane aplikacji (klucze "mn."), zachowując znacznik właściciela. */
export function clearAppLocalData(): void {
  if (typeof window === "undefined") return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(APP_PREFIX) && k !== OWNER_KEY) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

/**
 * Pilnuje, by lokalne dane należały do aktualnie zalogowanego użytkownika.
 * Gdy zaloguje się inne konto niż poprzednio zapisane — czyści dane i przeładowuje stronę,
 * żeby zresetować też cache trzymany w pamięci modułów (np. useChats).
 */
export function syncLocalDataOwner(userId: string | null): void {
  if (typeof window === "undefined") return;
  if (!userId) return; // wylogowanie: czekamy na nowego użytkownika, nic nie kasujemy

  const prev = localStorage.getItem(OWNER_KEY);
  if (prev === userId) return;

  if (prev && prev !== userId) {
    clearAppLocalData();
    localStorage.setItem(OWNER_KEY, userId);
    window.location.reload();
    return;
  }

  // Pierwszy zapis właściciela (brak poprzedniego) — bez czyszczenia i bez przeładowania.
  localStorage.setItem(OWNER_KEY, userId);
}
