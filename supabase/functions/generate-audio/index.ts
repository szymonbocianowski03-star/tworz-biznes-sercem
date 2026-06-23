import {
  assertFreeAiAllowed,
  corsHeaders,
  finalizeAiUsage,
  getServiceClient,
  requireUser,
} from "../_shared/aiUsage.ts";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

/** Dozwolone modele ElevenLabs — domyślnie wielojęzyczny v2 (obsługuje polski). */
const ALLOWED_MODELS = new Set([
  "eleven_multilingual_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2_5",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userOrResp = await requireUser(req);
    if (userOrResp instanceof Response) return userOrResp;
    const user = userOrResp;

    const KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!KEY) {
      return new Response(
        JSON.stringify({
          error: "Brak klucza ElevenLabs (ELEVENLABS_API_KEY w sekretach Edge Function).",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return new Response(JSON.stringify({ error: "Wpisz tekst do wygenerowania głosu." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Tekst jest za długi (maks. 5000 znaków na jedną generację)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const voiceId = typeof body.voiceId === "string" && body.voiceId.trim()
      ? body.voiceId.trim()
      : "21m00Tcm4TlvDq8ikWAM"; // Rachel
    const voiceName = typeof body.voiceName === "string" ? body.voiceName.trim().slice(0, 120) : null;
    const modelId = typeof body.modelId === "string" && ALLOWED_MODELS.has(body.modelId)
      ? body.modelId
      : "eleven_multilingual_v2";
    const stability = Number.isFinite(Number(body.stability)) ? Math.min(1, Math.max(0, Number(body.stability))) : 0.5;
    const similarity = Number.isFinite(Number(body.similarity)) ? Math.min(1, Math.max(0, Number(body.similarity))) : 0.75;
    const productName = typeof body.productName === "string" ? body.productName.trim().slice(0, 255) : null;
    const campaignName = typeof body.campaignName === "string" ? body.campaignName.trim().slice(0, 255) : null;

    const capBlock = await assertFreeAiAllowed(user.id);
    if (capBlock) return capBlock;

    const admin = getServiceClient();

    const { data: inserted, error: insErr } = await admin
      .from("generated_audios")
      .insert({
        user_id: user.id,
        prompt: text,
        voice: voiceId,
        voice_name: voiceName,
        status: "pending",
        user_reaction: "none",
        product_name: productName,
        campaign_name: campaignName,
      })
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      console.error("generated_audios insert", insErr);
      return new Response(JSON.stringify({ error: "Nie udało się utworzyć rekordu dźwięku." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rowId = inserted.id as string;

    let elRes: Response;
    try {
      elRes = await fetch(`${ELEVENLABS_BASE}/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        headers: {
          "xi-api-key": KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: { stability, similarity_boost: similarity },
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markFailed(admin, rowId, `Błąd połączenia z ElevenLabs: ${msg}`);
      return failRow(admin, rowId);
    }

    if (!elRes.ok) {
      const errText = await elRes.text();
      console.error("ElevenLabs error", elRes.status, errText);
      const hint = elRes.status === 401
        ? "Nieprawidłowy klucz ElevenLabs (ELEVENLABS_API_KEY)."
        : elRes.status === 422
        ? "ElevenLabs odrzucił żądanie — sprawdź ID głosu lub model."
        : `ElevenLabs zwrócił błąd HTTP ${elRes.status}.`;
      await markFailed(admin, rowId, `${hint} ${errText}`.slice(0, 800));
      return failRow(admin, rowId);
    }

    const buf = new Uint8Array(await elRes.arrayBuffer());
    const storagePath = `${user.id}/audios/${rowId}.mp3`;
    const { error: upErr } = await admin.storage.from("generations").upload(storagePath, buf, {
      contentType: "audio/mpeg",
      upsert: true,
    });
    if (upErr) {
      console.error("audio storage upload", upErr);
      await markFailed(admin, rowId, upErr.message ?? "Upload do storage nie powiódł się.");
      return failRow(admin, rowId);
    }

    const pub = admin.storage.from("generations").getPublicUrl(storagePath);
    const audioUrl = pub.data.publicUrl;

    await admin
      .from("generated_audios")
      .update({
        status: "succeeded",
        audio_url: audioUrl,
        storage_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId);

    await finalizeAiUsage({
      userId: user.id,
      source: "generate-audio",
      extraDetail: { storagePath, provider: "elevenlabs", model: modelId, voiceId },
    });

    const { data: doneRow } = await admin.from("generated_audios").select("*").eq("id", rowId).single();
    return new Response(JSON.stringify({ audio: doneRow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-audio", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function markFailed(
  admin: ReturnType<typeof getServiceClient>,
  rowId: string,
  detail: string,
) {
  await admin
    .from("generated_audios")
    .update({ status: "failed", error_detail: detail, updated_at: new Date().toISOString() })
    .eq("id", rowId);
}

async function failRow(admin: ReturnType<typeof getServiceClient>, rowId: string) {
  const { data: row } = await admin.from("generated_audios").select("*").eq("id", rowId).single();
  return new Response(JSON.stringify({ audio: row, error: row?.error_detail ?? "Generacja nie powiodła się." }), {
    status: 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
