import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { canUseLovableBrokerOnLocalhost, isLovableHostedAuth } from "@/lib/lovableAppUrl";

export type GoogleSignInResult =
  | { error: null; redirected: true }
  | { error: null; redirected: false }
  | { error: Error; redirected: false };

export const GOOGLE_AUTH_NOT_CONFIGURED =
  "google_not_configured: Dodaj do .env publiczny adres podglądu aplikacji (VITE_LOVABLE_APP_URL) albo skopiuj GOOGLE_OAUTH_* do lokalnego .env.";

export { isLovableHostedAuth } from "@/lib/lovableAppUrl";

async function signInWithLovableGoogle(redirectTo: string): Promise<GoogleSignInResult> {
  const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectTo });
  if (result.error) return { error: result.error, redirected: false };
  if (result.redirected) return { error: null, redirected: true };
  return { error: null, redirected: false };
}

async function signInWithSupabaseGoogle(redirectTo: string): Promise<GoogleSignInResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) return { error, redirected: false };
  if (data.url) {
    window.location.href = data.url;
    return { error: null, redirected: true };
  }
  return { error: new Error("Nie udało się rozpocząć logowania Google."), redirected: false };
}

type GoogleAuthStatus = {
  mode?: "local" | "supabase" | "none";
  localConfigured?: boolean;
  supabaseGoogleReady?: boolean;
};

/**
 * Logowanie Google:
 * - *.lovable.app lub localhost + VITE_LOVABLE_APP_URL → broker Lovable (sekrety w chmurze)
 * - localhost + GOOGLE_OAUTH_* w .env → serwerowy OAuth
 * - localhost + Google w Supabase Dashboard → Supabase OAuth
 */
export async function signInWithGoogle(redirectPath = "/auth"): Promise<GoogleSignInResult> {
  const redirectTo = `${window.location.origin}${redirectPath}`;

  if (isLovableHostedAuth() || canUseLovableBrokerOnLocalhost()) {
    return signInWithLovableGoogle(redirectTo);
  }

  let status: GoogleAuthStatus = { mode: "none" };
  try {
    const qs = new URLSearchParams({ redirect_to: redirectPath });
    const statusRes = await fetch(`/api/public/auth/google/status?${qs}`);
    if (statusRes.ok) status = (await statusRes.json()) as GoogleAuthStatus;
  } catch {
    /* brak statusu */
  }

  if (status.mode === "local" || status.localConfigured) {
    const qs = new URLSearchParams({ redirect_to: redirectPath });
    window.location.href = `/api/public/auth/google/start?${qs.toString()}`;
    return { error: null, redirected: true };
  }

  if (status.mode === "supabase" || status.supabaseGoogleReady) {
    return signInWithSupabaseGoogle(redirectTo);
  }

  return { error: new Error(GOOGLE_AUTH_NOT_CONFIGURED), redirected: false };
}
