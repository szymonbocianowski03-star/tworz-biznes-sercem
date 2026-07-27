import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  readScopedJson,
  readScopedString,
  writeScopedJson,
  writeScopedString,
  USER_CHANGED_EVENT,
  migrateScopedJsonOnce,
  migrateScopedStringOnce,
  getScopedUserId,
} from "@/lib/userScopedStorage";
import { readActiveWorkspaceId, type TeamVisibility } from "@/lib/workspaceStorage";

export type CatalogKind = "product" | "service";

export type Product = {
  id: string;
  name: string;
  kind: CatalogKind;
  workspaceId: string;
  status: "setting_up" | "ready";
  visibility: TeamVisibility;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  brandId?: string;
  /** @deprecated — przeniesione na markę; zostawione dla migracji */
  brandVisualRules?: string;
  /** @deprecated — przeniesione na markę */
  brandVisualImages?: string[];
};

const PRODUCTS_BASE = "products.v2";
const ACTIVE_BASE = "activeProductId";
const LEGACY_NAMES = "mn.products";
const LEGACY_ACTIVE_NAME = "mn.activeProduct";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let cachedProducts: Product[] | null = null;
let cachedActive: string | null | undefined = undefined;
const EMPTY_PRODUCTS: Product[] = [];

let storageReadyScope = "";

function seedProducts(): Product[] {
  return [
    {
      id: `p_${Date.now()}`,
      name: "Nowy Produkt",
      kind: "product",
      workspaceId: readActiveWorkspaceId() ?? "legacy",
      status: "ready",
      visibility: "private",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];
}

/** Inicjalizacja poza getSnapshot — zwraca true jeśli coś zapisano. */
function initProductsStorage(): boolean {
  const scope = getScopedUserId();
  if (storageReadyScope === scope) return false;
  storageReadyScope = scope;
  cachedProducts = null;
  cachedActive = undefined;

  let changed = false;
  if (migrateScopedJsonOnce<Product[]>(PRODUCTS_BASE)) changed = true;
  if (migrateScopedStringOnce(ACTIVE_BASE)) changed = true;

  const raw = readScopedString(PRODUCTS_BASE);
  if (!raw) {
    const legacy = localStorage.getItem(LEGACY_NAMES);
    if (legacy) {
      try {
        const names: string[] = JSON.parse(legacy);
        const now = Date.now();
        const products: Product[] = names.map((n, i) => ({
          id: `p_${now - i}`,
          name: n,
          kind: "product" as const,
          workspaceId: readActiveWorkspaceId() ?? "legacy",
          status: "ready",
          visibility: "private",
          createdAt: now - i * 1000,
          updatedAt: now - i * 1000,
        }));
        writeScopedJson(PRODUCTS_BASE, products);
        changed = true;
      } catch {
        /* ignore */
      }
    }
  }

  if (!readScopedString(PRODUCTS_BASE)) {
    writeScopedJson(PRODUCTS_BASE, seedProducts());
    changed = true;
  }

  if (!readScopedString(ACTIVE_BASE)) {
    const legacyName = localStorage.getItem(LEGACY_ACTIVE_NAME);
    const items = readScopedJson<Product[]>(PRODUCTS_BASE, []);
    const match = legacyName ? items.find((p) => p.name === legacyName) : null;
    const fallback = match?.id ?? items[0]?.id ?? null;
    if (fallback) {
      writeScopedString(ACTIVE_BASE, fallback);
      changed = true;
    }
  }

  return changed;
}

function normalizeProduct(p: Product): Product {
  const base = {
    ...p,
    kind: p.kind ?? "product",
    workspaceId: p.workspaceId ?? readActiveWorkspaceId() ?? "legacy",
    visibility: p.visibility ?? "private",
  };
  if (base.status === "setting_up" && base.thumbnail) {
    return { ...base, status: "ready" };
  }
  return base;
}

function readAll(): Product[] {
  if (typeof window === "undefined") return EMPTY_PRODUCTS;
  if (cachedProducts) return cachedProducts;
  const raw = readScopedString(PRODUCTS_BASE);
  if (!raw) {
    cachedProducts = EMPTY_PRODUCTS;
    return cachedProducts;
  }
  try {
    cachedProducts = (JSON.parse(raw) as Product[]).map(normalizeProduct);
    return cachedProducts;
  } catch {
    cachedProducts = EMPTY_PRODUCTS;
    return cachedProducts;
  }
}

function readActive(): string | null {
  if (typeof window === "undefined") return null;
  if (cachedActive !== undefined) return cachedActive;
  cachedActive = readScopedString(ACTIVE_BASE);
  return cachedActive;
}

function write(items: Product[]) {
  if (typeof window === "undefined") return;
  cachedProducts = items;
  writeScopedJson(PRODUCTS_BASE, items);
  emit();
}

function writeActive(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) {
    writeScopedString(ACTIVE_BASE, id);
    const item = readAll().find((p) => p.id === id);
    if (item) localStorage.setItem(LEGACY_ACTIVE_NAME, item.name);
  } else {
    writeScopedString(ACTIVE_BASE, null);
  }
  cachedActive = id;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.includes(PRODUCTS_BASE) || e.key?.includes(ACTIVE_BASE)) {
      cachedProducts = null;
      cachedActive = undefined;
      cb();
    }
  };
  const onWs = () => {
    cachedProducts = null;
    cb();
  };
  const onUser = () => {
    storageReadyScope = "";
    cachedProducts = null;
    cachedActive = undefined;
    cb();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("mn:workspace-changed", onWs);
  window.addEventListener(USER_CHANGED_EVENT, onUser);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("mn:workspace-changed", onWs);
    window.removeEventListener(USER_CHANGED_EVENT, onUser);
  };
}

