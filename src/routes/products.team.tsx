import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Mail, Building2, CreditCard } from "lucide-react";
import { useCallback, useState } from "react";
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
import { useBrands } from "@/hooks/useBrands";
import { useProducts } from "@/hooks/useProducts";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuthSession } from "@/hooks/useAuthSession";
import { toast } from "sonner";

export const Route = createFileRoute("/products/team")({
  component: TeamPage,
});

function TeamPage() {
  const { isAuthenticated } = useAuthSession();
  const {
    activeWorkspace,
    activeWorkspaceId,
    isOwner,
    inviteMember,
    getMemberRows,
  } = useWorkspace();
  const { brands, shareAllWithTeam: shareBrands } = useBrands(activeWorkspaceId);
  const { products, shareAllWithTeam: shareProducts } = useProducts(activeWorkspaceId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const memberRows = getMemberRows();

  const teamBrandCount = brands.filter((b) => b.visibility === "team").length;
  const teamItemCount = products.filter((p) => p.visibility === "team").length;

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
    if (!isAuthenticated) {
      setError("Zaloguj się, aby zapraszać do workspace.");
      return;
    }
    setSubmitting(true);
    const result = inviteMember(email);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    shareBrands(activeWorkspaceId ?? undefined);
    const brandIds = brands.map((b) => b.id);
    shareProducts(activeWorkspaceId ?? undefined, brandIds);
    toast.success("Zaproszenie zapisane — marki i oferta udostępnione zespołowi.");
    setSubmitting(false);
    setInviteOpen(false);
    resetInviteForm();
  }, [
    activeWorkspaceId,
    brands,
    email,
    inviteMember,
    isAuthenticated,
    resetInviteForm,
    shareBrands,
    shareProducts,
  ]);

  return (
    <div className="px-6 md:px-10 py-10 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Zespół workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {activeWorkspace ? (
          <>
            Workspace: <span className="font-medium text-foreground">{activeWorkspace.name}</span> — członkowie
            widzą udostępnione marki wraz z produktami i usługami.
          </>
        ) : (
          "Zaproś osoby do wspólnej pracy nad markami."
        )}
      </p>

      <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 flex gap-3 text-sm">
        <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
        <p className="text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Każde konto ma własne dane</span> — marki,
          produkty i workspace są przypisane do zalogowanego użytkownika. Inne konto nie widzi Twojego
          katalogu.{" "}
          <span className="font-medium text-foreground">Kredyty AI są osobiste</span> — każdy członek
          zużywa saldo ze swojego konta.
        </p>
      </div>

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
              {m.role === "owner" ? "Właściciel" : m.key.startsWith("inv-") ? "Zaproszony" : "Członek"}
            </span>
          </div>
        ))}
      </div>

      {(teamBrandCount > 0 || teamItemCount > 0) && (
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Marki w zespole:{" "}
            <span className="font-medium text-foreground">
              {teamBrandCount} / {brands.length}
            </span>
          </span>
          <span>
            Produkty i usługi w zespole:{" "}
            <span className="font-medium text-foreground">
              {teamItemCount} / {products.length}
            </span>
          </span>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-elevated/40 p-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold">Zaproś członka workspace</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
          Po zaproszeniu osoba dołącza do workspace i widzi{" "}
          <strong className="font-medium text-foreground">marki wraz z produktami i usługami</strong> oraz
          tożsamość wizualną zapisane przy marce. AI działa na kredytach z własnego konta zaproszonej osoby.
        </p>
        {!isOwner && isAuthenticated && (
          <p className="mt-3 text-xs text-amber-700">Tylko właściciel workspace może wysyłać zaproszenia.</p>
        )}
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          disabled={!isOwner}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
        >
          <Mail className="h-4 w-4" /> Wyślij zaproszenie
        </button>
        <Link
          to="/products/brands"
          className="mt-3 block text-sm text-accent hover:underline"
        >
          Zarządzaj markami w workspace →
        </Link>
      </div>

      <Dialog open={inviteOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md border-border bg-background">
          <DialogHeader>
            <DialogTitle>Zaproś do workspace „{activeWorkspace?.name}”</DialogTitle>
            <DialogDescription>
              Członek zobaczy marki, produkty i usługi udostępnione zespołowi. Kontekst AI i brand kit są
              powiązane z marką. Zużycie AI — z konta zaproszonej osoby.
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
