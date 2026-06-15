import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { saveIntegrationConnectionRow } from "@/lib/integrationConnectionSave";
import { isAdPlatformComingSoon } from "@/lib/adPlatform";
import { toast } from "sonner";

type AdvertiserAccount = { id: string; name?: string; currency?: string };

type Connection = {
  id: string;
  tiktok_advertiser_id: string;
  advertiser_name: string | null;
  token_expires_at: string | null;
  advertiser_accounts: AdvertiserAccount[];
  selected_advertiser_id: string | null;
  status: string;
};

export function TikTokIntegrationCard() {
  const comingSoon = isAdPlatformComingSoon("tiktok");
  const [loading, setLoading] = useState(true);
  const [conn, setConn] = useState<Connection | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }
    setUserId(u.user.id);
    const { data } = await supabase
      .from("tiktok_connections")
      .select("*")
      .eq("user_id", u.user.id)
      .order("updated_at", { ascending: false })
      .limit(1);
    setConn((((data ?? [])[0] as unknown) as Connection | undefined) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const tokenExpired =
    !!conn?.token_expires_at && new Date(conn.token_expires_at).getTime() < Date.now();

  const statusLabel = !conn
    ? "Nie połączono"
    : tokenExpired
      ? "Token wygasł"
      : conn.status === "error"
        ? "Błąd"
        : "Połączono";
  const statusOk = !!conn && !tokenExpired && conn.status !== "error";

  const connect = async () => {
    if (!userId) {
      toast.message("Zaloguj się, aby połączyć TikTok Ads");
      navigate({ to: "/auth" });
      return;
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      toast.error("Sesja wygasła. Zaloguj się ponownie.");
      navigate({ to: "/auth" });
      return;
    }
    toast.message("Przekierowuję do logowania TikTok Ads…");
    window.location.assign(`/api/public/tiktok/start?token=${encodeURIComponent(token)}`);
  };

  const disconnect = async () => {
    if (!conn) return;
    if (!confirm("Odłączyć konto TikTok Ads?")) return;
    const { error } = await supabase.from("tiktok_connections").delete().eq("id", conn.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Odłączono TikTok Ads");
    setConn(null);
  };

  const updateField = async (patch: Partial<Connection>) => {
    if (!conn) return;
    const r = await saveIntegrationConnectionRow("tiktok_connections", conn.id, patch);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setConn({ ...conn, ...patch });
    toast.success("Zapisano");
  };

  return (
    <section className="rounded-md border border-foreground/10 bg-background shadow-soft">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold tracking-tight">
              Integracja TikTok Ads
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Połącz konto TikTok Ads, aby tworzyć, publikować i zarządzać kampaniami TikTok z tej
              platformy — obok Meta i LinkedIn.
            </p>
          </div>
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
              comingSoon && !conn
                ? "bg-violet-50 text-violet-700 border-violet-600/20 dark:bg-violet-950/40 dark:text-violet-300"
                : statusOk
                  ? "bg-emerald-50 text-emerald-700 border-emerald-600/20"
                  : conn
                    ? "bg-amber-50 text-amber-700 border-amber-600/20"
                    : "bg-muted text-muted-foreground border-foreground/10"
            }`}
          >
            {comingSoon && !conn ? "Wkrótce" : statusLabel}
          </span>
        </div>

        {loading ? (
          <div className="mt-6 text-sm text-muted-foreground">Ładowanie…</div>
        ) : !conn ? (
          <div className="mt-6">
            {comingSoon ? (
              <p className="text-sm text-muted-foreground">
                Integracja TikTok Ads będzie dostępna <span className="font-semibold text-foreground">wkrótce</span>.
              </p>
            ) : (
              <>
                <button
                  onClick={connect}
                  className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .59.04.86.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z" />
                  </svg>
                  Połącz TikTok Ads
                </button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Zalogujesz się na <strong>swoje</strong> konto TikTok for Business i wybierzesz konto
                  reklamowe (advertiser).
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-foreground/10 bg-muted/20 p-4">
              <div className="text-sm">
                Połączono jako:{" "}
                <span className="font-semibold">
                  {conn.advertiser_name ?? conn.tiktok_advertiser_id}
                </span>
              </div>
              {conn.token_expires_at && (
                <div className="text-xs text-muted-foreground mt-1">
                  Token wygasa: {new Date(conn.token_expires_at).toLocaleDateString("pl-PL")}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Konto reklamowe (advertiser)
              </label>
              <select
                value={conn.selected_advertiser_id ?? ""}
                onChange={(e) => updateField({ selected_advertiser_id: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
              >
                <option value="">— wybierz —</option>
                {conn.advertiser_accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? a.id} {a.currency ? `(${a.currency})` : ""}
                  </option>
                ))}
              </select>
              {conn.advertiser_accounts.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Nie znaleziono kont reklamowych. Upewnij się, że masz dostęp w TikTok Ads Manager.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={connect}
                className="text-xs font-semibold px-3 py-2 rounded-md border border-foreground/10 hover:bg-muted/50"
              >
                {tokenExpired ? "Połącz ponownie" : "Odśwież / wybierz inne konto"}
              </button>
              <button
                onClick={disconnect}
                className="text-xs font-semibold px-3 py-2 rounded-md border border-red-600/20 text-red-700 hover:bg-red-50"
              >
                Odłącz
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}