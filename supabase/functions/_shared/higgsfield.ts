function higgsfieldApiOrigin(): string {
  const base =
    Deno.env.get("HIGGSFIELD_API_BASE_URL")?.trim() ||
    Deno.env.get("HIGGSFIELD_API_ORIGIN")?.trim() ||
    "https://platform.higgsfield.ai";
  return base.replace(/\/$/, "");
}

const HIGGSFIELD_NEGATIVE_PROMPT_SHORT =
  "blur, distort, low quality, AI look, plastic skin, extra fingers, warped text, cartoon, CGI";

const KLING_MAX_PROMPT_CHARS = 2400;

const HIGGSFIELD_NEGATIVE_PROMPT =
  "Avoid: AI-generated look, plastic skin, over-smoothed face, uncanny eyes, extra fingers, distorted hands, warped product label, fake text, unreadable logo, overly cinematic lighting, stock photo look, perfect symmetry, unrealistic body proportions, over-polished commercial studio style, CGI avatar look, cartoonish animation, unnatural lip sync, frozen facial expression.";

const HIGGSFIELD_REALISM_SUFFIX =
  "Handheld phone camera, slight camera shake, natural lighting, real skin texture, imperfect framing, subtle asymmetry, casual background, natural blinking, small head movements, realistic hand gestures, believable facial expression, slight motion blur, no over-polished commercial look.";

export type HiggsfieldCredentials = {
  keyId: string;
  secret: string;
};

export type HiggsfieldStatusResponse = {
  status?: string;
  request_id?: string;
  video?: { url?: string };
  images?: Array<{ url?: string }>;
  error?: string;
  detail?: unknown;
};

export function getHiggsfieldCredentials(): HiggsfieldCredentials | null {
  const combined =
    Deno.env.get("HF_CREDENTIALS")?.trim() ||
    Deno.env.get("HIGGSFIELD_CREDENTIALS")?.trim();
  if (combined?.includes(":")) {
    const idx = combined.indexOf(":");
    const keyId = combined.slice(0, idx).trim();
    const secret = combined.slice(idx + 1).trim();
    if (keyId && secret) return { keyId, secret };
  }

  const keyId =
    Deno.env.get("HIGGSFIELD_API_KEY_ID")?.trim() ||
    Deno.env.get("HF_API_KEY")?.trim() ||
    Deno.env.get("HIGGSFIELD_API_KEY")?.trim();
  const secret =
    Deno.env.get("HIGGSFIELD_API_SECRET")?.trim() ||
    Deno.env.get("HF_API_SECRET")?.trim() ||
    Deno.env.get("HF_SECRET")?.trim();
  if (keyId && secret) return { keyId, secret };
  return null;
}

export function higgsfieldAuthHeader(creds: HiggsfieldCredentials): string {
  return `Key ${creds.keyId}:${creds.secret}`;
}

export function ratioToAspectRatio(ratio: string): string {
  switch (ratio) {
    case "720:1280":
      return "9:16";
    case "960:960":
      return "1:1";
    case "1280:720":
    default:
      return "16:9";
  }
}

/** Domyślny endpoint — tekst→wideo (Kling) lub obraz→wideo (DoP). */
export function resolveVideoEndpoint(model?: string, hasImage?: boolean): string {
  const m = (model ?? "").trim().toLowerCase();
  if (m.includes("seedance") && hasImage) return "bytedance/seedance/v1/pro/image-to-video";
  if (m.includes("seedance")) return "bytedance/seedance/v1/lite/text-to-video";
  if (m.includes("kling") && hasImage) return "kling-video/v2.5-turbo/pro/image-to-video";
  if (m.includes("kling")) return "kling-video/v2.5-turbo/pro/text-to-video";
  if (m.includes("hailuo") && hasImage) return "minimax/hailuo-2.3/standard/image-to-video";
  if (m.includes("hailuo")) return "minimax/hailuo-2.3/standard/text-to-video";
  if (m.includes("preview") || m.includes("dop-lite")) return "higgsfield-ai/dop/preview";
  // DoP standard/turbo wymaga image_url — nie używaj do samego tekstu.
  if (hasImage) return "higgsfield-ai/dop/standard";
  return "kling-video/v2.5-turbo/pro/text-to-video";
}

