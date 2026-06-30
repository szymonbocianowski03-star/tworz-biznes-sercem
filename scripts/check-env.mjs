import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(import.meta.dirname, "..", ".env");
if (!existsSync(envPath)) {
  console.log("BRAK_PLIKU_ENV");
  process.exit(1);
}
const p = readFileSync(envPath, "utf8");
for (const line of p.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (!m || !m[1].includes("SUPABASE")) continue;
  const k = m[1];
  const v = m[2].trim().replace(/^["']|["']$/g, "");
  let status = "puste";
  if (v.includes("xxxxxxxx")) status = "placeholder";
  else if (v.startsWith("https://") && k.includes("URL")) status = "url-ok";
  else if (v.startsWith("eyJ")) status = "jwt-ok";
  else if (v.length > 20) status = "ustawione";
  console.log(`${k}: ${status} (${v.length} znakow)`);
}
