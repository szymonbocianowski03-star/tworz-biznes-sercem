import { toast } from "sonner";

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "plik"
  );
}

function extensionFromMime(mime: string, fallback: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
  };
  return map[mime.split(";")[0]?.trim().toLowerCase() ?? ""] ?? fallback;
}

function extensionFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const m = /\.([a-z0-9]{2,5})$/i.exec(path);
    if (m) return m[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return fallback;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 2000);
}

export type DownloadMediaOptions = {
  filenameBase?: string;
  kind?: "image" | "video" | "audio";
};

/** Pobiera grafikę lub wideo na dysk (fetch → blob, z fallbackiem na link). */
export async function downloadMediaToDisk(url: string, options?: DownloadMediaOptions): Promise<void> {
  if (!url?.trim()) throw new Error("Brak adresu pliku.");

  const kind =
    options?.kind ??
    (url.includes(".mp3") || url.includes("audio/")
      ? "audio"
      : url.includes(".mp4") || url.includes("video/")
        ? "video"
        : "image");
  const defaultExt = kind === "video" ? "mp4" : kind === "audio" ? "mp3" : "png";
  const base = sanitizeFilename(
    options?.filenameBase ?? (kind === "video" ? "wideo" : kind === "audio" ? "dzwiek" : "kreacja"),
  );

  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error("Nieprawidłowy format pliku.");
    const mime = m[1];
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const ext = extensionFromMime(mime, defaultExt);
    triggerBlobDownload(blob, `${base}.${ext}`);
    return;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const ext = extensionFromMime(blob.type, extensionFromUrl(url, defaultExt));
    triggerBlobDownload(blob, `${base}.${ext}`);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.${extensionFromUrl(url, defaultExt)}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export async function downloadMediaWithToast(url: string, options?: DownloadMediaOptions): Promise<void> {
  try {
    await downloadMediaToDisk(url, options);
    toast.success("Pobieranie rozpoczęte");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Nie udało się pobrać pliku.");
  }
}
