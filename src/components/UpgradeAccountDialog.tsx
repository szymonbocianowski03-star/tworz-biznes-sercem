import { Link } from "@tanstack/react-router";
import { X, Check, Sparkles, ArrowRight, Cloud, History, Package } from "lucide-react";

type Variant = "signup" | "pro";

type Props = {
  open: boolean;
  onClose: () => void;
  variant?: Variant;
};

export function UpgradeAccountDialog({ open, onClose, variant = "signup" }: Props) {
  if (!open) return null;

  const isSignup = variant === "signup";

  const title = isSignup
    ? "Rozszerz plan Free — załóż darmowe konto"
    : "Wykorzystałeś darmowe produkty";
  const subtitle = isSignup
    ? "Anonimowo masz 1 produkt. Po rejestracji odblokowujesz pełny plan Free — bez karty, bez zobowiązań."
    : "Plan Free obejmuje 3 produkty. Aby dodać więcej, przejdź na Pro.";

  const benefits = isSignup
    ? [
        { icon: Package, label: "Do 3 produktów zamiast 1" },
        { icon: Cloud, label: "Synchronizacja w chmurze między urządzeniami" },
        { icon: History, label: "Historia czatów i kampanii zapisana na koncie" },
      ]
    : [
        { icon: Package, label: "Nielimitowana liczba produktów" },
        { icon: Sparkles, label: "Więcej generacji AI miesięcznie" },
        { icon: Cloud, label: "Priorytetowe wsparcie" },
      ];

  const ctaTo = isSignup ? "/auth" : "/";
  const ctaLabel = isSignup ? "Załóż darmowe konto" : "Zobacz plan Pro";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-surface-elevated border border-border shadow-elevated p-6 md:p-7">
        <button
          onClick={onClose}
          aria-label="Zamknij"
          className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 text-accent text-[11px] font-medium px-2.5 py-1">
          <Sparkles className="h-3 w-3" />
          {isSignup ? "Bez karty kredytowej" : "Upgrade"}
        </div>

        <h2 className="mt-3 text-xl md:text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

        <ul className="mt-5 space-y-2.5">
          {benefits.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/5">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 leading-relaxed">{label}</span>
              <Check className="h-4 w-4 text-accent mt-1.5 shrink-0" />
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full"
          >
            Może później
          </button>
          <Link
            to={ctaTo}
            onClick={onClose}
            className="group flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition shadow-elevated"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {isSignup && (
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Masz już konto?{" "}
            <Link to="/auth" onClick={onClose} className="underline hover:text-foreground">
              Zaloguj się
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}