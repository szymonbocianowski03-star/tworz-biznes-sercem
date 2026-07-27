/** Czy lokalny serwer ma pełną konfigurację do logowania Google (OAuth + sesja Supabase). */
export function isLocalGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

function supabasePublicEnv(): { url: string; anonKey: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const anonKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
}

/** Czy Google OAuth jest włączony w Supabase (Client ID + Secret w Dashboard). */
export async function isSupabaseGoogleProviderReady(redirectTo: string): Promise<boolean> {
  const env = supabasePublicEnv();
  if (!env) return false;

  try {
    const authorizeUrl = new URL(`${env.url}/auth/v1/authorize`);
    authorizeUrl.searchParams.set("provider", "google");
    authorizeUrl.searchParams.set("redirect_to", redirectTo);

    const res = await fetch(authorizeUrl.toString(), {
      headers: { apikey: env.anonKey, Authorization: `Bearer ${env.anonKey}` },
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) return true;

    if (res.status === 400) {
      const body = (await res.json().catch(() => ({}))) as { msg?: string };
      const msg = (body.msg ?? "").toLowerCase();
      if (msg.includes("missing oauth secret") || msg.includes("unsupported provider")) return false;
    }
    return false;
  } catch {
    return false;
  }
}
