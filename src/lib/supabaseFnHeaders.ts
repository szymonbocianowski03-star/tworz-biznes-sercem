import { supabase } from "@/integrations/supabase/client";
import { getSupabasePublicEnv } from "@/integrations/supabase/publicEnv";

/** Nagłówki do wywołań Edge Functions (wymagana sesja użytkownika). */
export async function supabaseFnHeaders(): Promise<Record<string, string> | null> {
  const { anonKey: anon } = getSupabasePublicEnv();
  if (!anon) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
    apikey: anon,
  };
}
