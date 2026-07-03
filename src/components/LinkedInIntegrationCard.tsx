import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { saveIntegrationConnectionRow } from "@/lib/integrationConnectionSave";
import { isAdPlatformComingSoon } from "@/lib/adPlatform";
import { toast } from "sonner";

type AdAccount = { id: string; name?: string; currency?: string; status?: string };
type Org = { id: string; name?: string };

type Connection = {
  id: string;
  linkedin_user_id: string;
  linkedin_user_name: string | null;
  token_expires_at: string | null;
  ad_accounts: AdAccount[];
  organizations: Org[];
  selected_ad_account_id: string | null;
  selected_organization_id: string | null;
};

type OAuthConfig = { clientId: string; redirectUri: string };

export function LinkedInIntegrationCard() {
  const comingSoon = isAdPlatformComingSoon("linkedin");
  const [loading, setLoading] = useState(true);
  const [conn, setConn] = useState<Connection | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [oauthCfg, setOauthCfg] = useState<OAuthConfig | null>(null);
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
      .from("linkedin_connections")
      .select("*")
      .eq("user_id", u.user.id)
      .order("updated_at", { ascending: false })
      .limit(1);
    setConn((((data ?? [])[0] as unknown) as Connection | undefined) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "linkedin-oauth") {
        if (ev.data.ok) {
          toast.success(`Połączono z LinkedIn${ev.data.name ? ` jako ${ev.data.name}` : ""}`);
          load();
        } else {
          toast.error(`Błąd połączenia: ${ev.data.error}`);
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const connect = async (forceLogin = false) => {
    if (!userId) {
      toast.message("Zaloguj się, aby połączyć LinkedIn");
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
    const url = `/api/public/linkedin/start?token=${encodeURIComponent(token)}${forceLogin ? "&force_login=1" : ""}`;
    toast.message(
      forceLogin ? "Otwieram wybór konta LinkedIn…" : "Przekierowuję do logowania LinkedIn…",
    );
    window.location.assign(url);
  };

  const disconnect = async () => {
    if (!conn) return;
    if (!confirm("Odłączyć konto LinkedIn?")) return;
    const { error } = await supabase.from("linkedin_connections").delete().eq("id", conn.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Odłączono LinkedIn");
    setConn(null);
  };

  const updateField = async (patch: Partial<Connection>) => {
    if (!conn) return;
    const r = await saveIntegrationConnectionRow("linkedin_connections", conn.id, patch);
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
              Integracja LinkedIn Ads
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Połącz konto LinkedIn, aby agent NOW mógł czytać kampanie i zarządzać reklamami
              Sponsored Content.
            </p>
          </div>
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
              comingSoon && !conn
                ? "bg-violet-50 text-violet-700 border-violet-600/20 dark:bg-violet-950/40 dark:text-violet-300"
                : conn
                  ? "bg-emerald-50 text-emerald-700 border-emerald-600/20"
                  : "bg-muted text-muted-foreground border-foreground/10"
            }`}
          >
            {comingSoon && !conn ? "Wkrótce" : conn ? "Połączono" : "Nie połączono"}
          </span>
        </div>

        {loading ? (
          <div className="mt-6 text-sm text-muted-foreground">Ładowanie…</div>
        ) : !conn ? (
          <div className="mt-6">
            {comingSoon ? (
              <p className="text-sm text-muted-foreground">
                Integracja LinkedIn Ads będzie dostępna <span className="font-semibold text-foreground">wkrótce</span> — pozwoli
                automatycznie publikować i zarządzać kampaniami bezpośrednio z panelu. Już teraz możesz przygotować szkice kampanii.
              </p>
            ) : (
              <>
                <button
                  onClick={() => connect(false)}
                  className="inline-flex items-center gap-2 rounded-md bg-[#0A66C2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#08539e] transition"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
                  </svg>
                  Połącz z LinkedIn
                </button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Zalogujesz się na <strong>swoje</strong> konto LinkedIn. Wybierzesz, do których kont
                  reklamowych damy dostęp.
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
                  {conn.linkedin_user_name ?? conn.linkedin_user_id}
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
                Konto reklamowe
              </label>
              <select
                value={conn.selected_ad_account_id ?? ""}
                onChange={(e) => updateField({ selected_ad_account_id: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
              >
                <option value="">— wybierz —</option>
                {conn.ad_accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? a.id} {a.currency ? `(${a.currency})` : ""}
                  </option>
                ))}
              </select>
              {conn.ad_accounts.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Nie znaleziono kont reklamowych. Upewnij się, że masz dostęp w LinkedIn Campaign
                  Manager.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Strona firmy (do publikacji Sponsored Content)
              </label>
              <select
                value={conn.selected_organization_id ?? ""}
                onChange={(e) => updateField({ selected_organization_id: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
              >
                <option value="">— wybierz —</option>
                {conn.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name ?? o.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => connect(false)}
                className="text-xs font-semibold px-3 py-2 rounded-md border border-foreground/10 hover:bg-muted/50"
              >
                Połącz ponownie / odśwież token
              </button>
              <button
                onClick={() => connect(true)}
                className="text-xs font-semibold px-3 py-2 rounded-md border border-foreground/10 hover:bg-muted/50"
              >
                Wybierz inne konto
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
