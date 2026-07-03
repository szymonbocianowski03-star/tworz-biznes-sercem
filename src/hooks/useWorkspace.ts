import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  initWorkspaceStorage,
  readActiveWorkspaceId,
  readAllWorkspaces,
  readInvites,
  readMembers,
  writeActiveWorkspaceId,
  writeAllWorkspaces,
  writeInvites,
  writeMembers,
  type WorkspaceInvite,
  type WorkspaceMember,
  type WorkspaceRecord,
} from "@/lib/workspaceStorage";
import { USER_CHANGED_EVENT, getScopedUserId } from "@/lib/userScopedStorage";

type WorkspaceSnapshot = {
  workspaces: WorkspaceRecord[];
  activeId: string | null;
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
};

const EMPTY_SNAPSHOT: WorkspaceSnapshot = {
  workspaces: [],
  activeId: null,
  members: [],
  invites: [],
};

const listeners = new Set<() => void>();
let snapshotCache: WorkspaceSnapshot | null = null;
/** Zapobiega wielokrotnej inicjalizacji z wielu instancji useWorkspace(). */
let workspaceInitKey = "";

const emit = () => {
  snapshotCache = null;
  listeners.forEach((l) => l());
};

function buildSnapshot(): WorkspaceSnapshot {
  if (snapshotCache) return snapshotCache;
  snapshotCache = {
    workspaces: readAllWorkspaces(),
    activeId: readActiveWorkspaceId(),
    members: readMembers(),
    invites: readInvites(),
  };
  return snapshotCache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const invalidate = () => {
    snapshotCache = null;
    cb();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key?.includes("workspaces") || e.key?.includes("activeWorkspaceId") || e.key?.includes("workspace.")) {
      invalidate();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("mn:workspace-changed", invalidate);
  const onUserChanged = () => {
    workspaceInitKey = "";
    invalidate();
  };
  window.addEventListener(USER_CHANGED_EVENT, onUserChanged);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("mn:workspace-changed", invalidate);
    window.removeEventListener(USER_CHANGED_EVENT, onUserChanged);
  };
}

function genId() {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useWorkspace() {
  const { user } = useAuthSession();
  const email = (user?.email ?? "").toLowerCase();

  const state = useSyncExternalStore(subscribe, buildSnapshot, () => EMPTY_SNAPSHOT);

  const acceptInvitesForEmail = useCallback((userEmail: string) => {
    const normalized = userEmail.toLowerCase();
    const invites = readInvites();
    const pending = invites.filter((i) => i.email === normalized);
    if (!pending.length) return false;

    const members = readMembers();
    const nextMembers = [...members];
    for (const inv of pending) {
      if (nextMembers.some((m) => m.workspaceId === inv.workspaceId && m.email === normalized)) continue;
      nextMembers.push({
        workspaceId: inv.workspaceId,
        email: normalized,
        role: "member",
        joinedAt: Date.now(),
      });
    }
    writeMembers(nextMembers);
    writeInvites(invites.filter((i) => i.email !== normalized));
    emit();
    return true;
  }, []);

  useEffect(() => {
    const initKey = `${getScopedUserId()}|${email}`;
    if (workspaceInitKey === initKey) return;
    workspaceInitKey = initKey;

    const changed = initWorkspaceStorage(email);
    const accepted = email ? acceptInvitesForEmail(email) : false;
    if (changed || accepted) emit();
  }, [email, acceptInvitesForEmail]);

  const activeWorkspace =
    state.workspaces.find((w) => w.id === state.activeId) ?? state.workspaces[0] ?? null;

  const activeWorkspaceId = activeWorkspace?.id ?? null;

  const membersForActive = state.members.filter((m) => m.workspaceId === activeWorkspaceId);
  const invitesForActive = state.invites.filter((i) => i.workspaceId === activeWorkspaceId);

  const isOwner =
    !!email &&
    !!activeWorkspace &&
    (activeWorkspace.ownerEmail === email ||
      membersForActive.some((m) => m.email === email && m.role === "owner"));

  const setActive = useCallback((id: string) => {
    writeActiveWorkspaceId(id);
  }, []);

  const create = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const ws: WorkspaceRecord = {
        id: genId(),
        name: trimmed,
        ownerEmail: email,
        createdAt: Date.now(),
      };
      writeAllWorkspaces([...readAllWorkspaces(), ws]);
      if (email) {
        writeMembers([
          ...readMembers(),
          { workspaceId: ws.id, email, role: "owner", joinedAt: Date.now() },
        ]);
      }
      writeActiveWorkspaceId(ws.id);
      emit();
      return ws;
    },
    [email],
  );

  const rename = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    writeAllWorkspaces(readAllWorkspaces().map((w) => (w.id === id ? { ...w, name: trimmed } : w)));
    emit();
  }, []);

  const inviteMember = useCallback(
    (inviteEmail: string): { ok: true } | { ok: false; error: string } => {
      if (!activeWorkspaceId) return { ok: false, error: "Brak aktywnego workspace." };
      if (!isOwner) return { ok: false, error: "Tylko właściciel może zapraszać." };
      const normalized = inviteEmail.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return { ok: false, error: "Podaj prawidłowy adres e-mail." };
      }
      if (normalized === email) return { ok: false, error: "Nie możesz zaprosić samego siebie." };
      const invites = readInvites();
      if (invites.some((i) => i.workspaceId === activeWorkspaceId && i.email === normalized)) {
        return { ok: false, error: "Zaproszenie już wysłane." };
      }
      if (readMembers().some((m) => m.workspaceId === activeWorkspaceId && m.email === normalized)) {
        return { ok: false, error: "Ta osoba jest już w zespole." };
      }
      writeInvites([...invites, { workspaceId: activeWorkspaceId, email: normalized, invitedAt: Date.now() }]);
      emit();
      return { ok: true };
    },
    [activeWorkspaceId, email, isOwner],
  );

  const getMemberRows = useCallback(() => {
    if (!activeWorkspace) return [];
    const rows: Array<{ key: string; name: string; email: string; role: "owner" | "member"; initial: string }> = [];
    const ownerMail = activeWorkspace.ownerEmail;
    if (ownerMail) {
      const name = ownerMail.split("@")[0] ?? "Właściciel";
      rows.push({
        key: `owner-${ownerMail}`,
        name,
        email: ownerMail,
        role: "owner",
        initial: name[0]?.toUpperCase() ?? "W",
      });
    }
    for (const m of membersForActive.filter((x) => x.role === "member")) {
      if (m.email === ownerMail) continue;
      rows.push({
        key: m.email,
        name: m.email.split("@")[0] ?? m.email,
        email: m.email,
        role: "member",
        initial: m.email[0]?.toUpperCase() ?? "M",
      });
    }
    for (const inv of invitesForActive) {
      if (rows.some((r) => r.email === inv.email)) continue;
      rows.push({
        key: `inv-${inv.email}`,
        name: inv.email.split("@")[0] ?? inv.email,
        email: inv.email,
        role: "member",
        initial: inv.email[0]?.toUpperCase() ?? "?",
      });
    }
    return rows;
  }, [activeWorkspace, membersForActive, invitesForActive]);

  return {
    workspaces: state.workspaces,
    activeWorkspace,
    activeWorkspaceId,
    members: membersForActive,
    invites: invitesForActive,
    isOwner,
    setActive,
    create,
    rename,
    inviteMember,
    getMemberRows,
    acceptInvitesForEmail,
  };
}

export type { WorkspaceInvite, WorkspaceMember, WorkspaceRecord };
