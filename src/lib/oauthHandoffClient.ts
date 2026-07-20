import { supabase } from "@/integrations/supabase/client";

/**
 * Exchange the current Supabase access token for a short-lived, single-purpose
 * handoff nonce. Use this instead of putting the access token itself into
 * OAuth start URLs (which would leak it to browser history / access logs).
 */
export async function fetchOAuthHandoff(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return null;
  try {
    const res = await fetch("/api/public/oauth/handoff", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { handoff?: string };
    return json.handoff ?? null;
  } catch {
    return null;
  }
}