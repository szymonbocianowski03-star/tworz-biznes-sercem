/** Wspólne klucze i helpery workspace (localStorage, per użytkownik). */

import {
  readScopedJson,
  readScopedString,
  writeScopedJson,
  writeScopedString,
  migrateScopedJsonOnce,
  migrateScopedStringOnce,
  getScopedUserId,
} from "@/lib/userScopedStorage";

const WS_LIST_BASE = "workspaces.v2";
const WS_ACTIVE_BASE = "activeWorkspaceId";
const WS_MEMBERS_BASE = "workspace.members.v1";
const WS_INVITES_BASE = "workspace.invites.v1";

/** Legacy — migracja z AppShell (globalne, jednorazowo) */
export const WS_LEGACY_NAMES_KEY = "mn.workspaces";
export const WS_LEGACY_ACTIVE_NAME_KEY = "mn.activeWs";

export type WorkspaceRecord = {
  id: string;
  name: string;
  ownerEmail: string;
  createdAt: number;
};

export type WorkspaceMember = {
  workspaceId: string;
  email: string;
  role: "owner" | "member";
  joinedAt: number;
};

export type WorkspaceInvite = {
  workspaceId: string;
  email: string;
  invitedAt: number;
};

export type TeamVisibility = "private" | "team";

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readLegacyNames(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WS_LEGACY_NAMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function migrateLegacyWorkspaces(ownerEmail: string): WorkspaceRecord[] {
  const legacyNames = readLegacyNames();
  const names = legacyNames.length ? legacyNames : ["Osobiste"];
  const legacyActiveName = localStorage.getItem(WS_LEGACY_ACTIVE_NAME_KEY) || names[0];
  const records: WorkspaceRecord[] = names.map((name) => ({
    id: genId("ws"),
    name,
    ownerEmail: ownerEmail.toLowerCase(),
    createdAt: Date.now(),
  }));
  writeAllWorkspaces(records);
  const active = records.find((w) => w.name === legacyActiveName) ?? records[0];
  if (active) writeActiveWorkspaceId(active.id);
  if (ownerEmail) {
    const members = readMembers();
    const next = [...members];
    for (const ws of records) {
      if (!next.some((m) => m.workspaceId === ws.id && m.email === ownerEmail.toLowerCase())) {
        next.push({
          workspaceId: ws.id,
          email: ownerEmail.toLowerCase(),
          role: "owner",
          joinedAt: Date.now(),
        });
      }
    }
    writeMembers(next);
  }
  return records;
}

/** Tylko odczyt — bez migracji ani zapisów (bezpieczne w getSnapshot). */
export function readAllWorkspaces(): WorkspaceRecord[] {
  return readScopedJson<WorkspaceRecord[]>(WS_LIST_BASE, []);
}

export function writeAllWorkspaces(list: WorkspaceRecord[]) {
  writeScopedJson(WS_LIST_BASE, list);
}

export function readActiveWorkspaceId(): string | null {
  return readScopedString(WS_ACTIVE_BASE);
}

export function writeActiveWorkspaceId(id: string | null) {
  if (typeof window === "undefined") return;
  const current = readActiveWorkspaceId();
  const next = id ?? null;
  if (current === next || (!current && !next)) return;
  writeScopedString(WS_ACTIVE_BASE, id);
  window.dispatchEvent(new CustomEvent("mn:workspace-changed"));
}

export function readMembers(): WorkspaceMember[] {
  return readScopedJson<WorkspaceMember[]>(WS_MEMBERS_BASE, []);
}

export function writeMembers(members: WorkspaceMember[]) {
  writeScopedJson(WS_MEMBERS_BASE, members);
}

export function readInvites(): WorkspaceInvite[] {
  return readScopedJson<WorkspaceInvite[]>(WS_INVITES_BASE, []);
}

export function writeInvites(invites: WorkspaceInvite[]) {
  writeScopedJson(WS_INVITES_BASE, invites);
}

/** Jednorazowa inicjalizacja — wywoływać w useEffect, nie w getSnapshot. */
export function initWorkspaceStorage(ownerEmail: string): boolean {
  let changed = false;
  if (migrateScopedJsonOnce<WorkspaceRecord[]>(WS_LIST_BASE)) changed = true;
  if (migrateScopedStringOnce(WS_ACTIVE_BASE)) changed = true;
  if (migrateScopedJsonOnce<WorkspaceMember[]>(WS_MEMBERS_BASE)) changed = true;
  if (migrateScopedJsonOnce<WorkspaceInvite[]>(WS_INVITES_BASE)) changed = true;

  let list = readAllWorkspaces();

  if (!list.length) {
    const legacyNames = readLegacyNames();
    if (legacyNames.length || localStorage.getItem(WS_LEGACY_ACTIVE_NAME_KEY)) {
      list = migrateLegacyWorkspaces(ownerEmail);
      changed = true;
    }
  }

  if (!list.length) {
    const ws: WorkspaceRecord = {
      id: genId("ws"),
      name: "Osobiste",
      ownerEmail: ownerEmail.toLowerCase(),
      createdAt: Date.now(),
    };
    writeAllWorkspaces([ws]);
    writeActiveWorkspaceId(ws.id);
    if (ownerEmail) {
      writeMembers([
        ...readMembers(),
        { workspaceId: ws.id, email: ownerEmail.toLowerCase(), role: "owner", joinedAt: Date.now() },
      ]);
    }
    changed = true;
    return changed;
  }

  const activeId = readActiveWorkspaceId();
  if (!activeId || !list.some((w) => w.id === activeId)) {
    writeActiveWorkspaceId(list[0]!.id);
    changed = true;
  }

  if (ownerEmail) {
    const members = readMembers();
    const normalized = ownerEmail.toLowerCase();
    const needsOwner = list.some(
      (ws) => !members.some((m) => m.workspaceId === ws.id && m.email === normalized),
    );
    if (needsOwner) {
      const next = [...members];
      for (const ws of list) {
        if (!next.some((m) => m.workspaceId === ws.id && m.email === normalized)) {
          next.push({ workspaceId: ws.id, email: normalized, role: "owner", joinedAt: Date.now() });
        }
      }
      writeMembers(next);
      changed = true;
    }
  }

  return changed;
}

/** @deprecated użyj initWorkspaceStorage */
export function ensureDefaultWorkspace(ownerEmail: string): WorkspaceRecord {
  initWorkspaceStorage(ownerEmail);
  const list = readAllWorkspaces();
  return list.find((w) => w.id === readActiveWorkspaceId()) ?? list[0]!;
}
