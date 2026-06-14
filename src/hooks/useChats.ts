import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Chat = {
  id: string;
  title: string;
  product: string;
  createdAt: number;
  updatedAt: number;
  messages: { role: "user" | "assistant"; content: string }[];
};

export type TrashedChat = Chat & { deletedAt: number };

export const CHAT_TRASH_RETENTION_DAYS = 30;
export const CHAT_TRASH_RETENTION_MS = CHAT_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const STORE_KEY = "mn.chats.v1";
const TRASH_KEY = "mn.chats.trash.v1";
const ACTIVE_KEY = "mn.activeChat";

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

let cachedChats: Chat[] | null = null;
let cachedTrash: TrashedChat[] | null = null;

function read(): Chat[] {
  if (typeof window === "undefined") return [];
  if (cachedChats) return cachedChats;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    cachedChats = raw ? JSON.parse(raw) : [];
    return cachedChats!;
  } catch {
    cachedChats = [];
    return cachedChats;
  }
}

function write(chats: Chat[]) {
  if (typeof window === "undefined") return;
  cachedChats = chats;
  localStorage.setItem(STORE_KEY, JSON.stringify(chats));
  emit();
}

function purgeExpiredTrash(items: TrashedChat[]): TrashedChat[] {
  const cutoff = Date.now() - CHAT_TRASH_RETENTION_MS;
  return items.filter((c) => c.deletedAt >= cutoff);
}

function readTrash(): TrashedChat[] {
  if (typeof window === "undefined") return [];
  if (cachedTrash) return cachedTrash;
  try {
    const raw = localStorage.getItem(TRASH_KEY);
    const parsed: TrashedChat[] = raw ? JSON.parse(raw) : [];
    const kept = purgeExpiredTrash(parsed);
    if (kept.length !== parsed.length) {
      cachedTrash = kept;
      localStorage.setItem(TRASH_KEY, JSON.stringify(kept));
    } else {
      cachedTrash = parsed;
    }
    return cachedTrash;
  } catch {
    cachedTrash = [];
    return cachedTrash;
  }
}

function writeTrash(items: TrashedChat[]) {
  if (typeof window === "undefined") return;
  const kept = purgeExpiredTrash(items);
  cachedTrash = kept;
  localStorage.setItem(TRASH_KEY, JSON.stringify(kept));
  emit();
}

function readActive(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

function writeActive(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORE_KEY) {
      cachedChats = null;
      cb();
    } else if (e.key === TRASH_KEY) {
      cachedTrash = null;
      cb();
    } else if (e.key === ACTIVE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function daysUntilPermanentDelete(deletedAt: number): number {
  const expiresAt = deletedAt + CHAT_TRASH_RETENTION_MS;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function useChats(product?: string) {
  const all = useSyncExternalStore(subscribe, read, () => []);
  const allTrash = useSyncExternalStore(subscribe, readTrash, () => []);
  const activeId = useSyncExternalStore(subscribe, readActive, () => null);

  const chats = product ? all.filter((c) => c.product === product) : all;
  const trash = product ? allTrash.filter((c) => c.product === product) : allTrash;
  const active = chats.find((c) => c.id === activeId) || null;

  const create = useCallback((productName: string): Chat => {
    const chat: Chat = {
      id: `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      title: "Nowy czat",
      product: productName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    write([chat, ...read()]);
    writeActive(chat.id);
    return chat;
  }, []);

  const select = useCallback((id: string) => writeActive(id), []);

  const update = useCallback((id: string, patch: Partial<Chat>) => {
    write(read().map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)));
  }, []);

  const moveToTrash = useCallback((id: string) => {
    const chat = read().find((c) => c.id === id);
    if (!chat) return;
    write(read().filter((c) => c.id !== id));
    writeTrash([{ ...chat, deletedAt: Date.now() }, ...readTrash().filter((c) => c.id !== id)]);
    if (readActive() === id) {
      const remaining = read().filter((c) => c.product === chat.product);
      writeActive(remaining[0]?.id ?? null);
    }
  }, []);

  /** @deprecated Użyj moveToTrash — zachowane dla kompatybilności */
  const remove = moveToTrash;

  const restore = useCallback((id: string) => {
    const trashed = readTrash().find((c) => c.id === id);
    if (!trashed) return;
    const { deletedAt: _removed, ...chat } = trashed;
    writeTrash(readTrash().filter((c) => c.id !== id));
    write([{ ...chat, updatedAt: Date.now() }, ...read()]);
    writeActive(chat.id);
  }, []);

  const deleteForever = useCallback((id: string) => {
    writeTrash(readTrash().filter((c) => c.id !== id));
    if (readActive() === id) writeActive(read()[0]?.id ?? null);
  }, []);

  const emptyTrash = useCallback(
    (productName?: string) => {
      if (productName) {
        writeTrash(readTrash().filter((c) => c.product !== productName));
      } else {
        writeTrash([]);
      }
    },
    [],
  );

  const rename = useCallback((id: string, title: string) => {
    const nextTitle = title.trim() || "Nowy czat";
    const inTrash = readTrash().some((c) => c.id === id);
    if (inTrash) {
      writeTrash(
        readTrash().map((c) => (c.id === id ? { ...c, title: nextTitle, updatedAt: Date.now() } : c)),
      );
      return;
    }
    write(
      read().map((c) => (c.id === id ? { ...c, title: nextTitle, updatedAt: Date.now() } : c)),
    );
  }, []);

  const reorder = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const list = read();
    const srcIdx = list.findIndex((c) => c.id === sourceId);
    const tgtIdx = list.findIndex((c) => c.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;
    const next = [...list];
    const [moved] = next.splice(srcIdx, 1);
    const insertAt = next.findIndex((c) => c.id === targetId);
    next.splice(insertAt, 0, moved);
    const productIds = new Set(next.filter((c) => c.product === moved.product).map((c) => c.id));
    const base = Date.now();
    let i = 0;
    const ordered = next.map((c) => {
      if (productIds.has(c.id)) {
        const stamp = base - i * 1000;
        i++;
        return { ...c, updatedAt: stamp };
      }
      return c;
    });
    write(ordered);
  }, []);

  return {
    chats,
    trash,
    activeId,
    active,
    create,
    select,
    update,
    moveToTrash,
    remove,
    restore,
    deleteForever,
    emptyTrash,
    rename,
    reorder,
  };
}

export function useEnsureActiveChat(product: string) {
  const { active, create } = useChats(product);
  useEffect(() => {
    if (!active) create(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);
}