export function useProducts(workspaceId?: string | null) {
  const userScope = getScopedUserId();
  useEffect(() => {
    if (initProductsStorage()) emit();
  }, [userScope]);

  const allProducts = useSyncExternalStore(subscribe, readAll, () => EMPTY_PRODUCTS);
  const wsId = workspaceId ?? readActiveWorkspaceId();
  const products = wsId
    ? allProducts.filter((p) => p.workspaceId === wsId || p.workspaceId === "legacy")
    : allProducts;

  const activeId = useSyncExternalStore(subscribe, readActive, () => null);
  const active = products.find((p) => p.id === activeId) || products[0] || null;

  const create = useCallback(
    (
      name: string,
      opts?: { thumbnail?: string; kind?: CatalogKind; brandId?: string; workspaceId?: string },
    ): Product => {
      const kind = opts?.kind ?? "product";
      const defaultName = kind === "service" ? "Nowa usługa" : "Nowy Produkt";
      const item: Product = {
        id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim() || defaultName,
        kind,
        workspaceId: opts?.workspaceId ?? readActiveWorkspaceId() ?? "legacy",
        status: "ready",
        visibility: "private",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...(opts?.thumbnail ? { thumbnail: opts.thumbnail } : {}),
        ...(opts?.brandId ? { brandId: opts.brandId } : {}),
      };
      write([item, ...readAll()]);
      writeActive(item.id);
      return item;
    },
    [],
  );

  const select = useCallback((id: string) => writeActive(id), []);
  const update = useCallback((id: string, patch: Partial<Product>) => {
    write(readAll().map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)));
  }, []);
  const remove = useCallback((id: string) => {
    const next = readAll().filter((p) => p.id !== id);
    write(next);
    if (readActive() === id) writeActive(next[0]?.id ?? null);
  }, []);

  const shareAllWithTeam = useCallback((targetWorkspaceId?: string, brandIds?: string[]) => {
    const ws = targetWorkspaceId ?? readActiveWorkspaceId();
    if (!ws) return;
    const brandSet = brandIds ? new Set(brandIds) : null;
    const now = Date.now();
    write(
      readAll().map((p) => {
        const inWs = p.workspaceId === ws || p.workspaceId === "legacy";
        const inBrand = !brandSet || (p.brandId && brandSet.has(p.brandId));
        if (!inWs || !inBrand) return p;
        return p.visibility === "team" ? p : { ...p, visibility: "team" as const, updatedAt: now };
      }),
    );
  }, []);

  return { products, allProducts, activeId, active, create, select, update, remove, shareAllWithTeam };
}
