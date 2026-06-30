import { createFileRoute } from "@tanstack/react-router";
import { Users, Mail } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProducts } from "@/hooks/useProducts";
import { useAuthSession } from "@/hooks/useAuthSession";

export const Route = createFileRoute("/products/team")({
  component: TeamPage,
});

const INVITES_KEY = "mn.team.invites";

type TeamInvite = { email: string; invitedAt: number };

function loadInvites(): TeamInvite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INVITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is TeamInvite =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as TeamInvite).email === "string" &&
        typeof (x as TeamInvite).invitedAt === "number",
    );
  } catch {
    return [];
  }
}

function saveInvites(items: TeamInvite[]) {
  localStorage.setItem(INVITES_KEY, JSON.stringify(items));
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function TeamPage() {
  const { user } = useAuthSession();
  const { products, shareAllWithTeam } = useProducts();
  const [invites, setInvites] = useState<TeamInvite[]>(() => loadInvites());
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    saveInvites(invites);
  }, [invites]);

  const owner = useMemo(() => {
    const mail = user?.email ?? "";
    const meta = user?.user_metadata as { full_name?: string } | undefined;
    const name = meta?.full_name?.trim() || (mail ? mail.split("@")[0] : "Ty");
    const initial = (name[0] || "T").toUpperCase();
    return { name, email: mail || "—", initial };
  }, [user]);

  const resetInviteForm = useCallback(() => {
    setEmail("");
    setError(null);
    setSubmitting(false);
  }, []);

  const onOpenChange = useCallback(
    (open: boolean) => {
      setInviteOpen(open);
      if (!open) resetInviteForm();
    },
    [resetInviteForm],
  );

  const sendInvite = useCallback(() => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setError("Podaj prawidłowy adres e-mail.");
      return;
    }
    if (owner.email !== "—" && trimmed === owner.email.toLowerCase()) {
      setError("Nie możesz zaprosić samego siebie.");
      return;
    }
    if (invites.some((i) => i.email.toLowerCase() === trimmed)) {
      setError("To zaproszenie już istnieje.");
      return;
    }
    setSubmitting(true);
    setInvites((prev) => [...prev, { email: trimmed, invitedAt: Date.now() }]);
    shareAllWithTeam();
    setSubmitting(false);
    setInviteOpen(false);
    resetInviteForm();
  }, [email, invites, owner.email, resetInviteForm, shareAllWithTeam]);

  const memberRows = useMemo(
    () => [
      { key: "owner", name: owner.name, email: owner.email, role: "Owner" as const, initial: owner.initial },
      ...invites.map((i) => ({
        key: i.email,
        name: i.email.split("@")[0],
        email: i.email,
        role: "Member" as const,
        initial: i.email[0].toUpperCase(),
      })),
    ],
    [owner, invites],
  );

  const teamProductCount = products.filter((p) => p.visibility === "team").length;

  return (
    <div className="px-6 md:px-10 py-10 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Zespół</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Zaproś osoby do swojego workspace, aby wspólnie tworzyć kampanie.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface-elevated p-2">
        {memberRows.map((m) => (
          <div key={m.key} className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 rounded-full bg-foreground text-background text-sm font-bold flex items-center justify-center shrink-0">
              {m.initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.name}</p>
              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full shrink-0">
              {m.role === "Owner" ? "Właściciel" : "Członek"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-elevated/40 p-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold">Zaproś członka zespołu</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
          Po wysłaniu zaproszenia wszystkie produkty w tym workspace zostaną oznaczone jako udostępnione
          zespołowi — nowy członek zobaczy ten sam katalog co Ty (po dołączeniu do workspace).
        </p>
        {teamProductCount > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Produkty udostępnione zespołowi:{" "}
            <span className="font-medium text-foreground">
              {teamProductCount} / {products.length}
            </span>
          </p>
        )}
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all"
        >
          <Mail className="h-4 w-4" /> Wyślij zaproszenie
        </button>
      </div>

      <Dialog open={inviteOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md border-border bg-background">
          <DialogHeader>
            <DialogTitle>Zaproś do workspace</DialogTitle>
            <DialogDescription>
              Wpisz adres e-mail osoby, którą chcesz dodać. Po zatwierdzeniu wszystkie Twoje produkty w
              workspace zostaną udostępnione zespołowi, aby nowy członek miał ten sam widok katalogu.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <label htmlFor="team-invite-email" className="text-sm font-medium text-left">
              Adres e-mail
            </label>
            <Input
              id="team-invite-email"
              type="email"
              autoComplete="email"
              placeholder="imie@firma.pl"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendInvite();
              }}
              className="rounded-xl border-border bg-surface-elevated"
            />
            {error ? <p className="text-sm text-destructive text-left">{error}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
              Anuluj
            </Button>
            <Button
              type="button"
              onClick={sendInvite}
              disabled={submitting}
              className="rounded-full bg-foreground text-background hover:opacity-90"
            >
              Wyślij zaproszenie
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
