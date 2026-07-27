import { toast } from "sonner";

export function isSupabaseSchemaMissingError(message: string): boolean {
  return /could not find the table|does not exist|schema cache/i.test(message);
}

let schemaToastShown = false;

/** Jednorazowy toast z instrukcją migracji zamiast surowego komunikatu PostgREST. */
export function toastSupabaseLoadError(error: { message: string }, area: string): void {
  if (isSupabaseSchemaMissingError(error.message)) {
    if (!schemaToastShown) {
      schemaToastShown = true;
      toast.error(
        `Baza Supabase wymaga migracji (${area}). W Dashboard → SQL Editor uruchom plik supabase/migrations/20260520160000_ensure_generated_assets_schema.sql albo w terminalu: supabase db push`,
        { duration: 12_000 },
      );
    }
    return;
  }
  toast.error(error.message);
}
