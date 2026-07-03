import { Navigate, useRouterState } from "@tanstack/react-router";
import { useAuthSession } from "@/hooks/useAuthSession";
import { isPublicPath } from "@/lib/publicRoutes";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  return <ProtectedAuthGate>{children}</ProtectedAuthGate>;
}

function ProtectedAuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, error } = useAuthSession();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">Ładowanie konta…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground px-6 max-w-lg mx-auto text-center">
        <p className="text-sm font-medium text-destructive">Problem z konfiguracją lub sesją</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
        <p className="text-xs text-muted-foreground">
          Upewnij się, że w środowisku masz ustawione{" "}
          <code className="rounded bg-muted px-1 py-0.5">VITE_SUPABASE_URL</code> oraz{" "}
          <code className="rounded bg-muted px-1 py-0.5">VITE_SUPABASE_PUBLISHABLE_KEY</code>, potem odśwież stronę.
        </p>
        <a
          href="/auth"
          className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
        >
          Przejdź do logowania
        </a>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
