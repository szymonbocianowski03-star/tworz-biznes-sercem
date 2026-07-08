import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Mail, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/signInWithGoogle";
import { hasSupabasePublicEnv } from "@/integrations/supabase/publicEnv";
import { MarketingNowLogo } from "@/components/MarketingNowLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Zaloguj się — MarketingNow" },
      { name: "description", content: "Zaloguj się lub załóż darmowe konto MarketingNow. Bez karty kredytowej." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const missingSupabase = !hasSupabasePublicEnv();

  useEffect(() => {
    if (missingSupabase || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) return;

    window.history.replaceState(null, "", window.location.pathname);
    setOauthLoading(true);

    let cancelled = false;
    void supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(async ({ error }) => {
        if (cancelled) return;
        if (error) throw error;

        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data.user) throw userError ?? new Error("Nie udało się potwierdzić sesji Google.");

        toast.success("Zalogowano przez Google.");
        navigate({ to: "/agent", replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(translateAuthError(err instanceof Error ? err.message : "Logowanie Google nie powiodło się."));
        setOauthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [missingSupabase, navigate]);

  useEffect(() => {
    if (missingSupabase) return;
    let mounted = true;
    let sub: { subscription: { unsubscribe: () => void } } | null = null;
    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        console.info("[auth] onAuthStateChange", event, !!session);
        if (session) navigate({ to: "/agent", replace: true });
      });
      sub = data;
    } catch {
      return () => {
        mounted = false;
      };
    }
    void supabase.auth.getSession().then(({ data }) => {
      console.info("[auth] getSession on mount", !!data.session);
      if (mounted && data.session) navigate({ to: "/agent", replace: true });
    });
    return () => {
      mounted = false;
      sub?.subscription.unsubscribe();
    };
  }, [navigate, missingSupabase]);

  /** Błędy OAuth czasem wracają w hash / query (np. anulowanie lub błąd serwera). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { hash, search } = window.location;
    const params = new URLSearchParams(search);
    let err = params.get("error_description") || params.get("error");
    if (!err && hash) {
      const h = hash.startsWith("#") ? hash.slice(1) : hash;
      const hp = new URLSearchParams(h);
      err = hp.get("error_description") || hp.get("error");
    }
    if (err) {
      toast.error(translateAuthError(decodeURIComponent(err.replace(/\+/g, " "))));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (missingSupabase) {
      toast.error(
        "Brak konfiguracji Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). Dodaj zmienne w pliku .env i zrestartuj serwer.",
      );
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined,
            data: {
              full_name: email.split("@")[0]?.trim() || email,
              marketing_consent: marketingConsent,
            },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Konto utworzone. Zalogowano.");
        } else {
          toast.success(
            "Konto utworzone. Sprawdź skrzynkę i kliknij link potwierdzający — dopiero potem zaloguj się hasłem.",
            { duration: 8000 },
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Zalogowano pomyślnie.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Coś poszło nie tak.";
      toast.error(translateAuthError(message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (oauthLoading || typeof window === "undefined") return;
    if (missingSupabase) {
      toast.error(
        "Brak konfiguracji Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). Uzupełnij zmienne środowiskowe.",
      );
      return;
    }
    setOauthLoading(true);
    try {
      const result = await signInWithGoogle("/auth");
      console.info("[auth] signInWithGoogle result", result);
      if (result.error) {
        toast.error(translateAuthError(result.error.message));
        setOauthLoading(false);
      } else if (!result.redirected) {
        // Popup / in-place flow: session is already set — navigate explicitly
        // instead of relying only on the onAuthStateChange listener.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate({ to: "/agent", replace: true });
        } else {
          setOauthLoading(false);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Logowanie Google nie powiodło się.";
      toast.error(translateAuthError(message));
      setOauthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (resetting) return;
    if (missingSupabase) {
      toast.error("Brak konfiguracji Supabase — nie można wysłać linku resetu.");
      return;
    }
    if (!email) {
      toast.error("Wpisz email powyżej, żeby wysłać link resetujący.");
      return;
    }
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Wysłaliśmy link do resetu hasła. Sprawdź skrzynkę (także spam).", { duration: 8000 });
    } catch (err) {
      toast.error(translateAuthError(err instanceof Error ? err.message : "Nie udało się wysłać linku."));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="collins-root relative min-h-screen bg-background text-foreground antialiased overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-hero-gradient pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] opacity-50 pointer-events-none" />

      <div className="relative z-10 w-full bg-foreground text-background text-center py-2 px-4 text-[11px] sm:text-xs leading-snug shrink-0">
        <Link to="/billing" className="font-semibold underline-offset-2 hover:underline">
          Zacznij za darmo
        </Link>
        {" — "}
        <span className="opacity-90">Konto Free bez karty kredytowej — płatność dopiero przy upgrade.</span>
      </div>

      <header className="relative z-10 border-b border-foreground/10 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="mx-auto max-w-6xl h-14 px-6 flex items-center justify-between gap-4">
          <MarketingNowLogo size="sm" className="text-foreground" />
          <Link
            to="/billing"
            className="text-sm font-semibold text-foreground hover:text-accent whitespace-nowrap"
          >
            Zacznij za darmo
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-md px-6 py-12 md:py-20 flex-1 w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-md border border-foreground/10 bg-background px-3.5 py-1.5 text-xs font-semibold text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Bez karty kredytowej
          </div>
          <h1 className="mt-6 serif text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.08] tracking-[-0.03em]">
            {mode === "signin" ? "Zaloguj się" : "Załóż darmowe konto"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Witaj z powrotem. Wracamy do Twoich kampanii."
              : "Pierwsza kampania gratis. Bez karty, bez zobowiązań."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="mt-10 rounded-md border border-foreground/10 bg-background p-6 md:p-8 shadow-soft"
        >
          {missingSupabase && (
            <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive">
              <p className="font-semibold">Brak połączenia z Supabase</p>
              <p className="mt-1 text-destructive/90 leading-relaxed">
                W projekcie nie widać <code className="rounded bg-background/80 px-1">VITE_SUPABASE_URL</code> ani{" "}
                <code className="rounded bg-background/80 px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code>. Ustaw je w panelu
                hostingu (Settings → Environment variables) albo lokalnie w pliku <code className="rounded bg-background/80 px-1">.env</code>, potem
                przebuduj / zrestartuj podgląd.
              </p>
            </div>
          )}
          <>
            <button
                type="button"
                onClick={handleGoogle}
                disabled={oauthLoading || loading || missingSupabase}
                className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 rounded-full border border-border bg-background hover:bg-muted transition-colors text-sm font-medium disabled:opacity-60"
              >
                {oauthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon className="h-4 w-4" />}
                Kontynuuj z Google
              </button>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex-1 h-px bg-border" />
                <span>lub przez email</span>
                <div className="flex-1 h-px bg-border" />
              </div>
          </>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Email</span>
              <div className="mt-1.5 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ty@firma.pl"
                  autoComplete="email"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Hasło</span>
              <div className="mt-1.5 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "min. 8 znaków" : "Twoje hasło"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="group w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity shadow-elevated disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "signin" ? "Zaloguj się" : "Załóż konto"}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {mode === "signin" && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetting}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-60"
              >
                {resetting ? "Wysyłam…" : "Zapomniałem hasła"}
              </button>
            </div>
          )}

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Nie masz konta?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-medium text-foreground hover:text-accent transition-colors"
                >
                  Załóż za darmo
                </button>
              </>
            ) : (
              <>
                Masz już konto?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-medium text-foreground hover:text-accent transition-colors"
                >
                  Zaloguj się
                </button>
              </>
            )}
          </div>
        </motion.div>

        <p className="mt-8 text-center text-xs text-muted-foreground leading-relaxed">
          Zakładając konto akceptujesz{" "}
          <Link to="/regulamin" className="underline hover:text-foreground">Regulamin</Link>
          {" "}oraz{" "}
          <Link to="/polityka-prywatnosci" className="underline hover:text-foreground">Politykę prywatności</Link>.
        </p>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          <Link to="/program-partnerski" className="underline hover:text-foreground underline-offset-2">
            Program partnerski (prowizje za polecenia)
          </Link>
        </p>
      </main>

    </div>
  );
}

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email not confirmed") || lower.includes("not confirmed"))
    return "Email nie został potwierdzony. Sprawdź skrzynkę (także spam) i kliknij link z wiadomości, potem spróbuj zalogować się ponownie.";
  if (lower.includes("invalid login")) return "Niepoprawny email lub hasło.";
  if (lower.includes("user already registered")) return "Konto z tym emailem już istnieje. Zaloguj się.";
  if (lower.includes("password should be at least")) return "Hasło musi mieć co najmniej 8 znaków.";
  if (lower.includes("email rate limit")) return "Za dużo prób. Spróbuj ponownie za chwilę.";
  if (lower.includes("pwned") || lower.includes("compromised")) return "To hasło wyciekło w internecie. Wybierz inne.";
  if (lower.includes("google_not_configured"))
    return "Logowanie Google na localhost: dodaj do .env publiczny adres podglądu aplikacji (VITE_LOVABLE_APP_URL) i zrestartuj npm run dev. Alternatywnie skopiuj GOOGLE_OAUTH_* do lokalnego .env.";
  if (lower.includes("missing oauth secret") || lower.includes("unsupported provider"))
    return "Google nie ma Client Secret w Supabase (Authentication → Providers → Google). Albo skopiuj klucze OAuth do lokalnego .env — to szybsze niż konfiguracja w Supabase Dashboard.";
  if (lower.includes("google_auth_failed") || lower.includes("redirect_uri_mismatch"))
    return "Błąd logowania Google. Na localhost: uzupełnij klucze OAuth w .env i dodaj redirect URI http://localhost:8080/api/public/auth/google/callback w Google Cloud Console.";
  if (lower.includes("validation_failed") && lower.includes("oauth"))
    return "Błąd konfiguracji logowania Google w Supabase (np. brak Client Secret). Sprawdź Authentication → Providers → Google.";
  if (lower.includes("provider") && lower.includes("not enabled"))
    return "Logowanie Google jest wyłączone w projekcie. Włącz dostawcę Google w Supabase (Authentication → Providers).";
  if (lower.includes("redirect") && lower.includes("url"))
    return "Adres powrotu po logowaniu nie jest dozwolony. W Supabase → Authentication → URL Configuration dodaj: Site URL oraz Redirect URLs — np. http://localhost:8080/auth (lokalnie) i https://twoja-domena.pl/auth.";
  if (lower.includes("provider is not enabled") || (lower.includes("google") && lower.includes("disabled")))
    return "Włącz Google w Supabase: Authentication → Providers → Google (Client ID i Secret z Google Cloud Console).";
  if (lower.includes("failed to fetch") || lower.includes("network"))
    return "Brak połączenia z serwerem logowania. Sprawdź internet oraz czy adres Supabase w .env jest poprawny.";
  if (lower.includes("invalid api key") || lower.includes("jwt"))
    return "Nieprawidłowy klucz Supabase (VITE_SUPABASE_PUBLISHABLE_KEY). Sprawdź plik .env i zrestartuj serwer dev.";
  return message;
}

function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
