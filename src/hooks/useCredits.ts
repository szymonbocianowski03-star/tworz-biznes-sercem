import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { subscribeCreditsRefresh } from "@/lib/creditsRefresh";

export type CreditsRow = {
  balance: number;
  current_plan: string;
  free_ai_usage_usd_cents: number | null;
};

function newRealtimeChannelSuffix(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function useCredits() {
  const { user } = useAuthSession();
  const [data, setData] = useState<CreditsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = user?.id;
  const mounted = useRef(true);
  /** Unikalna nazwa kanału — `supabase.channel(name)` zwraca istniejący kanał; drugi `useCredits()` nie może dodać `.on()` po cudzym `subscribe()`. */
  const realtimeChannelSuffix = useRef<string>(newRealtimeChannelSuffix());
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const fetchRow = useCallback(async (opts?: { silent?: boolean }) => {
    const uid = userIdRef.current;
    if (!uid) return;
    if (!opts?.silent) setLoading(true);
    try {
      let { data: row } = await supabase
        .from("user_credits")
        .select("balance,current_plan,free_ai_usage_usd_cents")
        .eq("user_id", uid)
        .maybeSingle();

      if (!row) {
        const ensured = await supabase.rpc("ensure_user_credits");
        if (ensured.error) {
          console.warn("ensure_user_credits:", ensured.error.message);
        }
        const retry = await supabase
          .from("user_credits")
          .select("balance,current_plan,free_ai_usage_usd_cents")
          .eq("user_id", uid)
          .maybeSingle();
        row = retry.data;
      }

      if (mounted.current && userIdRef.current === uid) setData(row as CreditsRow | null);
    } finally {
      if (mounted.current && userIdRef.current === uid && !opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = (silent: boolean) => {
      if (cancelled) return;
      void fetchRow({ silent });
    };

    run(false);

    const unsubRefresh = subscribeCreditsRefresh(() => run(true));

    const ch = supabase
      .channel(`credits:${userId}:${realtimeChannelSuffix.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_credits", filter: `user_id=eq.${userId}` },
        () => run(true),
      )
      .subscribe();

    const onVis = () => {
      if (document.visibilityState === "visible") run(true);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      unsubRefresh();
      supabase.removeChannel(ch);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId, fetchRow]);

  const refetch = useCallback(() => {
    void fetchRow({ silent: true });
  }, [fetchRow]);

  return { ...data, loading, refetch };
}
