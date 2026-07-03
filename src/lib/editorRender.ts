import { isVisibleAt, type EditorProject } from "@/lib/editorProjects";

export function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Wczytuje wszystkie obrazy (tło + nakładki) do cache dla rysowania klatek. */
export async function loadProjectImages(project: EditorProject): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  const srcs = new Set<string>();
  if (project.baseKind === "image" && project.baseSrc) srcs.add(project.baseSrc);
  for (const el of project.elements) if (el.type === "image" && el.src) srcs.add(el.src);
  await Promise.all(
    [...srcs].map(async (src) => {
      try {
        map.set(src, await loadImageEl(src));
      } catch {
        /* pomiń niedostępny obraz */
      }
    }),
  );
  return map;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  media: HTMLImageElement | HTMLVideoElement,
  W: number,
  H: number,
  scaleMul = 1,
  offX = 0,
  offY = 0,
) {
  const iw = (media as HTMLVideoElement).videoWidth || (media as HTMLImageElement).naturalWidth || media.width;
  const ih = (media as HTMLVideoElement).videoHeight || (media as HTMLImageElement).naturalHeight || media.height;
  if (!iw || !ih) return;
  const scale = Math.max(W / iw, H / ih) * scaleMul;
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(media, (W - dw) / 2 + offX * W, (H - dh) / 2 + offY * H, dw, dh);
}

/** Rysuje pojedynczą klatkę projektu w sekundzie `time`. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  project: EditorProject,
  time: number,
  images: Map<string, HTMLImageElement>,
  videoEl: HTMLVideoElement | null,
) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = project.bgColor || "#ffffff";
  ctx.fillRect(0, 0, W, H);

  if (project.baseKind === "video" && videoEl && videoEl.readyState >= 2) {
    drawCover(ctx, videoEl, W, H, project.baseScale, project.baseOffsetX, project.baseOffsetY);
  } else if (project.baseKind === "image" && project.baseSrc) {
    const img = images.get(project.baseSrc);
    if (img) drawCover(ctx, img, W, H, project.baseScale, project.baseOffsetX, project.baseOffsetY);
  }

  for (const el of project.elements) {
    if (!isVisibleAt(el, time)) continue;
    if (el.type === "rect" || el.type === "ellipse") {
      ctx.save();
      ctx.globalAlpha = el.opacity;
      ctx.fillStyle = el.color;
      const x = el.x * W;
      const y = el.y * H;
      const w = el.w * W;
      const h = el.h * H;
      if (el.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const r = Math.min(el.radius, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.fill();
      }
      ctx.restore();
    } else if (el.type === "image") {
      const img = images.get(el.src);
      if (!img) continue;
      ctx.save();
      ctx.globalAlpha = el.opacity;
      ctx.drawImage(img, el.x * W, el.y * H, el.w * W, el.h * H);
      ctx.restore();
    } else if (el.type === "text") {
      ctx.save();
      const fontPx = el.fontSize * H;
      ctx.font = `${el.fontWeight} ${fontPx}px ${el.fontFamily}`;
      ctx.fillStyle = el.color;
      ctx.textAlign = el.align;
      ctx.textBaseline = "middle";
      const cx = el.x * W;
      const cy = el.y * H;
      ctx.translate(cx, cy);
      if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
      const lines = el.text.split("\n");
      const lineHeight = fontPx * 1.2;
      const startY = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, i) => ctx.fillText(line, 0, startY + i * lineHeight));
      ctx.restore();
    }
  }
}
