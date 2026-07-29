import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isAdPlatformComingSoon } from "@/lib/adPlatform";
import { fetchOAuthHandoff } from "@/lib/oauthHandoffClient";
import { getGoogleIntegrationOAuthOrigin } from "@/lib/googleIntegrationOrigin";
import { saveIntegrationConnectionRow } from "@/lib/integrationConnectionSave";
import { refreshGoogleAdsAccounts } from "@/lib/googleAds.functions";

type CustomerAccount = { id: string; resourceName?: string; descriptiveName?: string };

type Connection = {
  id: string;
  email: string;
  customer_accounts: CustomerAccount[];
  selected_customer_id: string | null;
  login_customer_id: string | null;
};
export function GoogleAdsIntegrationCard() {
  const comingSoon = isAdPlatformComingSoon("google");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [conn, setConn] = useState<Connection | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [noAccounts, setNoAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const fnRefreshAccounts = useServerFn(refreshGoogleAdsAccounts);
  const autoRefreshedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    setUserId(auth.user?.id ?? null);
    if (!auth.user) {
      setConn(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("google_ads_connections")
      .select("id,email,customer_accounts,selected_customer_id,login_customer_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error) {
      console.error(error);
      toast.error("Nie udało się wczytać połączenia Google Ads", { description: error.message });
    } else if (data) {
      setConn({
        id: data.id,
        email: data.email,
        customer_accounts: Array.isArray(data.customer_accounts)
          ? (data.customer_accounts as CustomerAccount[])
          : [],
        selected_customer_id: data.selected_customer_id,
        login_customer_id: data.login_customer_id,
      });
    } else {
      setConn(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connect = async () => {
    if (comingSoon) return;
    if (!userId) {
      toast.message("Zaloguj się, aby połączyć Google Ads");
      navigate({ to: "/auth" });
      return;
    }
    const handoff = await fetchOAuthHandoff();
    if (!handoff) {
      toast.error("Sesja wygasła. Zaloguj się ponownie.");
      navigate({ to: "/auth" });
      return;
    }
    const startUrl = new URL("/api/public/google/start", getGoogleIntegrationOAuthOrigin());
    startUrl.searchParams.set("handoff", handoff);
    startUrl.searchParams.set("service", "ads");
    startUrl.searchParams.set("force_login", "1");
    startUrl.searchParams.set("return_to", `${window.location.origin}/integrations`);
    toast.message("Przekierowuję do autoryzacji Google Ads…");
    window.location.href = startUrl.toString();
  };

  const disconnect = async () => {
    if (!userId || !conn) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("google_ads_connections").delete().eq("user_id", userId);
      if (error) throw error;
      setConn(null);
      toast.success("Rozłączono Google Ads");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Błąd rozłączania");
    } finally {
      setSaving(false);
    }
  };

  const selectCustomer = async (customerId: string) => {
    if (!userId || !conn) return;
    setSaving(true);
    try {
      const res = await saveIntegrationConnectionRow("google_ads_connections", conn.id, {
        selected_customer_id: customerId || null,
      });
      if (!res.ok) throw new Error(res.error);
      setConn({ ...conn, selected_customer_id: customerId || null });
      toast.success("Zapisano konto Google Ads");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  };

  const refreshAccounts = useCallback(
    async (silent = false) => {
      setRefreshing(true);
      try {
        const res = await fnRefreshAccounts();
        if (res.ok) {
          setNoAccounts(res.accounts.length === 0);
          setAccountsError(null);
          setConn((prev) =>
            prev
              ? {
                  ...prev,
                  customer_accounts: res.accounts,
                  selected_customer_id: res.selectedCustomerId,
                }
              : prev,
          );
          if (!silent && res.accounts.length > 0) toast.success("Zaktualizowano listę kont Google Ads");
        } else {
          setNoAccounts(true);
          const msg =
            res.detail ??
            "Nie znaleziono kont reklamowych na tym koncie Google. Upewnij się, że masz dostęp do Google Ads.";
          setAccountsError(msg);
          if (!silent) toast.error("Google Ads", { description: msg });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Nie udało się odświeżyć kont";
        setAccountsError(msg);
        if (!silent) toast.error(msg);
      } finally {
        setRefreshing(false);
      }
    },
    [fnRefreshAccounts],
  );

  // Po połączeniu automatycznie pobierz listę kont (bez ręcznego wpisywania ID).
  useEffect(() => {
    if (!conn || autoRefreshedRef.current) return;
    if (conn.customer_accounts.length === 0 || !conn.selected_customer_id) {
      autoRefreshedRef.current = true;
      void refreshAccounts(true);
    }
  }, [conn, refreshAccounts]);

  return (
    <section className="rounded-xl border border-foreground/10 bg-card p-5">
      <header className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold">
          G
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold tracking-tight">Google Ads</h2>
            {comingSoon ? (
              <span className="rounded-full border border-amber-600/20 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                Wkrótce
              </span>
            ) : conn ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/20 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <Check className="h-3 w-3" /> połączone
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                <X className="h-3 w-3" /> nie
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Search i Performance Max — tworzenie kampanii, załączanie zdjęć i publikacja z panelu kampanii.
          </p>
        </div>
      </header>

      <div className="rounded-lg border border-amber-600/25 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        Integracja działa <strong>na własne ryzyko</strong>. Odpowiadasz za budżet, treść reklam, targetowanie
        i zgodność z polityką Google Ads. Przed publikacją wymagane jest świadome potwierdzenie w kreatorze.
      </div>

      {loading ? (
        <div className="mt-4 flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : comingSoon ? (
        <p className="mt-4 text-sm text-muted-foreground">Integracja będzie dostępna wkrótce.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {conn && (
            <p className="text-xs text-muted-foreground">
              Połączono jako <span className="font-semibold text-foreground">{conn.email}</span>
            </p>
          )}
          {conn && conn.customer_accounts.length > 0 && (
            <label className="block space-y-1.5 text-xs">
              <span className="font-semibold text-muted-foreground">Konto reklamowe (Customer ID)</span>
              <select
                disabled={saving}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={conn.selected_customer_id ?? ""}
                onChange={(e) => void selectCustomer(e.target.value)}
              >
                <option value="">— wybierz —</option>
                {conn.customer_accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.descriptiveName ? `${a.descriptiveName} (${a.id})` : a.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          {conn && conn.customer_accounts.length === 0 && (
            <div className="space-y-2">
              {refreshing ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Wczytuję Twoje konta reklamowe…
                </p>
              ) : noAccounts ? (
                <p className="rounded-lg border border-amber-600/25 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                  {accountsError ??
                    "Nie znaleziono kont reklamowych na tym koncie Google. Upewnij się, że wybrane konto ma dostęp do Google Ads, a następnie odśwież."}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Przygotowuję listę kont…
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void connect()}
              className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
            >
              {conn ? "Zmień konto Google" : "Połącz Google Ads"}
            </button>
            {conn && (
              <button
                type="button"
                disabled={refreshing}
                onClick={() => void refreshAccounts(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
              >
                <RotateCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Odśwież konta
              </button>
            )}
            {conn && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void disconnect()}
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
              >
                Rozłącz
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate({ to: "/campaign-composer" })}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Otwórz panel kampanii
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
