import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, LayoutList, Images, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/campaign-composer" as const, label: "Przegląd", icon: LayoutDashboard, end: true },
  { to: "/campaign-composer/collections" as const, label: "Zbiory", icon: LayoutList, end: false },
  { to: "/campaign-composer/media" as const, label: "Biblioteka mediów", icon: Images, end: false },
];

export function CampaignComposerNav() {
  const { pathname } = useLocation();
  return (
    <div className="border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-2.5 md:px-6">
        <div className="mr-3 flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          <Rocket className="h-4 w-4 text-muted-foreground" />
          <span>Panel kampanii</span>
        </div>
        {links.map(({ to, label, icon: Icon, end }) => {
          const active = end ? pathname === to || pathname === `${to}/` : pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
