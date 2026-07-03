import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

type Props = {
  to?: string;
  label?: string;
  className?: string;
};

export function AppBackLink({ to = "/agent", label = "Wróć do aplikacji", className = "" }: Props) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}
