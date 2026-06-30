import { supabase } from "@/integrations/supabase/client";
import { isSupabaseSchemaMissingError } from "@/lib/supabaseSchemaHint";

const DEFAULT_WORKSPACE_NAME = "Przestrzeń";

/** Tworzy / znajduje przestrzeń roboczą kampanii bezpośrednio w Supabase (sesja użytkownika + RLS). */
export async function ensureCcWorkspaceClient(userId: string, name = DEFAULT_WORKSPACE_NAME): Promise<string> {
  const { data: existing, error: readErr } = await supabase
    .from("cc_workspace")
    .select("id")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();

  if (readErr) {
    if (isSupabaseSchemaMissingError(readErr.message)) {
      throw new Error(
        "Brak tabel modułu kampanii w bazie (cc_workspace). Uruchom migracje Supabase z folderu supabase/migrations/ — pliki campaign_composer.",
      );
    }
    throw new Error(readErr.message);
  }
  if (existing?.id) return existing.id;

  const { data: row, error: insertErr } = await supabase
    .from("cc_workspace")
    .insert({ user_id: userId, name })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      const { data: retry } = await supabase
        .from("cc_workspace")
        .select("id")
        .eq("user_id", userId)
        .eq("name", name)
        .maybeSingle();
      if (retry?.id) return retry.id;
    }
    if (isSupabaseSchemaMissingError(insertErr.message)) {
      throw new Error(
        "Brak tabel modułu kampanii w bazie (cc_workspace). Uruchom migracje Supabase z folderu supabase/migrations/ — pliki campaign_composer.",
      );
    }
    throw new Error(insertErr.message);
  }
  if (!row?.id) throw new Error("Nie udało się utworzyć przestrzeni roboczej kampanii.");
  return row.id;
}
