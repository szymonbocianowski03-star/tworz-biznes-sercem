import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  readScopedJson,
  writeScopedJson,
  USER_CHANGED_EVENT,
  migrateScopedJsonOnce,
  getScopedUserId,
} from "@/lib/userScopedStorage";
import { readActiveWorkspaceId, type TeamVisibility } from "@/lib/workspaceStorage";

export type BrandAiContext = {
  summary: string;
  industry?: string;
  targetAudience?: string;
  valueProposition?: string;
  scrapedAt: number;
  sourceUrl: string;
  pageTitle?: string;
  pageDescription?: string;
  rawMarkdown?: string;
};

export type Brand = {
  id: string;
  name: string;
  workspaceId: string;
  visibility: TeamVisibility;
  websiteUrl?: string;
  aiContext?: BrandAiContext;
  /** Reguły wizualne marki (markdown) — agent i generacja obrazów. */
  brandVisualRules?: string;
  /** Obrazy referencyjne (data URL), max kilka — trzymane lokalnie. */
  brandVisualImages?: string[];
  createdAt: number;
  updatedAt: number;
};

const BRANDS_BASE = "brands.v1";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let cachedBrands: Brand[] | null = null;
const EMPTY_BRANDS: Brand[] = [];
let storageReadyScope = "";

function initBrandsStorage(): boolean {
  const scope = getScopedUserId();
  if (storageReadyScope === scope) return false;
  storageReadyScope = scope;
  cachedBrands = null;
  return migrateScopedJsonOnce<Brand[]>(BRANDS_BASE) !== null;
}

function normalizeBrand(b: Brand): Brand {
  return {
    ...b,
    workspaceId: b.workspaceId ?? "legacy",
    visibility: b.visibility ?? "private",
  };
}

function readAll(): Brand[] {
  if (typeof window === "undefined") return [];
  if (cachedBrands) return cachedBrands;
  cachedBrands = readScopedJson<Brand[]>(BRANDS_BASE, []).map(normalizeBrand);
  return cachedBrands;
}

function write(items: Brand[]) {
  if (typeof window === "undefined") return;
  cachedBrands = items;
  writeScopedJson(BRANDS_BASE, items);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.includes(BRANDS_BASE)) {
      cachedBrands = null;
      cb();
    }
  };
  const onWs = () => {
    cachedBrands = null;
    cb();
  };
  const onUser = () => {
    storageReadyScope = "";
    cachedBrands = null;
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

export function formatBrandContextForAgent(brand: Brand): string {
  const ctx = brand.aiContext;
  if (!ctx?.summary?.trim()) return "";
  const lines = [
    `Marka: ${brand.name}`,
    brand.websiteUrl ? `Strona: ${brand.websiteUrl}` : null,
    ctx.pageTitle ? `Tytuł strony: ${ctx.pageTitle}` : null,
    ctx.industry ? `Branża: ${ctx.industry}` : null,
    ctx.targetAudience ? `Grupa docelowa: ${ctx.targetAudience}` : null,
    ctx.valueProposition ? `Propozycja wartości: ${ctx.valueProposition}` : null,
    "",
    ctx.summary,
  ].filter((l) => l !== null && l !== undefined);
  if (ctx.rawMarkdown?.trim()) {
    lines.push("", "### Szczegóły ze strony", ctx.rawMarkdown.trim().slice(0, 4000));
  }
  return lines.join("\n");
}

export function useBrands(workspaceId?: string | null) {
  const userScope = getScopedUserId();
  useEffect(() => {
    if (initBrandsStorage()) emit();
  }, [userScope]);

  const allBrands = useSyncExternalStore(subscribe, readAll, () => EMPTY_BRANDS);
  const wsId = workspaceId ?? readActiveWorkspaceId();
  const brands = wsId ? allBrands.filter((b) => b.workspaceId === wsId || b.workspaceId === "legacy") : allBrands;

  const create = useCallback(
    (name: string, opts?: { websiteUrl?: string; workspaceId?: string }): Brand => {
      const targetWs = opts?.workspaceId ?? readActiveWorkspaceId() ?? "legacy";
      const item: Brand = {
        id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim() || "Nowa marka",
        workspaceId: targetWs,
        visibility: "private",
        ...(opts?.websiteUrl?.trim() ? { websiteUrl: opts.websiteUrl.trim() } : {}),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      write([item, ...readAll()]);
      return item;
    },
    [],
  );

  const update = useCallback((id: string, patch: Partial<Brand>) => {
    write(readAll().map((b) => (b.id === id ? { ...b, ...patch, updatedAt: Date.now() } : b)));
  }, []);

  const remove = useCallback((id: string) => {
    write(readAll().filter((b) => b.id !== id));
  }, []);

  const getById = useCallback((id: string | undefined | null): Brand | null => {
    if (!id) return null;
    return readAll().find((b) => b.id === id) ?? null;
  }, []);

  const updateAiContext = useCallback((id: string, patch: Partial<BrandAiContext>) => {
    write(
      readAll().map((b) => {
        if (b.id !== id) return b;
        const prev = b.aiContext ?? {
          summary: "",
          scrapedAt: Date.now(),
          sourceUrl: b.websiteUrl ?? "",
        };
        return {
          ...b,
          aiContext: { ...prev, ...patch, scrapedAt: patch.scrapedAt ?? prev.scrapedAt },
          updatedAt: Date.now(),
        };
      }),
    );
  }, []);

  /** Udostępnia wszystkie marki workspace zespołowi. */
  const shareAllWithTeam = useCallback((targetWorkspaceId?: string) => {
    const ws = targetWorkspaceId ?? readActiveWorkspaceId();
    if (!ws) return;
    const now = Date.now();
    write(
      readAll().map((b) =>
        b.workspaceId === ws || b.workspaceId === "legacy"
          ? { ...b, visibility: "team" as const, updatedAt: now }
          : b,
      ),
    );
  }, []);

  return { brands, allBrands, create, update, updateAiContext, remove, getById, shareAllWithTeam };
}
