import { aspectDimensions, type EditorAudio, type EditorProject } from "@/lib/editorProjects";
import { drawFrame, loadProjectImages } from "@/lib/editorRender";

function waitEvent(el: HTMLMediaElement, event: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener(event, finish);
      resolve();
    };
    el.addEventListener(event, finish, { once: true });
    el.addEventListener("error", finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

function makeCanvas(project: EditorProject): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; width: number; height: number } {
  const { width, height } = aspectDimensions(project.aspect);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Brak kontekstu canvas.");
  return { canvas, ctx, width, height };
}

/** Eksport pojedynczej klatki jako PNG/JPG (data URL). */
export async function exportImageDataUrl(
  project: EditorProject,
  format: "png" | "jpg",
  posterTime = 0,
): Promise<string> {
  const { canvas, ctx, width, height } = makeCanvas(project);
  const images = await loadProjectImages(project);
  let videoEl: HTMLVideoElement | null = null;
  if (project.baseKind === "video" && project.baseSrc) {
    videoEl = document.createElement("video");
    videoEl.crossOrigin = "anonymous";
    videoEl.muted = true;
    videoEl.src = project.baseSrc;
    await waitEvent(videoEl, "loadeddata");
    try {
      videoEl.currentTime = Math.min(posterTime, Math.max(0.05, (videoEl.duration || 1) - 0.05));
      await waitEvent(videoEl, "seeked", 1500);
    } catch {
      /* ignoruj */
    }
  }
  drawFrame(ctx, width, height, project, posterTime, images, videoEl);
  const mime = format === "png" ? "image/png" : "image/jpeg";
  return canvas.toDataURL(mime, format === "jpg" ? 0.92 : undefined);
}

function pickVideoMime(): string {
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

function fadeFactor(local: number, duration: number, fadeIn: number, fadeOut: number): number {
  let f = 1;
  if (fadeIn > 0 && local < fadeIn) f = Math.min(f, local / fadeIn);
  if (fadeOut > 0 && local > duration - fadeOut) f = Math.min(f, Math.max(0, (duration - local) / fadeOut));
  return Math.max(0, Math.min(1, f));
}

type AudioContextCtor = typeof AudioContext;

export type ExportVideoResult = { blob: Blob; mime: string; ext: "mp4" | "webm" };

/** Eksport wideo: nagrywa canvas (klatki) + zmiksowane audio w czasie rzeczywistym. */
export async function exportVideoBlob(
  project: EditorProject,
  opts: { onProgress?: (ratio: number) => void; fps?: number; videoBitsPerSecond?: number } = {},
): Promise<ExportVideoResult> {
  const fps = opts.fps ?? 30;
  const { canvas, ctx, width, height } = makeCanvas(project);
  const images = await loadProjectImages(project);

  const Ctor: AudioContextCtor | undefined =
    (window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }).AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  const audioCtx = Ctor ? new Ctor() : null;
  const dest = audioCtx ? audioCtx.createMediaStreamDestination() : null;

  // Bazowe wideo
  let videoEl: HTMLVideoElement | null = null;
  if (project.baseKind === "video" && project.baseSrc) {
    videoEl = document.createElement("video");
    videoEl.crossOrigin = "anonymous";
    videoEl.playsInline = true;
    videoEl.loop = true;
    videoEl.muted = !audioCtx ? true : project.muteBase;
    videoEl.src = project.baseSrc;
    await waitEvent(videoEl, "loadeddata");
    if (audioCtx && dest && !project.muteBase) {
      try {
        const s = audioCtx.createMediaElementSource(videoEl);
        const g = audioCtx.createGain();
        g.gain.value = 1;
        s.connect(g).connect(dest);
      } catch {
        /* brak audio z wideo */
      }
    }
  }

  // Ścieżki audio
  type Track = { el: HTMLAudioElement; gain: GainNode | null; cfg: EditorAudio; playing: boolean };
  const tracks: Track[] = [];
  if (audioCtx && dest) {
    for (const a of project.audios) {
      if (a.hidden || !a.src) continue;
      const el = document.createElement("audio");
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      el.src = a.src;
      await waitEvent(el, "loadeddata", 5000);
      let gain: GainNode | null = null;
      try {
        const s = audioCtx.createMediaElementSource(el);
        gain = audioCtx.createGain();
        gain.gain.value = 0;
        s.connect(gain).connect(dest);
      } catch {
        /* pomiń ścieżkę */
      }
      tracks.push({ el, gain, cfg: a, playing: false });
    }
  }

  const stream = canvas.captureStream(fps);
  if (dest) for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);

  const mime = pickVideoMime();
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: opts.videoBitsPerSecond ?? 6_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  if (audioCtx && audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch {
      /* ignoruj */
    }
  }
  recorder.start(100);

  const duration = Math.max(0.5, project.durationSec);
  if (videoEl) {
    try {
      videoEl.currentTime = 0;
      await videoEl.play();
    } catch {
      /* ignoruj */
    }
  }

  const startTs = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const time = (performance.now() - startTs) / 1000;
      const t = Math.min(time, duration);
      drawFrame(ctx, width, height, project, t, images, videoEl);

      for (const tr of tracks) {
        const cfg = tr.cfg;
        const within = time >= cfg.startAt && time < cfg.startAt + cfg.duration;
        if (within) {
          if (!tr.playing) {
            try {
              tr.el.currentTime = cfg.trimStart + (time - cfg.startAt);
            } catch {
              /* ignoruj */
            }
            tr.el.play().catch(() => {});
            tr.playing = true;
          }
          if (tr.gain) tr.gain.gain.value = cfg.volume * fadeFactor(time - cfg.startAt, cfg.duration, cfg.fadeIn, cfg.fadeOut);
        } else if (tr.playing) {
          tr.el.pause();
          tr.playing = false;
          if (tr.gain) tr.gain.gain.value = 0;
        }
      }

      opts.onProgress?.(Math.min(1, time / duration));
      if (time >= duration) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  try {
    recorder.stop();
  } catch {
    /* ignoruj */
  }
  if (videoEl) videoEl.pause();
  for (const tr of tracks) tr.el.pause();
  const blob = await done;
  try {
    await audioCtx?.close();
  } catch {
    /* ignoruj */
  }
  const ext: "mp4" | "webm" = mime.includes("mp4") ? "mp4" : "webm";
  return { blob, mime, ext };
}
