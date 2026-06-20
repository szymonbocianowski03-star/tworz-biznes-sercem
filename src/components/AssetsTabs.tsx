import { Link, useLocation } from "@tanstack/react-router";
import { Image, Video, Wand2 } from "lucide-react";

const tabs = [
  { to: "/assets/gallery", label: "Obrazy", icon: Image },
  { to: "/assets/video", label: "Wideo", icon: Video },
  { to: "/assets/ad-studio", label: "Studio reklam", icon: Wand2 },
];

export function AssetsTabs() {
  const { pathname } = useLocation();
  return (
    <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated p-1 shadow-soft">
      {tabs.map((t) => {
        const active = pathname === t.to;
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-full transition-all ${
              active
                ? "bg-foreground text-background font-medium shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
