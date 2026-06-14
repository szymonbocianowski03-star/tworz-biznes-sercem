import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useCredits } from "@/hooks/useCredits";
import { FREE_AI_USAGE_BUDGET_CENTS } from "@/lib/creditsRefresh";
import { partnerProgramMailto, SUPPORT_EMAIL } from "@/lib/siteContact";

type CreditsUpgradeContextValue = {
  openCreditsUpgrade: (detail?: string) => void;
  closeCreditsUpgrade: () => void;
};

const CreditsUpgradeContext = React.createContext<CreditsUpgradeContextValue | null>(null);

export function useCreditsUpgrade(): CreditsUpgradeContextValue {
  const ctx = React.useContext(CreditsUpgradeContext);
  if (!ctx) {
    throw new Error("useCreditsUpgrade musi być użyte wewnątrz CreditsUpgradeProvider");
  }
  return ctx;
}

/** Do obsługi catch — czy komunikat wygląda na limit kredytów / 402 */
export function isCreditsLimitMessage(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("kredyt") ||
    t.includes("limit planu") ||
    t.includes("plan i kredyty") ||
    t.includes("wykorzystałeś limit") ||
    t.includes("brak kredyt") ||
    t.includes("ulepsz konto")
  );
}

/** Gdy backend nie ma budżetu na AI (plan Free — limit „szacunku” albo plan płatny — saldo 0), zachęć do upgrade. */
function FreeQuotaUpgradeNudge() {
  const { user } = useAuthSession();
  const credits = useCredits();
  const { openCreditsUpgrade } = useCreditsUpgrade();
  const prevBlocked = React.useRef(false);

  const isFreePlan = (credits.current_plan ?? "free") === "free";
  const usage = credits.free_ai_usage_usd_cents ?? 0;
  const balance = credits.balance ?? 0;
  const blocked =
    !!user && !credits.loading && (isFreePlan ? usage >= FREE_AI_USAGE_BUDGET_CENTS : balance <= 0);

  React.useEffect(() => {
    if (!user || credits.loading) return;
    if (blocked && !prevBlocked.current) {
      prevBlocked.current = true;
      const msg = isFreePlan
        ? "Na planie Free wykorzystałeś już cały limit AI narzucony przez platformę (brak dodatkowego budżetu po naszej stronie). Wybierz wyższy plan, żeby dalej korzystać z agenta, obrazów, wideo i pozostałych funkcji."
        : "Na koncie nie ma już kredytów na ten plan. Ulepsz pakiet albo dokup kredyty, żeby kontynuować pracę z AI.";
      openCreditsUpgrade(msg);
    }
    if (!blocked) prevBlocked.current = false;
  }, [user, credits.loading, blocked, isFreePlan, openCreditsUpgrade]);

  return null;
}

export function CreditsUpgradeProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<string | undefined>();

  const openCreditsUpgrade = React.useCallback((d?: string) => {
    setDetail(d?.trim() || undefined);
    setOpen(true);
  }, []);

  const closeCreditsUpgrade = React.useCallback(() => {
    setOpen(false);
  }, []);

  const value = React.useMemo(
    () => ({ openCreditsUpgrade, closeCreditsUpgrade }),
    [openCreditsUpgrade, closeCreditsUpgrade],
  );

  return (
    <CreditsUpgradeContext.Provider value={value}>
      <FreeQuotaUpgradeNudge />
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeCreditsUpgrade();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Brak kredytów lub limit planu</DialogTitle>
            <DialogDescription className="text-left pt-1">
              Podnieś plan albo dokup paczkę kredytów — wrócisz od razu do agenta, analiz i
              generowania treści.
            </DialogDescription>
            {detail ? (
              <p className="text-sm text-foreground font-medium text-left pt-2 border-t border-border mt-3">
                {detail}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground text-left pt-3 leading-relaxed">
              Chcesz polecać MarketingNow i zarabiać prowizję? Zobacz{" "}
              <Link
                to="/program-partnerski"
                className="text-foreground font-medium underline-offset-2 hover:underline"
                onClick={closeCreditsUpgrade}
              >
                program partnerski
              </Link>{" "}
              albo napisz na{" "}
              <a
                href={partnerProgramMailto}
                className="text-foreground font-medium underline-offset-2 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={closeCreditsUpgrade}>
              Zamknij
            </Button>
            <Button type="button" asChild>
              <Link to="/billing" onClick={closeCreditsUpgrade}>
                Plan i kredyty
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CreditsUpgradeContext.Provider>
  );
}
