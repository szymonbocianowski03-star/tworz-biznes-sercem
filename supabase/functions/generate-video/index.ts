import {
  assertFreeAiAllowed,
  corsHeaders,
  finalizeAiUsage,
  getServiceClient,
  requireUser,
} from "../_shared/aiUsage.ts";
import {
  buildVideoPrompt,
  extractHiggsfieldVideoUrl,
  getHiggsfieldCredentials,
  higgsfieldPollStatus,
  higgsfieldStartVideo,
  normHiggsfieldStatus,
  ratioToAspectRatio,
  resolveVideoEndpoint,
} from "../_shared/higgsfield.ts";

async function persistVideoFromRemote(
  admin: ReturnType<typeof getServiceClient>,
  userId: string,
  rowId: string,
  remoteUrl: string,
  prompt: string,
  taskId: string,
) {
  const vf = await fetch(remoteUrl);
  if (!vf.ok) {
    const t = await vf.text();
    console.error("Video download", vf.status, t);
    await admin
      .from("generated_videos")
      .update({
        status: "failed",
        error_detail: `Pobieranie pliku: HTTP ${vf.status}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId);
    const { data: failedRow } = await admin.from("generated_videos").select("*").eq("id", rowId).single();
    return failedRow;
  }

  const buf = new Uint8Array(await vf.arrayBuffer());
  const storagePath = `${userId}/videos/${rowId}.mp4`;
  const { error: upErr } = await admin.storage.from("generations").upload(storagePath, buf, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (upErr) {
    console.error("Storage upload", upErr);
    await admin
      .from("generated_videos")
      .update({
        status: "failed",
        error_detail: upErr.message ?? "Upload do storage nie powiódł się.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId);
    const { data: failedRow } = await admin.from("generated_videos").select("*").eq("id", rowId).single();
    return failedRow;
  }

  const pub = admin.storage.from("generations").getPublicUrl(storagePath);
  const videoUrl = pub.data.publicUrl;

  await admin
    .from("generated_videos")
    .update({
      status: "succeeded",
      video_url: videoUrl,
      storage_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId);

  await finalizeAiUsage({
    userId,
    source: "generate-video",
    extraDetail: { externalTaskId: taskId, storagePath, provider: "higgsfield" },
  });

  const { data: doneRow } = await admin.from("generated_videos").select("*").eq("id", rowId).single();
  return doneRow;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userOrResp = await requireUser(req);
    if (userOrResp instanceof Response) return userOrResp;
    const user = userOrResp;

    const creds = getHiggsfieldCredentials();
    if (!creds) {
      return new Response(
        JSON.stringify({
          error:
            "Brak kluczy Higgsfield (HIGGSFIELD_API_KEY_ID + HIGGSFIELD_API_SECRET w sekretach Edge Function).",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "start";

    const admin = getServiceClient();

    if (action === "poll") {
      const id = typeof body.id === "string" ? body.id : "";
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: row, error: fetchErr } = await admin
        .from("generated_videos")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchErr || !row) {
        return new Response(JSON.stringify({ error: "Nie znaleziono nagrania." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (row.status === "succeeded" && row.video_url) {
        return new Response(JSON.stringify({ video: row }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (row.status === "failed") {
        return new Response(JSON.stringify({ video: row }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const taskId = row.runway_task_id as string | null;
      if (!taskId) {
        return new Response(JSON.stringify({ error: "Brak identyfikatora zadania u dostawcy wideo." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let statusResp;
      try {
        statusResp = await higgsfieldPollStatus(creds, taskId);
      } catch (e) {
        console.error("higgsfield poll", e);
        return new Response(
          JSON.stringify({ error: "Błąd odpytywania statusu wideo.", details: e instanceof Error ? e.message : String(e) }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const st = normHiggsfieldStatus(statusResp.status);
      if (st === "failed" || st === "nsfw" || st === "cancelled" || st === "canceled") {
        const failDetail =
          typeof statusResp.error === "string"
            ? statusResp.error
            : st === "nsfw"
            ? "Treść odrzucona przez moderację Higgsfield."
            : JSON.stringify(statusResp).slice(0, 500);
        await admin
          .from("generated_videos")
          .update({
            status: "failed",
            error_detail: failDetail,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        const { data: failedRow } = await admin.from("generated_videos").select("*").eq("id", id).single();
        return new Response(JSON.stringify({ video: failedRow }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (st !== "completed" && st !== "succeeded" && st !== "success") {
        return new Response(JSON.stringify({ video: { ...row, providerStatus: statusResp.status } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const remoteUrl = extractHiggsfieldVideoUrl(statusResp);
      if (!remoteUrl) {
        await admin
          .from("generated_videos")
          .update({
            status: "failed",
            error_detail: "Brak adresu pliku wideo w odpowiedzi Higgsfield.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
        const { data: failedRow } = await admin.from("generated_videos").select("*").eq("id", id).single();
        return new Response(JSON.stringify({ video: failedRow }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const prompt = (row.prompt as string) ?? "";
      const doneRow = await persistVideoFromRemote(admin, user.id, id, remoteUrl, prompt, taskId);
      return new Response(JSON.stringify({ video: doneRow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- start ---
    const capBlock = await assertFreeAiAllowed(user.id);
    if (capBlock) return capBlock;

    const promptRaw = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!promptRaw) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ratio = typeof body.ratio === "string" && body.ratio.includes(":")
      ? body.ratio
      : "1280:720";
    const duration = Math.min(10, Math.max(2, Number(body.duration) || 5));
    const model = typeof body.model === "string" ? body.model : undefined;
    const style = typeof body.style === "string" ? body.style : undefined;
    const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : undefined;
    const productName = typeof body.productName === "string" ? body.productName.trim().slice(0, 255) : null;
    const campaignName = typeof body.campaignName === "string" ? body.campaignName.trim().slice(0, 255) : null;

    if (style === "image-animate" && !imageUrl) {
      return new Response(
        JSON.stringify({
          error:
            "Styl „Animacja zdjęcia → wideo” wymaga obrazu startowego. Wybierz grafikę z galerii lub zmień styl na UGC / reklamę produktu.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prompt = buildVideoPrompt(promptRaw, style);
    const aspectRatio = ratioToAspectRatio(ratio);
    const endpoint = resolveVideoEndpoint(model, Boolean(imageUrl));

    const { data: inserted, error: insErr } = await admin
      .from("generated_videos")
      .insert({
        user_id: user.id,
        prompt,
        status: "pending",
        user_reaction: "none",
        product_name: productName || null,
        campaign_name: campaignName || null,
      })
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      console.error("generated_videos insert", insErr);
      return new Response(JSON.stringify({ error: "Nie udało się utworzyć rekordu wideo." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rowId = inserted.id as string;

    let requestId: string;
    try {
      const started = await higgsfieldStartVideo(creds, {
        endpoint,
        prompt,
        duration,
        aspectRatio,
        imageUrl,
      });
      requestId = started.requestId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("higgsfield start", msg);
      await admin
        .from("generated_videos")
        .update({
          status: "failed",
          error_detail: msg.slice(0, 800),
          updated_at: new Date().toISOString(),
        })
        .eq("id", rowId);
      const status = msg.includes("401") ? 401 : msg.includes("403") ? 403 : 500;
      return new Response(JSON.stringify({ error: "Błąd generacji wideo (Higgsfield).", details: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("generated_videos")
      .update({
        runway_task_id: requestId,
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId);

    return new Response(
      JSON.stringify({ id: rowId, runwayTaskId: requestId, status: "processing", provider: "higgsfield" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-video", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
