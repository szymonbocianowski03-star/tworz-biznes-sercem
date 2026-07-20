import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { saveIntegrationConnectionRow } from "@/lib/integrationConnectionSave";
import { MetaFacebookLoginButton } from "@/components/MetaFacebookLoginButton";
import { loadMetaFacebookSdk, getMetaFacebookLoginStatus, metaFacebookLogin, metaFacebookStatusLabel, type MetaFbLoginResponse, type MetaFbLoginStatus } from "@/lib/metaFacebookSdk";
import { isAdPlatformComingSoon } from "@/lib/adPlatform";
import { fetchOAuthHandoff } from "@/lib/oauthHandoffClient";
import { toast } from "sonner";

type AdAccount = {
  id: string;
  account_id?: string;
  name?: string;
  currency?: string;
  account_status?: number;
};

type Page = { id: string; name: string };

type Connection = {
  id: string;
  meta_user_id: string;
  meta_user_name: string | null;
  token_expires_at: string | null;
  ad_accounts: AdAccount[];
  pages: Page[];
  selected_ad_account_id: string | null;
  selected_page_id: string | null;
  pixel_id: string | null;
};

type OAuthAvailability = {
  canStart: boolean;
  canComplete: boolean;
  appId?: string | null;
  loginConfigId?: string | null;
};

