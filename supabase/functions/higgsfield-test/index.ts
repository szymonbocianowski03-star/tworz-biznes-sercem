import {
  getHiggsfieldCredentials,
  higgsfieldAuthHeader,
  higgsfieldPollStatus,
  extractHiggsfieldVideoUrl,
  normHiggsfieldStatus,
} from "../_shared/higgsfield.ts";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const creds = getHiggsfieldCredentials();
  if (!creds) return new Response(JSON.stringify({ ok: false, reason: "no creds" }), { headers: { ...cors, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return new Response(JSON.stringify({ ok: false, reason: "no id" }), { headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const status = await higgsfieldPollStatus(creds, id);
    const norm = normHiggsfieldStatus(status.status);
    const url = extractHiggsfieldVideoUrl(status);
    return new Response(JSON.stringify({ ok: true, norm, url, raw: status }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});
