import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");
const examplePath = resolve(root, ".env.example");

const WORKING_ENV_BLOCK = `VITE_SUPABASE_URL=https://duiewujiettffofdejor.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aWV3dWppZXR0ZmZvZmRlam9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDUyNzIsImV4cCI6MjA5MjcyMTI3Mn0.p_wWV9PpHrhSZ1HjxSVgiOPiHiBtbZenBWDSXPJDUH0

VITE_LOVABLE_APP_URL=https://tworz-biznes-sercem.lovable.app

SUPABASE_URL=https://duiewujiettffofdejor.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aWV3dWppZXR0ZmZvZmRlam9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDUyNzIsImV4cCI6MjA5MjcyMTI3Mn0.p_wWV9PpHrhSZ1HjxSVgiOPiHiBtbZenBWDSXPJDUH0`;

function hasPlaceholderEnv(content) {
  return (
    content.includes("xxxxxxxx.supabase.co") ||
    /VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci[^.\n]*\.\.\./.test(content)
  );
}

function patchPlaceholderEnv(content) {
  let next = content;
  next = next.replace(
    /^VITE_SUPABASE_URL=.*$/m,
    "VITE_SUPABASE_URL=https://duiewujiettffofdejor.supabase.co",
  );
  next = next.replace(
    /^VITE_SUPABASE_PUBLISHABLE_KEY=.*$/m,
    "VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aWV3dWppZXR0ZmZvZmRlam9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDUyNzIsImV4cCI6MjA5MjcyMTI3Mn0.p_wWV9PpHrhSZ1HjxSVgiOPiHiBtbZenBWDSXPJDUH0",
  );
  if (!/^SUPABASE_URL=/m.test(next)) {
    next = `${WORKING_ENV_BLOCK}\n\n${next}`;
  }
  return next;
}

if (!existsSync(envPath)) {
  if (!existsSync(examplePath)) {
    writeFileSync(envPath, `${WORKING_ENV_BLOCK}\n`);
    console.warn("[ensure-env] Utworzono .env z domyślną konfiguracją Supabase (Lovable Cloud).");
    process.exit(0);
  }
  copyFileSync(examplePath, envPath);
  const created = readFileSync(envPath, "utf8");
  if (hasPlaceholderEnv(created)) {
    writeFileSync(envPath, patchPlaceholderEnv(created), "utf8");
    console.warn("[ensure-env] .env utworzony z .env.example — podmieniono placeholdery Supabase na działające wartości.");
  } else {
    console.warn("[ensure-env] Utworzono .env z .env.example.");
  }
  process.exit(0);
}

const existing = readFileSync(envPath, "utf8");
if (hasPlaceholderEnv(existing)) {
  writeFileSync(envPath, patchPlaceholderEnv(existing), "utf8");
  console.warn("[ensure-env] Naprawiono placeholdery Supabase w .env — zrestartuj npm run dev.");
}