/** Kolejność prób — gdy pierwszy model zwróci błąd walidacji / 404. */
export function resolveVideoEndpointCandidates(model?: string, hasImage?: boolean): string[] {
  const primary = resolveVideoEndpoint(model, hasImage);
  if (hasImage) {
    return [
      primary,
      "higgsfield-ai/dop/standard",
      "kling-video/v2.5-turbo/pro/image-to-video",
      "bytedance/seedance/v1/pro/image-to-video",
    ].filter((v, i, a) => a.indexOf(v) === i);
  }
  return [
    primary,
    "minimax/hailuo-2.3/standard/text-to-video",
    "bytedance/seedance/v1/lite/text-to-video",
    "kling-video/v2.1/master/text-to-video",
  ].filter((v, i, a) => a.indexOf(v) === i);
}

export function formatHiggsfieldError(status: number, detail: unknown, rawText: string): string {
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (item && typeof item === "object" && "msg" in item) {
        const loc = Array.isArray((item as { loc?: unknown }).loc)
          ? (item as { loc: unknown[] }).loc.join(".")
          : "";
        return loc ? `${loc}: ${String((item as { msg: unknown }).msg)}` : String((item as { msg: unknown }).msg);
      }
      return JSON.stringify(item);
    });
    return `Higgsfield HTTP ${status}: ${parts.join("; ")}`;
  }
  if (typeof detail === "string" && detail.trim()) {
    return `Higgsfield HTTP ${status}: ${detail}`;
  }
  return `Higgsfield HTTP ${status}: ${rawText.slice(0, 500)}`;
}

function truncatePromptForEndpoint(prompt: string, endpoint: string): string {
  const max = endpoint.toLowerCase().includes("kling") ? KLING_MAX_PROMPT_CHARS : 6000;
  const p = prompt.trim();
  if (p.length <= max) return p;
  return `${p.slice(0, max - 1)}…`;
}

/** Higgsfield akceptuje wyłącznie duration: 5 lub 10 jako liczbę całkowitą (nie string). */
export function coerceHiggsfieldDuration(raw: unknown): 5 | 10 {
  let n: number;
  if (typeof raw === "string") {
    n = parseInt(raw.trim(), 10);
  } else {
    n = Number(raw);
  }
  if (!Number.isFinite(n)) return 5;
  return n > 7 ? 10 : 5;
}

/** Niektóre modele (np. Kling) akceptują tylko 5 lub 10 s. */
export function normalizeVideoDuration(duration: number, _endpoint?: string): 5 | 10 {
  return coerceHiggsfieldDuration(duration);
}

export function isTextToVideoEndpoint(endpoint: string): boolean {
  return endpoint.toLowerCase().includes("text-to-video");
}

export function buildVideoPrompt(prompt: string, style?: string): string {
  const p = prompt.trim();
  if (!p) return "";
  const s = (style ?? "").trim().toLowerCase();

  let core: string;
  switch (s) {
    case "ugc":
      core =
        `A realistic handheld iPhone-style UGC video: ${p}. ` +
        "Authentic TikTok/Reels selfie, not a polished commercial. Natural imperfect framing, subtle camera shake, real skin texture, slight asymmetry, casual facial expressions, realistic blinking, natural hand gestures, everyday lighting, slight background imperfections. Product visible naturally when relevant. Genuine enthusiasm and credibility. Grounded, realistic, human.";
      break;
    case "viral":
      core =
        `Viral short-form social video with scroll-stopping hook in the first second: ${p}. ` +
        "Handheld smartphone aesthetic, dynamic but believable pacing, trending UGC energy, not studio polish.";
      break;
    case "product":
      core =
        `Realistic product-focused short ad video: ${p}. ` +
        "Clear product visibility, natural demo feel, believable environment, handheld camera.";
      break;
    case "testimonial":
      core =
        `Realistic selfie testimonial UGC: ${p}. ` +
        "Person speaks directly to camera with conversational tone, natural pauses, authentic emotion, phone-recorded look.";
      break;
    case "image-animate":
      core =
        `Animate this starting frame into a realistic short UGC-style video: ${p}. ` +
        "Keep identity, face shape, jawline, cheekbones, nose, eye spacing, lips, hairline, body proportions, clothing and environment consistent with the reference. Subtle blinking, breathing, small head movement, micro expressions, natural camera shake. Do not change the face or identity.";
      break;
    default:
      return `${p} ${HIGGSFIELD_REALISM_SUFFIX} Negative prompt: ${HIGGSFIELD_NEGATIVE_PROMPT}`;
  }

  return `${core} ${HIGGSFIELD_REALISM_SUFFIX} Negative prompt: ${HIGGSFIELD_NEGATIVE_PROMPT}`;
}

