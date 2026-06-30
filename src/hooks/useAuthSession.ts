import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { hasSupabasePublicEnv } from "@/integrations/supabase/publicEnv";
import { syncLocalDataOwner } from "@/lib/localUserData";

/** @deprecated użyj hasSupabasePublicEnv */
export function hasSupabaseBrowserConfig() {
  return hasSupabasePublicEnv();
}

const LOADING_SAFETY_MS = 15_000;

export function useAuthSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabasePublicEnv()) {
      setUser(null);
      setLoading(false);
      setError(null);
      return;
    }

    let mounted = true;
    setError(null);

    const safetyId = window.setTimeout(() => {
      if (!mounted) return;
      setLoading(false);
    }, LOADING_SAFETY_MS);

    let unsub: (() => void) | undefined;

    try {
      const { data } = supabase.auth.onAuthStateChange((_evt, session) => {
        if (!mounted) return;
        syncLocalDataOwner(session?.user?.id ?? null);
        setUser(session?.user ?? null);
        setError(null);
        setLoading(false);
      });
      unsub = () => data.subscription.unsubscribe();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (mounted) {
        setUser(null);
        setError(msg);
        setLoading(false);
      }
      window.clearTimeout(safetyId);
      return () => {
        mounted = false;
      };
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        syncLocalDataOwner(data.session?.user?.id ?? null);
        setUser(data.session?.user ?? null);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setUser(null);
        setError(e instanceof Error ? e.message : "Nie udało się odczytać sesji.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
        window.clearTimeout(safetyId);
      });

    return () => {
      mounted = false;
      window.clearTimeout(safetyId);
      unsub?.();
    };
  }, []);

  return { user, loading, isAuthenticated: !!user, error };
}
