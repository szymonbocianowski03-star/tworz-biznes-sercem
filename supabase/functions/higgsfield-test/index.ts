import {
  getHiggsfieldCredentials,
  higgsfieldAuthHeader,
} from "../_shared/higgsfield.ts";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const creds = getHiggsfieldCredentials();
  if (!creds) {
    return new Response(JSON.stringify({ ok: false, reason: "no creds" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const origin =
    Deno.env.get("HIGGSFIELD_API_BASE_URL")?.trim() ||
    Deno.env.get("HIGGSFIELD_API_ORIGIN")?.trim() ||
    "https://platform.higgsfield.ai";
  const endpoint = "/kling-video/v2.5-turbo/pro/text-to-video";
  const body = {
    prompt: "A golden retriever running through a field of wildflowers",
    duration: 5,
    cfg_scale: 0.5,
    negative_prompt: "",
    aspect_ratio: "9:16",
  };
  let withAspect = "";
  let withoutAspect = "";
  try {
    const r = await fetch(`${origin}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: higgsfieldAuthHeader(creds),
        "Content-Type": "application/json",
        "User-Agent": "higgsfield-server-js/2.0",
      },
      body: JSON.stringify(body),
    });
    withAspect = `HTTP ${r.status}: ${(await r.text()).slice(0, 600)}`;
  } catch (e) {
    withAspect = `THROW: ${e instanceof Error ? e.message : String(e)}`;
  }
  try {
    const { aspect_ratio: _drop, ...noAspect } = body;
    const r2 = await fetch(`${origin}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: higgsfieldAuthHeader(creds),
        "Content-Type": "application/json",
        "User-Agent": "higgsfield-server-js/2.0",
      },
      body: JSON.stringify(noAspect),
    });
    withoutAspect = `HTTP ${r2.status}: ${(await r2.text()).slice(0, 600)}`;
  } catch (e) {
    withoutAspect = `THROW: ${e instanceof Error ? e.message : String(e)}`;
  }
  return new Response(
    JSON.stringify({
      ok: true,
      origin,
      keyIdPrefix: creds.keyId.slice(0, 6),
      withAspect,
      withoutAspect,
    }, null, 2),
    { headers: { ...cors, "Content-Type": "application/json" } },
  );
});
