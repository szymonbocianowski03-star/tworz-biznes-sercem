import { useCallback, useSyncExternalStore } from "react";

export type Product = {
  id: string;
  name: string;
  status: "setting_up" | "ready";
  visibility: "private" | "team";
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  /** Reguły wizualne marki (markdown) — agent i generacja obrazów. */
  brandVisualRules?: string;
  /** Obrazy referencyjne (data URL), max kilka — trzymane lokalnie. */
  brandVisualImages?: string[];
};

const KEY = "mn.products.v2";
const ACTIVE = "mn.activeProductId";
const LEGACY_NAMES = "mn.products";
const LEGACY_ACTIVE_NAME = "mn.activeProduct";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let cachedProducts: Product[] | null = null;
let cachedActive: string | null | undefined = undefined;
const EMPTY_PRODUCTS: Product[] = [];

function migrate(): Product[] {
  if (typeof window === "undefined") return [];
  const v2 = localStorage.getItem(KEY);
  if (v2) {
    try { return JSON.parse(v2); } catch { /* ignore */ }
  }
  const legacy = localStorage.getItem(LEGACY_NAMES);
  if (legacy) {
    try {
      const names: string[] = JSON.parse(legacy);
      const now = Date.now();
      const products: Product[] = names.map((n, i) => ({
        id: `p_${now - i}`,
        name: n,
        status: "ready",
        visibility: "private",
        createdAt: now - i * 1000,
        updatedAt: now - i * 1000,
      }));
      localStorage.setItem(KEY, JSON.stringify(products));
      return products;
    } catch { /* ignore */ }
  }
  const seed: Product[] = [{
    id: `p_${Date.now()}`, name: "Nowy Produkt", status: "ready",
    visibility: "private", createdAt: Date.now(), updatedAt: Date.now(),
  }];
  localStorage.setItem(KEY, JSON.stringify(seed));
  return seed;
}

function normalizeProduct(p: Product): Product {
  if (p.status === "setting_up" && p.thumbnail) {
    return { ...p, status: "ready" };
  }
  return p;
}

function read(): Product[] {
  if (typeof window === "undefined") return [];
  if (cachedProducts) return cachedProducts;
  const raw = localStorage.getItem(KEY);
  if (!raw) { cachedProducts = migrate().map(normalizeProduct); return cachedProducts; }
  try {
    cachedProducts = (JSON.parse(raw) as Product[]).map(normalizeProduct);
    return cachedProducts!;
  } catch {
    cachedProducts = migrate().map(normalizeProduct);
    return cachedProducts;
  }
}
function write(items: Product[]) {
  if (typeof window === "undefined") return;
  cachedProducts = items;
  localStorage.setItem(KEY, JSON.stringify(items));
  emit();
}
function readActive(): string | null {
  if (typeof window === "undefined") return null;
  if (cachedActive !== undefined) return cachedActive;
  const id = localStorage.getItem(ACTIVE);
  if (id) { cachedActive = id; return id; }
  // migrate from legacy active name
  const legacyName = localStorage.getItem(LEGACY_ACTIVE_NAME);
  const items = read();
  const match = legacyName ? items.find((p) => p.name === legacyName) : null;
  const fallback = match?.id ?? items[0]?.id ?? null;
  if (fallback) localStorage.setItem(ACTIVE, fallback);
  cachedActive = fallback;
  return fallback;
}
function writeActive(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE, id);
    const item = read().find((p) => p.id === id);
    if (item) localStorage.setItem(LEGACY_ACTIVE_NAME, item.name);
  } else {
    localStorage.removeItem(ACTIVE);
  }
  cachedActive = id;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) { cachedProducts = null; cb(); }
    else if (e.key === ACTIVE) { cachedActive = undefined; cb(); }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useProducts() {
  const products = useSyncExternalStore(subscribe, read, () => EMPTY_PRODUCTS);
  const activeId = useSyncExternalStore(subscribe, readActive, () => null);
  const active = products.find((p) => p.id === activeId) || products[0] || null;

  const create = useCallback(
    (name: string, opts?: { thumbnail?: string }): Product => {
      const item: Product = {
        id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim() || "Nowy Produkt",
        status: "ready",
        visibility: "private",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...(opts?.thumbnail ? { thumbnail: opts.thumbnail } : {}),
      };
      write([item, ...read()]);
      writeActive(item.id);
      return item;
    },
    [],
  );

  const select = useCallback((id: string) => writeActive(id), []);
  const update = useCallback((id: string, patch: Partial<Product>) => {
    write(read().map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)));
  }, []);
  const remove = useCallback((id: string) => {
    const next = read().filter((p) => p.id !== id);
    write(next);
    if (readActive() === id) writeActive(next[0]?.id ?? null);
  }, []);

  /** Udostępnia wszystkie produkty zespołowi workspace (np. po zaproszeniu członka). */
  const shareAllWithTeam = useCallback(() => {
    const now = Date.now();
    write(
      read().map((p) =>
        p.visibility === "team" ? p : { ...p, visibility: "team" as const, updatedAt: now },
      ),
    );
  }, []);

  return { products, activeId, active, create, select, update, remove, shareAllWithTeam };
}