export function MetaIntegrationCard() {
  const comingSoon = isAdPlatformComingSoon("meta");
  const [loading, setLoading] = useState(true);
  const [conn, setConn] = useState<Connection | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [oauthStatus, setOauthStatus] = useState<OAuthAvailability | null>(null);
  const [fbLoginStatus, setFbLoginStatus] = useState<MetaFbLoginStatus | null>(null);
  const [fbAuthResponse, setFbAuthResponse] = useState<MetaFbLoginResponse["authResponse"]>(null);
  const [fbLoginChecking, setFbLoginChecking] = useState(false);
  const navigate = useNavigate();

  const statusChangeCallback = useCallback((response: MetaFbLoginResponse) => {
    setFbLoginStatus(response.status);
    setFbAuthResponse(response.authResponse ?? null);
  }, []);

  const completeMetaOAuth = useCallback(async () => {
    if (!userId) {
      toast.message("Zaloguj się, aby połączyć Meta");
      navigate({ to: "/auth" });
      return;
    }
    if (oauthStatus && !oauthStatus.canStart) {
      toast.error(
        "Integracja Meta nie jest skonfigurowana na serwerze. Dodaj META_APP_ID i META_APP_SECRET do pliku .env i zrestartuj aplikację.",
        { duration: 8000 },
      );
      return;
    }
    const handoff = await fetchOAuthHandoff();
    if (!handoff) {
      toast.error("Sesja wygasła. Zaloguj się ponownie.");
      navigate({ to: "/auth" });
      return;
    }
    const url = `/api/public/meta/start?handoff=${encodeURIComponent(handoff)}`;
    toast.message("Przekierowuję do autoryzacji Meta (konta reklamowe)…");
    window.location.assign(url);
  }, [navigate, oauthStatus, userId]);

  /** checkLoginState() — callback z atrybutu onlogin przycisku Facebook Login. */
  const handleFacebookLoginStatusChange = useCallback(
    (response: MetaFbLoginResponse) => {
      statusChangeCallback(response);
      if (response.status === "connected") {
        toast.success("Zalogowano w Facebook");
        if (!conn) void completeMetaOAuth();
      } else if (response.status === "not_authorized") {
        toast.message("Zalogowano w Facebook — dokończ autoryzację kont reklamowych.");
      }
    },
    [conn, completeMetaOAuth, statusChangeCallback],
  );

  const checkFacebookLoginStatus = async (appId: string) => {
    setFbLoginChecking(true);
    try {
      const fb = await loadMetaFacebookSdk(appId);
      const response = await getMetaFacebookLoginStatus(fb);
      statusChangeCallback(response);
    } catch (e) {
      console.warn("[Meta FB SDK]", e);
      setFbLoginStatus(null);
      setFbAuthResponse(null);
    } finally {
      setFbLoginChecking(false);
    }
  };

  const loadOAuthConfig = async () => {
    try {
      const res = await fetch("/api/public/oauth/config");
      if (!res.ok) {
        setOauthStatus({ canStart: false, canComplete: false });
        return;
      }
      const json = (await res.json()) as { meta?: OAuthAvailability };
      setOauthStatus(json.meta ?? { canStart: false, canComplete: false });
    } catch {
      setOauthStatus({ canStart: false, canComplete: false });
    }
  };

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }
    setUserId(u.user.id);
    const { data, error } = await supabase
      .from("meta_connections")
      .select("*")
      .eq("user_id", u.user.id)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) {
      console.error("[meta_connections]", error);
      toast.error(`Nie udało się odczytać połączenia Meta: ${error.message}`);
    }
    setConn((((data ?? [])[0] as unknown) as Connection | undefined) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    void loadOAuthConfig();
  }, []);

  useEffect(() => {
    if (!oauthStatus?.appId) return;
    void checkFacebookLoginStatus(oauthStatus.appId);
  }, [oauthStatus?.appId]);

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "meta-oauth") {
        if (ev.data.ok) {
          toast.success(`Połączono z Meta jako ${ev.data.name}`);
          load();
        } else {
          toast.error(`Błąd połączenia: ${ev.data.error}`);
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const connect = async () => {
    if (!userId) {
      toast.message("Zaloguj się, aby połączyć Meta");
      navigate({ to: "/auth" });
      return;
    }
    if (oauthStatus && !oauthStatus.canStart) {
      toast.error(
        "Integracja Meta nie jest skonfigurowana na serwerze. Dodaj META_APP_ID i META_APP_SECRET do pliku .env i zrestartuj aplikację.",
        { duration: 8000 },
      );
      return;
    }

    if (oauthStatus?.appId) {
      try {
        const fb = await loadMetaFacebookSdk(oauthStatus.appId);
        let response = await getMetaFacebookLoginStatus(fb);
        statusChangeCallback(response);

        if (response.status !== "connected") {
          toast.message("Otwieram logowanie Facebook…");
          response = await metaFacebookLogin(fb);
          statusChangeCallback(response);
          if (response.status !== "connected") {
            if (response.status === "not_authorized") {
              toast.message("Zalogowano w Facebook — wymagana autoryzacja dostępu do kont reklamowych.");
            } else {
              toast.message("Anulowano logowanie Facebook.");
              return;
            }
          }
        }
      } catch (e) {
        console.warn("[Meta FB SDK login]", e);
      }
    }

    await completeMetaOAuth();
  };

  const disconnect = async () => {
    if (!conn) return;
    if (!confirm("Odłączyć konto Meta?")) return;
    const { error } = await supabase.from("meta_connections").delete().eq("id", conn.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Odłączono");
      setConn(null);
    }
  };

  const updateField = async (patch: Partial<Connection>) => {
    if (!conn) return;
    const r = await saveIntegrationConnectionRow("meta_connections", conn.id, patch);
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
              Integracja Meta Ads
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Połącz swoje konto Facebook / Instagram, aby agent NOW mógł czytać kampanie i publikować reklamy na Twoim koncie reklamowym.
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
        ) : comingSoon && !conn ? (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground">
              Integracja Meta Ads będzie dostępna <span className="font-semibold text-foreground">wkrótce</span> — pozwoli
              automatycznie publikować i zarządzać kampaniami bezpośrednio z panelu. Już teraz możesz przygotować szkice kampanii.
            </p>
          </div>
        ) : (
          <>
            {oauthStatus?.appId && (
              <div className="mt-4 rounded-lg border border-foreground/10 bg-muted/20 px-4 py-3 text-xs leading-relaxed">
                <p className="font-semibold text-foreground">Sesja Facebook (JS SDK)</p>
                {fbLoginChecking ? (
                  <p className="mt-1 text-muted-foreground">Sprawdzanie statusu logowania…</p>
                ) : fbLoginStatus ? (
                  <>
                    <p className="mt-1 text-muted-foreground">{metaFacebookStatusLabel(fbLoginStatus)}</p>
                    {fbLoginStatus === "connected" && fbAuthResponse?.userID && (
                      <p className="mt-1 text-muted-foreground">
                        Facebook user ID: <span className="font-mono">{fbAuthResponse.userID}</span>
                        {conn ? null : " — dokończ autoryzację kont reklamowych poniżej."}
                      </p>
                    )}
                    {fbLoginStatus === "not_authorized" && (
                      <p className="mt-1 text-muted-foreground">
                        Jesteś zalogowany w Facebook, ale aplikacja nie ma jeszcze uprawnień. Kliknij „Połącz z Facebook”.
                      </p>
                    )}
                    {fbLoginStatus === "unknown" && (
                      <p className="mt-1 text-muted-foreground">
                        Brak aktywnej sesji Facebook — użyj przycisku logowania poniżej.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-muted-foreground">Nie udało się odczytać statusu Facebook SDK.</p>
                )}
              </div>
            )}

            {!conn ? (
          <div className="mt-6">
            <div className="flex flex-col items-start gap-3">
              {oauthStatus?.appId && oauthStatus.canStart && (
                <MetaFacebookLoginButton
                  appId={oauthStatus.appId}
                  configId={oauthStatus.loginConfigId}
                  disabled={!oauthStatus.canStart}
                  onLoginStatusChange={handleFacebookLoginStatusChange}
                />
              )}
              <button
                onClick={connect}
                disabled={oauthStatus !== null && !oauthStatus.canStart}
                className="inline-flex items-center gap-2 rounded-md border border-foreground/10 bg-background px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Dokończ autoryzację kont reklamowych
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Użyj przycisku Facebook Login lub dokończ autoryzację, aby nadać dostęp do kont reklamowych. Możesz w każdej chwili odłączyć integrację.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-emerald-600/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
              <div className="text-sm">
                Połączono jako:{" "}
                <span className="font-semibold">{conn.meta_user_name ?? conn.meta_user_id}</span>
              </div>
              {conn.token_expires_at && (
                <div className="text-xs text-muted-foreground mt-1">
                  Token wygasa:{" "}
                  {new Date(conn.token_expires_at).toLocaleDateString("pl-PL")}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Konto reklamowe
              </label>
              <select
                value={conn.selected_ad_account_id ?? ""}
                onChange={(e) =>
                  updateField({ selected_ad_account_id: e.target.value })
                }
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
                  Nie znaleziono kont reklamowych. Upewnij się, że masz dostęp do Business Managera.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Strona Facebook (do publikacji reklam)
              </label>
              <select
                value={conn.selected_page_id ?? ""}
                onChange={(e) => updateField({ selected_page_id: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
              >
                <option value="">— wybierz —</option>
                {conn.pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {conn.pages.length === 0 && (
                <p className="mt-1.5 text-xs text-amber-700 leading-relaxed">
                  Nie znaleziono stron na Facebooku. Kliknij „Połącz ponownie / odśwież token” poniżej i zaakceptuj
                  dostęp do listy stron (pages_show_list) — wtedy strony pojawią się na liście.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pixel ID (opcjonalnie — do śledzenia konwersji)
              </label>
              <input
                type="text"
                defaultValue={conn.pixel_id ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (conn.pixel_id ?? "")) updateField({ pixel_id: v || null });
                }}
                placeholder="np. 1234567890"
                className="mt-1.5 w-full rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={connect}
                disabled={oauthStatus !== null && !oauthStatus.canStart}
                className="text-xs font-semibold px-3 py-2 rounded-md border border-foreground/10 hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Połącz ponownie / odśwież token
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
          </>
        )}
      </div>
    </section>
  );
}