export async function higgsfieldStartVideo(
  creds: HiggsfieldCredentials,
  opts: {
    endpoint: string;
    prompt: string;
    duration: number;
    aspectRatio: string;
    imageUrl?: string;
  },
): Promise<{ requestId: string; raw: HiggsfieldStatusResponse }> {
  const endpoint = opts.endpoint.startsWith("/") ? opts.endpoint : `/${opts.endpoint}`;
  const textToVideo = isTextToVideoEndpoint(endpoint);
  const duration = coerceHiggsfieldDuration(opts.duration);
  const prompt = truncatePromptForEndpoint(opts.prompt, endpoint);

  const body: Record<string, unknown> = {
    prompt,
    aspect_ratio: opts.aspectRatio,
    duration,
  };

  if (textToVideo) {
    body.negative_prompt = HIGGSFIELD_NEGATIVE_PROMPT_SHORT;
    if (endpoint.toLowerCase().includes("kling")) {
      body.cfg_scale = 0.5;
    }
  }

  if (opts.imageUrl) {
    body.image_url = opts.imageUrl;
    body.input_images = [{ type: "image_url", image_url: opts.imageUrl }];
  }

  const res = await fetch(`${higgsfieldApiOrigin()}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: higgsfieldAuthHeader(creds),
      "Content-Type": "application/json",
      "User-Agent": "higgsfield-server-js/2.0",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: HiggsfieldStatusResponse;
  try {
    parsed = JSON.parse(text) as HiggsfieldStatusResponse;
  } catch {
    throw new Error(`Higgsfield: niepoprawna odpowiedź (${res.status}): ${text.slice(0, 400)}`);
  }

  if (!res.ok) {
    throw new Error(formatHiggsfieldError(res.status, parsed.detail, text));
  }

  const requestId = parsed.request_id;
  if (!requestId) {
    throw new Error(`Higgsfield: brak request_id w odpowiedzi: ${text.slice(0, 400)}`);
  }

  return { requestId, raw: parsed };
}

/** Próbuje kolejnych modeli wideo, dopóki któryś nie przyjmie zadania. */
export async function higgsfieldStartVideoWithFallback(
  creds: HiggsfieldCredentials,
  opts: {
    model?: string;
    prompt: string;
    duration: number;
    aspectRatio: string;
    imageUrl?: string;
  },
): Promise<{ requestId: string; raw: HiggsfieldStatusResponse; endpoint: string }> {
  const candidates = resolveVideoEndpointCandidates(opts.model, Boolean(opts.imageUrl));
  let lastErr: Error | null = null;

  for (const endpoint of candidates) {
    try {
      const started = await higgsfieldStartVideo(creds, {
        endpoint,
        prompt: opts.prompt,
        duration: opts.duration,
        aspectRatio: opts.aspectRatio,
        imageUrl: opts.imageUrl,
      });
      return { ...started, endpoint };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      lastErr = err;
      console.error("higgsfield candidate failed", endpoint, err.message);
      if (/\b(401|403)\b/.test(err.message)) throw err;
    }
  }

  throw lastErr ?? new Error("Higgsfield: żaden model wideo nie przyjął zadania.");
}

export async function higgsfieldPollStatus(
  creds: HiggsfieldCredentials,
  requestId: string,
): Promise<HiggsfieldStatusResponse> {
  const res = await fetch(`${higgsfieldApiOrigin()}/requests/${encodeURIComponent(requestId)}/status`, {
    headers: {
      Authorization: higgsfieldAuthHeader(creds),
      "User-Agent": "higgsfield-server-js/2.0",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Higgsfield poll HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text) as HiggsfieldStatusResponse;
}

export function extractHiggsfieldVideoUrl(status: HiggsfieldStatusResponse): string | null {
  if (status.video?.url && /^https?:\/\//i.test(status.video.url)) return status.video.url;

  const raw = status as Record<string, unknown>;
  const outputs = raw.outputs;
  if (Array.isArray(outputs)) {
    for (const item of outputs) {
      if (typeof item === "string" && /^https?:\/\//i.test(item)) return item;
      if (item && typeof item === "object") {
        const u = (item as { url?: string }).url;
        if (u && /^https?:\/\//i.test(u)) return u;
      }
    }
  }

  const nestedVideo = raw.video;
  if (nestedVideo && typeof nestedVideo === "object" && !Array.isArray(nestedVideo)) {
    const u = (nestedVideo as { url?: string }).url;
    if (u && /^https?:\/\//i.test(u)) return u;
  }

  const imgs = status.images;
  if (Array.isArray(imgs)) {
    for (const item of imgs) {
      if (item?.url && /^https?:\/\//i.test(item.url)) return item.url;
    }
  }
  return null;
}

export function normHiggsfieldStatus(s: unknown): string {
  return typeof s === "string" ? s.trim().toLowerCase() : "";
}
