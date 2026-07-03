/**
 * Publiczny URL Supabase i klucz anon — musi być zgodny z logiką w `client.ts`
 * (VITE_* w bundlu Vite + opcjonalny fallback `process.env` przy SSR / hostingu).
 */
const LOVABLE_CLOUD_PUBLIC_URL = "https://duiewujiettffofdejor.supabase.co";
const LOVABLE_CLOUD_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aWV3dWppZXR0ZmZvZmRlam9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDUyNzIsImV4cCI6MjA5MjcyMTI3Mn0.p_wWV9PpHrhSZ1HjxSVgiOPiHiBtbZenBWDSXPJDUH0";

/** Placeholdery z .env.example — nie działają i blokują fallback z Lovable Cloud. */
function isPlaceholderSupabaseUrl(url: string | undefined): boolean {
  if (!url) return true;
  const u = url.trim().toLowerCase();
  return u.includes("xxxxxxxx") || u.includes("your-project") || u === "https://xxxxxxxx.supabase.co";
}

function isPlaceholderSupabaseKey(key: string | undefined): boolean {
  if (!key) return true;
  const k = key.trim();
  // skrócony przykład z .env.example kończy się na "..."
  if (k.endsWith("...")) return true;
  // pełny JWT ma 3 segmenty oddzielone kropkami
  return k.split(".").length < 3;
}

function pickEnv(
  viteValue: string | undefined,
  processValue: string | undefined,
  fallback: string,
  isValid: (v: string | undefined) => boolean,
): string | undefined {
  for (const candidate of [viteValue, processValue, fallback]) {
    if (isValid(candidate)) return candidate?.trim();
  }
  return undefined;
}

export function getSupabasePublicEnv(): {
  url: string | undefined;
  anonKey: string | undefined;
} {
  const url = pickEnv(
    import.meta.env.VITE_SUPABASE_URL as string | undefined,
    typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined,
    LOVABLE_CLOUD_PUBLIC_URL,
    (v) => !isPlaceholderSupabaseUrl(v),
  );
  const anonKey = pickEnv(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
    typeof process !== "undefined"
      ? process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
      : undefined,
    LOVABLE_CLOUD_PUBLISHABLE_KEY,
    (v) => !isPlaceholderSupabaseKey(v),
  );
  return { url, anonKey };
}

export function hasSupabasePublicEnv(): boolean {
  const { url, anonKey } = getSupabasePublicEnv();
  return Boolean(url && anonKey);
}

/** Bazowy origin bez końcowego slasha — pusty string, gdy brak URL. */
export function getSupabaseOrigin(): string {
  const { url } = getSupabasePublicEnv();
  return url ? url.replace(/\/$/, "") : "";
}

/** Pełny adres Edge Function `functions/v1/<name>`. Pusty string przy braku URL. */
export function supabaseEdgeFunctionUrl(name: string): string {
  const origin = getSupabaseOrigin();
  if (!origin) return "";
  const n = name.replace(/^\//, "");
  return `${origin}/functions/v1/${n}`;
}
