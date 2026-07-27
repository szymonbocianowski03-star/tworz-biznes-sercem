import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Aktualizuje wiersz integracji i weryfikuje, że zapis faktycznie trafił do bazy (RLS / brak wiersza).
 */
export async function saveIntegrationConnectionRow<T extends Record<string, unknown>>(
  table:
    | "meta_connections"
    | "linkedin_connections"
    | "tiktok_connections"
    | "google_ads_connections"
    | "google_calendar_connections"
    | "gmail_connections"
    | "outlook_connections"
    | "outlook_calendar_connections",
  id: string,
  patch: Partial<T>,
): Promise<SaveResult> {
  const { data, error } = await (supabase as any).from(table).update(patch).eq("id", id).select("id").maybeSingle();
  if (error) return { ok: false, error: formatSaveError(error) };
  if (!data?.id) {
    return {
      ok: false,
      error: "Zapis nie trafił do bazy (brak uprawnień lub wygasła sesja). Odśwież stronę i zaloguj się ponownie.",
    };
  }
  return { ok: true };
}

function formatSaveError(error: PostgrestError): string {
  const msg = error.message ?? "Nie udało się zapisać.";
  if (error.code === "42501" || /row-level security|policy/i.test(msg)) {
    return "Brak uprawnień do zapisu integracji. Uruchom migrację Supabase (integration_update_rls_fix) lub skontaktuj się z administratorem.";
  }
  return msg;
}
