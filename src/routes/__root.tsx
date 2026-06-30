import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import appCss from "../styles.css?url";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { GoogleAdsTag } from "@/components/GoogleAdsTag";
import { AuthGate } from "@/components/AuthGate";
import { CreditsUpgradeProvider } from "@/contexts/CreditsUpgradeContext";
import { Toaster } from "@/components/ui/sonner";
import { sfx, soundsEnabled, setSoundsEnabled } from "@/lib/sounds";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 selection:bg-foreground/10">
      <div className="max-w-lg text-center">
        <p className="editorial-eyebrow">Błąd 404</p>
        <h1 className="mt-4 font-display text-7xl md:text-8xl font-extrabold tracking-tighter text-foreground">404</h1>
        <h2 className="mt-6 font-display text-xl md:text-2xl font-bold text-foreground">Nie znaleziono strony</h2>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Ten adres nie istnieje lub został przeniesiony. Wróć na stronę główną i kontynuuj pracę z NOW.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Strona główna
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MarketingNow — marketing firmy w jednym miejscu" },
      { name: "description", content: "Agent AI po polsku, który robi marketing Twojego produktu w 5 minut." },
      { name: "author", content: "MarketingNow" },
      { property: "og:title", content: "MarketingNow — marketing firmy w jednym miejscu" },
      { property: "og:description", content: "Agent AI po polsku, który robi marketing Twojego produktu w 5 minut." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@MarketingNow" },
      { name: "twitter:title", content: "MarketingNow — marketing firmy w jednym miejscu" },
      { name: "twitter:description", content: "Agent AI po polsku, który robi marketing Twojego produktu w 5 minut." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b836a8c3-7ab6-408b-8241-8ced24e01418/id-preview-8bfbf847--10fa611d-9c78-46b3-b583-d064df8ed9eb.lovable.app-1780776382566.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b836a8c3-7ab6-408b-8241-8ced24e01418/id-preview-8bfbf847--10fa611d-9c78-46b3-b583-d064df8ed9eb.lovable.app-1780776382566.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <GoogleAdsTag />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useGlobalAppleSounds();
  return (
    <>
      <PaymentTestModeBanner />
      <Toaster richColors position="top-center" closeButton />
      <AuthGate>
        <CreditsUpgradeProvider>
          <Outlet />
        </CreditsUpgradeProvider>
      </AuthGate>
      <SoundToggle />
    </>
  );
}

function useGlobalAppleSounds() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isInteractive = (el: Element | null): HTMLElement | null => {
      if (!el) return null;
      const target = (el as HTMLElement).closest(
        'button, a, [role="button"], [role="link"], [role="tab"], [role="menuitem"], input[type="checkbox"], input[type="radio"], summary, label[for]'
      ) as HTMLElement | null;
      return target;
    };
    let lastHover: HTMLElement | null = null;
    const onPointerDown = (e: PointerEvent) => {
      const t = isInteractive(e.target as Element);
      if (t) sfx.tap();
    };
    const onPointerOver = (e: PointerEvent) => {
      const t = isInteractive(e.target as Element);
      if (t && t !== lastHover) {
        lastHover = t;
        sfx.hover();
      }
    };
    const onPointerOut = (e: PointerEvent) => {
      const t = isInteractive(e.target as Element);
      if (t === lastHover) lastHover = null;
    };
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerover", onPointerOver, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerover", onPointerOver);
      window.removeEventListener("pointerout", onPointerOut);
    };
  }, []);
}

function SoundToggle() {
  const [on, setOn] = useState<boolean>(true);
  useEffect(() => { setOn(soundsEnabled()); }, []);
  const toggle = () => {
    const next = !on;
    setSoundsEnabled(next);
    setOn(next);
    if (next) sfx.chime();
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? "Wycisz dźwięki" : "Włącz dźwięki"}
      title={on ? "Wycisz dźwięki UI" : "Włącz dźwięki UI"}
      className="fixed bottom-4 right-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full border border-foreground/10 bg-background/80 backdrop-blur shadow-soft hover:bg-muted/60 transition"
    >
      <span className="text-base leading-none">{on ? "🔊" : "🔇"}</span>
    </button>
  );
}
