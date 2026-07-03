import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Crop,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Lock,
  Music,
  Pause,
  Play,
  Redo2,
  Save,
  Square,
  Trash2,
  Type,
  Unlock,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveImageToProjectAssets, saveVideoToProjectAssets, uploadEditorFile, uploadEditorMedia } from "@/lib/saveProjectAsset";
import { useProducts } from "@/hooks/useProducts";
import { loadImageEl } from "@/lib/editorRender";
import {
  ASPECT_RATIOS,
  createBlankProject,
  elementLabel,
  FONT_FAMILIES,
  getEditorProject,
  isVisibleAt,
  MAX_PROJECT_DURATION_SEC,
  newId,
  saveEditorProject,
  type EditorAspect,
  type EditorAudio,
  type EditorElement,
  type EditorProject,
  type ImageOverlayElement,
  type ShapeElement,
  type TextElement,
} from "@/lib/editorProjects";
import { exportImageDataUrl, exportVideoBlob } from "@/lib/editorExport";
import { toast } from "sonner";
import { toastSupabaseLoadError } from "@/lib/supabaseSchemaHint";

type EditorSearch = { project?: string; image?: string; video?: string };

export const Route = createFileRoute("/assets/editor")({
  head: () => ({ meta: [{ title: "Zasoby — edytor kreacji — MarketingNow" }] }),
  validateSearch: (search: Record<string, unknown>): EditorSearch => ({
    project: typeof search.project === "string" ? search.project : undefined,
    image: typeof search.image === "string" ? search.image : undefined,
    video: typeof search.video === "string" ? search.video : undefined,
  }),
  component: EditorPage,
});

type LibImage = { id: string; image_url: string; prompt: string };
type LibVideo = { id: string; video_url: string | null; prompt: string };
type LibAudio = { id: string; audio_url: string | null; prompt: string };

type Selection = { kind: "element" | "audio" | "base"; id: string } | null;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function probeMediaDuration(src: string, kind: "audio" | "video"): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.src = src;
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 0);
    el.onerror = () => resolve(0);
    setTimeout(() => resolve(0), 4000);
  });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, "0")}.${cs}`;
}

function EditorPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { products } = useProducts();

  const [project, setProjectState] = useState<EditorProject>(() => createBlankProject());
  const [selection, setSelection] = useState<Selection>(null);
  const [libTab, setLibTab] = useState<"images" | "videos" | "audios">("images");
  const [libImages, setLibImages] = useState<LibImage[]>([]);
  const [libVideos, setLibVideos] = useState<LibVideo[]>([]);
  const [libAudios, setLibAudios] = useState<LibAudio[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg" | "mp4">("png");
  const [exportQuality, setExportQuality] = useState<"standard" | "high">("high");
  const [exportFps, setExportFps] = useState<24 | 30>(30);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Kadrowanie obrazu bazowego
  const [cropping, setCropping] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [cropBusy, setCropBusy] = useState(false);

  // Odtwarzanie
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTimeState] = useState(0);
  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  const setTime = useCallback((t: number) => {
    timeRef.current = t;
    setCurrentTimeState(t);
  }, []);

  // Historia
  const historyRef = useRef<EditorProject[]>([]);
  const futureRef = useRef<EditorProject[]>([]);
  const [, forceTick] = useState(0);

  const stageRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const timelineRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [tlWidth, setTlWidth] = useState(600);

  const commit = useCallback((updater: (prev: EditorProject) => EditorProject) => {
    setProjectState((prev) => {
      historyRef.current.push(prev);
      if (historyRef.current.length > 80) historyRef.current.shift();
      futureRef.current = [];
      forceTick((t) => t + 1);
      return updater(prev);
    });
  }, []);

  const undo = useCallback(() => {
    setProjectState((prev) => {
      const last = historyRef.current.pop();
      if (!last) return prev;
      futureRef.current.push(prev);
      forceTick((t) => t + 1);
      return last;
    });
  }, []);

  const redo = useCallback(() => {
    setProjectState((prev) => {
      const next = futureRef.current.pop();
      if (!next) return prev;
      historyRef.current.push(prev);
      forceTick((t) => t + 1);
      return next;
    });
  }, []);

  // Wczytanie projektu / startowego zasobu z URL
  useEffect(() => {
    if (search.project) {
      const p = getEditorProject(search.project);
      if (p) {
        setProjectState(p);
        return;
      }
    }
    if (search.image) {
      setProjectState(createBlankProject({ baseKind: "image", baseSrc: search.image, name: "Edycja grafiki" }));
      return;
    }
    if (search.video) {
      const p = createBlankProject({ baseKind: "video", baseSrc: search.video, name: "Edycja wideo", aspect: "9:16" });
      setProjectState(p);
      void probeMediaDuration(search.video, "video").then((d) => {
        if (d > 0) {
          const capped = Math.min(Math.round(d * 10) / 10, MAX_PROJECT_DURATION_SEC);
          setProjectState((prev) => ({ ...prev, baseDuration: d, durationSec: capped }));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pomiar obszarów
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const update = () => setStageSize({ w: node.clientWidth, h: node.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const node = timelineRef.current;
    if (!node) return;
    const update = () => setTlWidth(node.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const box = useMemo(() => {
    const r = ASPECT_RATIOS.find((a) => a.id === project.aspect) ?? ASPECT_RATIOS[0];
    const availW = Math.max(0, stageSize.w - 40);
    const availH = Math.max(0, stageSize.h - 40);
    if (availW === 0 || availH === 0) return { w: 0, h: 0 };
    let w = availW;
    let h = (w * r.h) / r.w;
    if (h > availH) {
      h = availH;
      w = (h * r.w) / r.h;
    }
    return { w: Math.round(w), h: Math.round(h) };
  }, [project.aspect, stageSize]);

  // Biblioteka
  const loadLibrary = useCallback(async () => {
    setLibLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLibLoading(false);
      return;
    }
    const [imgs, vids, auds] = await Promise.all([
      supabase.from("generated_images").select("id,image_url,prompt").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(60),
      supabase.from("generated_videos").select("id,video_url,prompt").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(60),
      supabase.from("generated_audios").select("id,audio_url,prompt").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(60),
    ]);
    if (imgs.error) toastSupabaseLoadError(imgs.error, "generated_images");
    setLibImages((imgs.data as LibImage[]) ?? []);
    setLibVideos((vids.data as LibVideo[]) ?? []);
    setLibAudios((auds.data as LibAudio[]) ?? []);
    setLibLoading(false);
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  // Dopasuj długość projektu do rzeczywistego wideo (metadata z elementu <video>).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || project.baseKind !== "video" || !project.baseSrc) return;
    const sync = () => {
      const d = v.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      const capped = Math.min(Math.round(d * 10) / 10, MAX_PROJECT_DURATION_SEC);
      setProjectState((prev) => {
        if (prev.baseDuration === d && prev.durationSec === capped) return prev;
        return { ...prev, baseDuration: d, durationSec: capped };
      });
    };
    v.addEventListener("loadedmetadata", sync);
    v.addEventListener("durationchange", sync);
    if (v.readyState >= 1) sync();
    return () => {
      v.removeEventListener("loadedmetadata", sync);
      v.removeEventListener("durationchange", sync);
    };
  }, [project.baseSrc, project.baseKind]);

  // ---- Odtwarzanie: synchronizacja mediów ----
  const syncMedia = useCallback(
    (time: number, isPlaying: boolean) => {
      const v = videoRef.current;
      if (v && project.baseKind === "video") {
        v.muted = project.muteBase;
        if (isPlaying) {
          if (v.paused) void v.play().catch(() => {});
          const target = v.duration ? time % v.duration : time;
          if (Math.abs(v.currentTime - target) > 0.3) v.currentTime = target;
        } else {
          if (!v.paused) v.pause();
          const target = v.duration ? Math.min(time, v.duration) : time;
          if (Math.abs(v.currentTime - target) > 0.05) {
            try {
              v.currentTime = target;
            } catch {
              /* ignoruj */
            }
          }
        }
      }
      for (const a of project.audios) {
        const el = audioRefs.current.get(a.id);
        if (!el) continue;
        const within = !a.hidden && time >= a.startAt && time < a.startAt + a.duration;
        let vol = a.volume;
        const local = time - a.startAt;
        if (a.fadeIn > 0 && local < a.fadeIn) vol *= Math.max(0, local / a.fadeIn);
        if (a.fadeOut > 0 && local > a.duration - a.fadeOut) vol *= Math.max(0, (a.duration - local) / a.fadeOut);
        el.volume = clamp(vol, 0, 1);
        if (isPlaying && within) {
          const target = a.trimStart + local;
          if (el.paused) {
            try {
              el.currentTime = target;
            } catch {
              /* ignoruj */
            }
            void el.play().catch(() => {});
          } else if (Math.abs(el.currentTime - target) > 0.3) {
            el.currentTime = target;
          }
        } else if (!el.paused) {
          el.pause();
        }
      }
    },
    [project.audios, project.baseKind, project.muteBase],
  );

  useEffect(() => {
    playingRef.current = playing;
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      syncMedia(timeRef.current, false);
      return;
    }
    if (timeRef.current >= project.durationSec) setTime(0);
    lastTsRef.current = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = (now - lastTsRef.current) / 1000;
      lastTsRef.current = now;
      let t = timeRef.current + dt;
      if (t >= project.durationSec) {
        t = project.durationSec;
        setTime(t);
        syncMedia(t, false);
        setPlaying(false);
        return;
      }
      setTime(t);
      syncMedia(t, true);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, project.durationSec]);

  const seek = useCallback(
    (t: number) => {
      const nt = clamp(t, 0, project.durationSec);
      setTime(nt);
      syncMedia(nt, playingRef.current);
    },
    [project.durationSec, setTime, syncMedia],
  );

  // ---- Operacje na elementach ----
  const selectedElement = useMemo(
    () => (selection?.kind === "element" ? project.elements.find((e) => e.id === selection.id) ?? null : null),
    [selection, project.elements],
  );
  const selectedAudio = useMemo(
    () => (selection?.kind === "audio" ? project.audios.find((a) => a.id === selection.id) ?? null : null),
    [selection, project.audios],
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<EditorElement>) => {
      commit((prev) => ({
        ...prev,
        elements: prev.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as EditorElement) : e)),
      }));
    },
    [commit],
  );

  const updateAudio = useCallback(
    (id: string, patch: Partial<EditorAudio>) => {
      commit((prev) => ({ ...prev, audios: prev.audios.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
    },
    [commit],
  );

  const removeElement = useCallback(
    (id: string) => {
      commit((prev) => ({ ...prev, elements: prev.elements.filter((e) => e.id !== id) }));
      setSelection(null);
    },
    [commit],
  );

  const removeAudio = useCallback(
    (id: string) => {
      audioRefs.current.delete(id);
      commit((prev) => ({ ...prev, audios: prev.audios.filter((a) => a.id !== id) }));
      setSelection(null);
    },
    [commit],
  );

  const removeBase = useCallback(() => {
    commit((prev) => ({
      ...prev,
      baseKind: "blank",
      baseSrc: null,
      baseName: null,
      baseDuration: null,
      baseScale: 1,
      baseOffsetX: 0,
      baseOffsetY: 0,
    }));
    setSelection(null);
    toast.success("Usunięto materiał bazowy");
  }, [commit]);

  const deleteSelected = useCallback(() => {
    if (!selection) {
      toast.message("Zaznacz element na podglądzie, w warstwach lub na timeline.");
      return;
    }
    if (selection.kind === "element") removeElement(selection.id);
    else if (selection.kind === "audio") removeAudio(selection.id);
    else if (selection.kind === "base") removeBase();
  }, [selection, removeElement, removeAudio, removeBase]);

  const reorderElement = useCallback(
    (id: string, dir: -1 | 1) => {
      commit((prev) => {
        const idx = prev.elements.findIndex((e) => e.id === id);
        if (idx < 0) return prev;
        const swap = idx + dir;
        if (swap < 0 || swap >= prev.elements.length) return prev;
        const arr = [...prev.elements];
        [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
        return { ...prev, elements: arr };
      });
    },
    [commit],
  );

  const addText = useCallback(() => {
    const el: TextElement = {
      id: newId("txt"),
      type: "text",
      text: "Twój tekst",
      x: 0.5,
      y: 0.5,
      fontSize: 0.08,
      color: "#111111",
      fontFamily: FONT_FAMILIES[0].value,
      fontWeight: 700,
      align: "center",
      rotation: 0,
      startTime: 0,
      endTime: project.durationSec,
      hidden: false,
      locked: false,
    };
    commit((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelection({ kind: "element", id: el.id });
  }, [commit, project.durationSec]);

  const addShape = useCallback(
    (type: "rect" | "ellipse") => {
      const el: ShapeElement = {
        id: newId("shp"),
        type,
        x: 0.35,
        y: 0.4,
        w: 0.3,
        h: 0.2,
        color: "#2563eb",
        radius: 16,
        opacity: 1,
        startTime: 0,
        endTime: project.durationSec,
        hidden: false,
        locked: false,
      };
      commit((prev) => ({ ...prev, elements: [...prev.elements, el] }));
      setSelection({ kind: "element", id: el.id });
    },
    [commit, project.durationSec],
  );

  const addImageOverlay = useCallback(
    (src: string, name: string) => {
      const el: ImageOverlayElement = {
        id: newId("img"),
        type: "image",
        src,
        name,
        x: 0.1,
        y: 0.1,
        w: 0.3,
        h: 0.3,
        opacity: 1,
        startTime: 0,
        endTime: project.durationSec,
        hidden: false,
        locked: false,
      };
      commit((prev) => ({ ...prev, elements: [...prev.elements, el] }));
      setSelection({ kind: "element", id: el.id });
    },
    [commit, project.durationSec],
  );

  const setBase = useCallback(
    (kind: "image" | "video", src: string, name: string) => {
      commit((prev) => ({ ...prev, baseKind: kind, baseSrc: src, baseName: name }));
      if (kind === "video") {
        void probeMediaDuration(src, "video").then((d) => {
          if (d > 0) {
            const capped = Math.min(Math.round(d * 10) / 10, MAX_PROJECT_DURATION_SEC);
            setProjectState((prev) => ({ ...prev, baseDuration: d, durationSec: capped }));
          }
        });
      }
    },
    [commit],
  );

  const addAudio = useCallback(
    (src: string, name: string) => {
      const id = newId("aud");
      const a: EditorAudio = {
        id,
        src,
        name,
        volume: 1,
        startAt: 0,
        trimStart: 0,
        duration: project.durationSec,
        fadeIn: 0,
        fadeOut: 0,
        hidden: false,
        locked: false,
      };
      commit((prev) => ({ ...prev, audios: [...prev.audios, a], muteBase: prev.baseKind === "video" ? true : prev.muteBase }));
      setSelection({ kind: "audio", id });
      void probeMediaDuration(src, "audio").then((d) => {
        if (d > 0) commit((prev) => ({ ...prev, audios: prev.audios.map((x) => (x.id === id ? { ...x, duration: Math.min(d, prev.durationSec) } : x)) }));
      });
      toast.success("Dodano ścieżkę audio");
    },
    [commit, project.durationSec],
  );

  // Upload / drag&drop — pliki wgrywamy do storage (trwałe URL-e), z fallbackiem lokalnym.
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      setUploadingFiles(true);
      try {
        for (const file of arr) {
          const isImage = file.type.startsWith("image/");
          const isVideo = file.type.startsWith("video/");
          const isAudio = file.type.startsWith("audio/");
          if (!isImage && !isVideo && !isAudio) {
            toast.error(`Nieobsługiwany plik: ${file.name}`);
            continue;
          }
          const up = await uploadEditorFile(file);
          let src = up.url;
          if (!src) {
            // fallback: obraz → data URL (trwały w szkicu), wideo/audio → blob (sesja)
            src = isImage ? await fileToDataUrl(file) : URL.createObjectURL(file);
            toast.message(`Plik użyty lokalnie (bez zapisu w chmurze): ${up.error ?? ""}`);
          }
          if (isImage) {
            if (project.baseKind === "blank" || !project.baseSrc) setBase("image", src, file.name);
            else addImageOverlay(src, file.name);
          } else if (isVideo) {
            setBase("video", src, file.name);
          } else {
            addAudio(src, file.name);
          }
        }
      } finally {
        setUploadingFiles(false);
      }
    },
    [project.baseKind, project.baseSrc, setBase, addImageOverlay, addAudio],
  );

  // ---- Kadrowanie obrazu bazowego ----
  const startCrop = useCallback(() => {
    if (project.baseKind !== "image" || !project.baseSrc) {
      toast.error("Najpierw ustaw obraz jako tło.");
      return;
    }
    setSelection(null);
    setCropRect({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
    setCropping(true);
  }, [project.baseKind, project.baseSrc]);

  const applyCrop = useCallback(async () => {
    if (!project.baseSrc || box.w === 0) return;
    setCropBusy(true);
    try {
      const img = await loadImageEl(project.baseSrc);
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = Math.max(box.w / iw, box.h / ih);
      const dispW = iw * scale;
      const dispH = ih * scale;
      const offX = (box.w - dispW) / 2;
      const offY = (box.h - dispH) / 2;
      const sx = clamp((cropRect.x * box.w - offX) / scale, 0, iw);
      const sy = clamp((cropRect.y * box.h - offY) / scale, 0, ih);
      const sw = clamp((cropRect.w * box.w) / scale, 1, iw - sx);
      const sh = clamp((cropRect.h * box.h) / scale, 1, ih - sy);

      const longEdge = 1600;
      const outScale = Math.min(1, longEdge / Math.max(sw, sh));
      const outW = Math.max(1, Math.round(sw * outScale));
      const outH = Math.max(1, Math.round(sh * outScale));
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Brak canvas.");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
      let newSrc: string;
      if (blob) {
        const up = await uploadEditorMedia(blob, "png", "image/png");
        newSrc = up.url || canvas.toDataURL("image/png");
      } else {
        newSrc = canvas.toDataURL("image/png");
      }
      commit((prev) => ({ ...prev, baseSrc: newSrc }));
      setCropping(false);
      toast.success("Skadrowano obraz");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kadrowanie nie powiodło się (możliwe ograniczenie CORS).");
    } finally {
      setCropBusy(false);
    }
  }, [project.baseSrc, box, cropRect, commit]);

  // ---- Przeciąganie/skalowanie na podglądzie ----
  const dragState = useRef<{ mode: "move" | "resize"; id: string; sx: number; sy: number; ex: number; ey: number; ew: number; eh: number; ef: number } | null>(null);

  const onElementPointerDown = (e: React.PointerEvent, el: EditorElement, mode: "move" | "resize") => {
    e.stopPropagation();
    if (el.locked) return;
    setSelection({ kind: "element", id: el.id });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragState.current = {
      mode,
      id: el.id,
      sx: e.clientX,
      sy: e.clientY,
      ex: el.x,
      ey: el.y,
      ew: "w" in el ? el.w : 0,
      eh: "h" in el ? el.h : 0,
      ef: el.type === "text" ? el.fontSize : 0,
    };
  };

  const cropDrag = useRef<{ mode: "move" | "nw" | "ne" | "sw" | "se"; sx: number; sy: number; r: { x: number; y: number; w: number; h: number } } | null>(null);

  // Przeciąganie / skalowanie bazowego mediach
  const baseDrag = useRef<{ mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; scale: number } | null>(null);
  const onBaseDown = (e: React.PointerEvent, mode: "move" | "resize") => {
    e.stopPropagation();
    setSelection({ kind: "base", id: "base" });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    baseDrag.current = { mode, sx: e.clientX, sy: e.clientY, ox: project.baseOffsetX, oy: project.baseOffsetY, scale: project.baseScale };
  };

  const onCropHandleDown = (e: React.PointerEvent, mode: "move" | "nw" | "ne" | "sw" | "se") => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    cropDrag.current = { mode, sx: e.clientX, sy: e.clientY, r: { ...cropRect } };
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    const bd = baseDrag.current;
    const brect = previewRef.current?.getBoundingClientRect();
    if (bd && brect) {
      if (bd.mode === "move") {
        const dx = (e.clientX - bd.sx) / brect.width;
        const dy = (e.clientY - bd.sy) / brect.height;
        setProjectState((prev) => ({ ...prev, baseOffsetX: clamp(bd.ox + dx, -1, 1), baseOffsetY: clamp(bd.oy + dy, -1, 1) }));
      } else {
        const dy = (e.clientY - bd.sy) / brect.height;
        setProjectState((prev) => ({ ...prev, baseScale: clamp(bd.scale + dy * 2, 0.2, 4) }));
      }
      return;
    }
    const cd = cropDrag.current;
    const prect = previewRef.current?.getBoundingClientRect();
    if (cd && prect) {
      const dx = (e.clientX - cd.sx) / prect.width;
      const dy = (e.clientY - cd.sy) / prect.height;
      setCropRect(() => {
        let { x, y, w, h } = cd.r;
        if (cd.mode === "move") {
          x = clamp(x + dx, 0, 1 - w);
          y = clamp(y + dy, 0, 1 - h);
        } else {
          if (cd.mode === "nw") {
            x = clamp(x + dx, 0, x + w - 0.05);
            y = clamp(y + dy, 0, y + h - 0.05);
            w = cd.r.x + cd.r.w - x;
            h = cd.r.y + cd.r.h - y;
          } else if (cd.mode === "ne") {
            y = clamp(y + dy, 0, y + h - 0.05);
            w = clamp(w + dx, 0.05, 1 - x);
            h = cd.r.y + cd.r.h - y;
          } else if (cd.mode === "sw") {
            x = clamp(x + dx, 0, x + w - 0.05);
            w = cd.r.x + cd.r.w - x;
            h = clamp(h + dy, 0.05, 1 - y);
          } else {
            w = clamp(w + dx, 0.05, 1 - x);
            h = clamp(h + dy, 0.05, 1 - y);
          }
        }
        return { x, y, w, h };
      });
      return;
    }
    const ds = dragState.current;
    const rect = previewRef.current?.getBoundingClientRect();
    if (!ds || !rect) return;
    const dx = (e.clientX - ds.sx) / rect.width;
    const dy = (e.clientY - ds.sy) / rect.height;
    setProjectState((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        if (el.id !== ds.id) return el;
        if (ds.mode === "move") return { ...el, x: clamp(ds.ex + dx, -0.5, 1.5), y: clamp(ds.ey + dy, -0.5, 1.5) } as EditorElement;
        if (el.type === "text") return { ...el, fontSize: clamp(ds.ef + dy, 0.02, 0.4) } as EditorElement;
        return { ...el, w: clamp(ds.ew + dx, 0.03, 2), h: clamp(ds.eh + dy, 0.03, 2) } as EditorElement;
      }),
    }));
  };

  const onStagePointerUp = () => {
    if (baseDrag.current) {
      baseDrag.current = null;
      commit((p) => p);
      return;
    }
    if (cropDrag.current) {
      cropDrag.current = null;
      return;
    }
    if (dragState.current) {
      commit((p) => p);
      dragState.current = null;
    }
  };

  // ---- Timeline drag ----
  const tlDrag = useRef<
    | { target: "element" | "audio"; mode: "move" | "trimL" | "trimR"; id: string; sx: number; s0: number; e0: number; trim0: number }
    | null
  >(null);
  const pxPerSec = tlWidth > 0 && project.durationSec > 0 ? tlWidth / project.durationSec : 1;

  const onTlBlockDown = (e: React.PointerEvent, target: "element" | "audio", id: string, mode: "move" | "trimL" | "trimR") => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelection({ kind: target, id });
    if (target === "element") {
      const el = project.elements.find((x) => x.id === id);
      if (!el || el.locked) return;
      tlDrag.current = { target, mode, id, sx: e.clientX, s0: el.startTime, e0: el.endTime, trim0: 0 };
    } else {
      const a = project.audios.find((x) => x.id === id);
      if (!a || a.locked) return;
      tlDrag.current = { target, mode, id, sx: e.clientX, s0: a.startAt, e0: a.startAt + a.duration, trim0: a.trimStart };
    }
  };

  const onTlPointerMove = (e: React.PointerEvent) => {
    const d = tlDrag.current;
    if (!d) return;
    const dt = (e.clientX - d.sx) / pxPerSec;
    setProjectState((prev) => {
      if (d.target === "element") {
        return {
          ...prev,
          elements: prev.elements.map((el) => {
            if (el.id !== d.id) return el;
            if (d.mode === "move") {
              const len = d.e0 - d.s0;
              const ns = clamp(d.s0 + dt, 0, prev.durationSec - len);
              return { ...el, startTime: ns, endTime: ns + len };
            }
            if (d.mode === "trimL") return { ...el, startTime: clamp(d.s0 + dt, 0, el.endTime - 0.2) };
            return { ...el, endTime: clamp(d.e0 + dt, el.startTime + 0.2, prev.durationSec) };
          }),
        };
      }
      return {
        ...prev,
        audios: prev.audios.map((a) => {
          if (a.id !== d.id) return a;
          if (d.mode === "move") {
            const len = d.e0 - d.s0;
            const ns = clamp(d.s0 + dt, 0, prev.durationSec - 0.2);
            return { ...a, startAt: ns, duration: Math.min(len, prev.durationSec - ns) };
          }
          if (d.mode === "trimL") {
            const ns = clamp(d.s0 + dt, 0, d.e0 - 0.2);
            return { ...a, startAt: ns, trimStart: Math.max(0, d.trim0 + (ns - d.s0)), duration: d.e0 - ns };
          }
          const ne = clamp(d.e0 + dt, a.startAt + 0.2, prev.durationSec);
          return { ...a, duration: ne - a.startAt };
        }),
      };
    });
  };

  const onTlPointerUp = () => {
    if (tlDrag.current) {
      commit((p) => p);
      tlDrag.current = null;
    }
  };

  // ---- Zapis / eksport ----
  const handleSaveDraft = useCallback(async () => {
    let thumbnail = project.thumbnail;
    try {
      thumbnail = await exportImageDataUrl(project, "jpg", timeRef.current);
    } catch {
      /* zostaw poprzednią */
    }
    const toSave: EditorProject = { ...project, thumbnail };
    saveEditorProject(toSave);
    setProjectState(toSave);
    toast.success("Zapisano projekt");
    void navigate({ to: "/assets/editor", search: { project: toSave.id }, replace: true });
  }, [project, navigate]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportProgress(0);
    setPlaying(false);
    try {
      if (exportFormat === "mp4") {
        const { blob, ext } = await exportVideoBlob(project, {
          onProgress: setExportProgress,
          fps: exportFps,
          videoBitsPerSecond: exportQuality === "high" ? 10_000_000 : 5_000_000,
        });
        const objUrl = URL.createObjectURL(blob);
        const res = await saveVideoToProjectAssets({
          videoUrl: objUrl,
          prompt: project.name || "Kreacja wideo",
          productName: project.productName,
          campaignName: project.campaignName,
        });
        URL.revokeObjectURL(objUrl);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(ext === "mp4" ? "Wyeksportowano MP4 do biblioteki" : "Wyeksportowano wideo (WebM) do biblioteki");
          setShowExport(false);
          void navigate({ to: "/assets/video" });
        }
      } else {
        const dataUrl = await exportImageDataUrl(project, exportFormat, timeRef.current);
        const res = await saveImageToProjectAssets({
          imageUrl: dataUrl,
          prompt: project.name || "Kreacja z edytora",
          size: project.aspect,
          productName: project.productName,
          campaignName: project.campaignName,
        });
        if (res.error) toast.error(res.error);
        else {
          toast.success("Wyeksportowano do biblioteki Zasoby");
          setShowExport(false);
          void navigate({ to: "/assets/gallery" });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eksport nie powiódł się.");
    } finally {
      setExporting(false);
    }
  }, [project, exportFormat, exportFps, exportQuality, navigate]);

  const visibleElements = project.elements.filter((el) => isVisibleAt(el, currentTime));

  return (
    <div className="flex h-[calc(100vh-2rem)] min-h-[640px] flex-col">
      {/* Pasek górny */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => void navigate({ to: "/assets/gallery" })}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Zasoby
        </button>
        <input
          value={project.name}
          onChange={(e) => setProjectState((p) => ({ ...p, name: e.target.value }))}
          className="ml-2 min-w-0 max-w-[220px] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium hover:border-border focus:border-border focus:outline-none"
        />
        <span
          title="Edytor kreacji działa w wersji beta — niektóre funkcje mogą się jeszcze zmieniać."
          className="inline-flex items-center rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:border-violet-700/50 dark:bg-violet-950/40 dark:text-violet-300"
        >
          Beta
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <IconBtn title="Cofnij" onClick={undo} disabled={historyRef.current.length === 0}>
            <Redo2 className="h-4 w-4 -scale-x-100" />
          </IconBtn>
          <IconBtn title="Ponów" onClick={redo} disabled={futureRef.current.length === 0}>
            <Redo2 className="h-4 w-4" />
          </IconBtn>
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Save className="h-4 w-4" /> Zapisz projekt
          </button>
          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Eksportuj
          </button>
        </div>
      </div>

      {/* Środkowa część: 3 kolumny */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_1fr_300px]">
        {/* Lewy panel */}
        <aside className="flex min-h-0 flex-col overflow-y-auto border-r border-border bg-surface-elevated/40 p-3">
          <div className="flex flex-wrap gap-1.5">
            <ToolButton icon={<Type className="h-4 w-4" />} label="Tekst" onClick={addText} />
            <ToolButton icon={<Square className="h-4 w-4" />} label="Prostokąt" onClick={() => addShape("rect")} />
            <ToolButton icon={<Circle className="h-4 w-4" />} label="Koło" onClick={() => addShape("ellipse")} />
          </div>

          {project.baseKind === "image" && project.baseSrc && (
            <button
              type="button"
              onClick={startCrop}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-xs font-medium hover:bg-muted"
            >
              <Crop className="h-4 w-4" /> Kadruj obraz
            </button>
          )}

          <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground hover:bg-muted">
            {uploadingFiles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploadingFiles ? "Wgrywanie…" : "Wgraj plik"}
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          <div className="mt-4 flex gap-1 rounded-lg bg-muted p-1 text-xs">
            <LibTabBtn active={libTab === "images"} onClick={() => setLibTab("images")} icon={<ImageIcon className="h-3.5 w-3.5" />} label="Obrazy" />
            <LibTabBtn active={libTab === "videos"} onClick={() => setLibTab("videos")} icon={<Video className="h-3.5 w-3.5" />} label="Wideo" />
            <LibTabBtn active={libTab === "audios"} onClick={() => setLibTab("audios")} icon={<Music className="h-3.5 w-3.5" />} label="Audio" />
          </div>

          <div className="mt-3">
            {libLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Ładowanie…
              </div>
            ) : libTab === "images" ? (
              <div className="grid grid-cols-2 gap-2">
                {libImages.length === 0 && <EmptyLib text="Brak obrazów." />}
                {libImages.map((it) => (
                  <div key={it.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                    <img src={it.image_url} alt={it.prompt} loading="lazy" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 hidden flex-col items-center justify-center gap-1 bg-black/55 p-1 group-hover:flex">
                      <button type="button" onClick={() => setBase("image", it.image_url, it.prompt)} className="w-full rounded bg-white/95 px-1 py-0.5 text-[10px] font-medium text-black hover:bg-white">
                        Jako tło
                      </button>
                      <button type="button" onClick={() => addImageOverlay(it.image_url, it.prompt)} className="w-full rounded bg-white/95 px-1 py-0.5 text-[10px] font-medium text-black hover:bg-white">
                        Jako logo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : libTab === "videos" ? (
              <div className="grid grid-cols-2 gap-2">
                {libVideos.filter((v) => v.video_url).length === 0 && <EmptyLib text="Brak wideo." />}
                {libVideos.filter((v) => v.video_url).map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    title={it.prompt}
                    onClick={() => setBase("video", it.video_url!, it.prompt)}
                    className="relative aspect-square overflow-hidden rounded-lg border border-border bg-black"
                  >
                    <video src={it.video_url!} className="h-full w-full object-cover" muted />
                    <Video className="absolute right-1 top-1 h-3.5 w-3.5 text-white/90" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {libAudios.filter((a) => a.audio_url).length === 0 && <EmptyLib text="Brak dźwięków." />}
                {libAudios.filter((a) => a.audio_url).map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    title={it.prompt}
                    onClick={() => addAudio(it.audio_url!, it.prompt || "Audio")}
                    className="flex w-full items-center gap-2 rounded-lg border border-border px-2 py-2 text-left text-xs hover:bg-muted"
                  >
                    <Music className="h-4 w-4 shrink-0 text-accent" />
                    <span className="line-clamp-2">{it.prompt || "Ścieżka audio"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Warstwy */}
          <div className="mt-5">
            <PanelLabel>Warstwy</PanelLabel>
            <div className="mt-2 space-y-1">
              {project.baseSrc && (
                <LayerRow
                  active={selection?.kind === "base"}
                  label={project.baseKind === "video" ? "Wideo 1" : "Zdjęcie 1"}
                  isBaseVideo={project.baseKind === "video"}
                  hidden={false}
                  locked={false}
                  onSelect={() => setSelection({ kind: "base", id: "base" })}
                  onToggleHidden={() => {}}
                  onToggleLocked={() => {}}
                  onDelete={() => removeBase()}
                  hideVisibilityControls
                />
              )}
              {project.elements.length === 0 && project.audios.length === 0 && !project.baseSrc && (
                <p className="text-xs text-muted-foreground">Brak elementów. Dodaj tekst, kształt lub audio.</p>
              )}
              {[...project.elements].reverse().map((el) => (
                <LayerRow
                  key={el.id}
                  active={selection?.kind === "element" && selection.id === el.id}
                  label={elementLabel(el)}
                  hidden={el.hidden}
                  locked={el.locked}
                  onSelect={() => setSelection({ kind: "element", id: el.id })}
                  onToggleHidden={() => updateElement(el.id, { hidden: !el.hidden })}
                  onToggleLocked={() => updateElement(el.id, { locked: !el.locked })}
                  onUp={() => reorderElement(el.id, 1)}
                  onDown={() => reorderElement(el.id, -1)}
                  onDelete={() => removeElement(el.id)}
                />
              ))}
              {project.audios.map((a) => (
                <LayerRow
                  key={a.id}
                  active={selection?.kind === "audio" && selection.id === a.id}
                  label={a.name}
                  isAudio
                  hidden={a.hidden}
                  locked={a.locked}
                  onSelect={() => setSelection({ kind: "audio", id: a.id })}
                  onToggleHidden={() => updateAudio(a.id, { hidden: !a.hidden })}
                  onToggleLocked={() => updateAudio(a.id, { locked: !a.locked })}
                  onDelete={() => removeAudio(a.id)}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Środek: podgląd */}
        <main
          ref={stageRef}
          className="relative flex items-center justify-center overflow-hidden bg-neutral-100 p-5 dark:bg-neutral-900"
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onClick={() => setSelection(null)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
          }}
        >
          <div
            ref={previewRef}
            style={{ width: box.w || undefined, height: box.h || undefined, backgroundColor: project.bgColor }}
            className={`relative overflow-hidden rounded-lg shadow-elevated ${dragOver ? "ring-4 ring-accent/50" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            {project.baseKind === "image" && project.baseSrc && (
              <img
                src={project.baseSrc}
                alt=""
                draggable={false}
                onPointerDown={(e) => {
                  if (!cropping) onBaseDown(e, "move");
                }}
                style={{ transform: `translate(${project.baseOffsetX * 100}%, ${project.baseOffsetY * 100}%) scale(${project.baseScale})` }}
                className={`absolute inset-0 h-full w-full object-cover ${cropping ? "" : "cursor-move"}`}
              />
            )}
            <video
              ref={videoRef}
              src={project.baseKind === "video" ? project.baseSrc ?? undefined : undefined}
              onPointerDown={(e) => onBaseDown(e, "move")}
              style={{ transform: `translate(${project.baseOffsetX * 100}%, ${project.baseOffsetY * 100}%) scale(${project.baseScale})` }}
              className={`absolute inset-0 h-full w-full cursor-move object-cover ${project.baseKind === "video" && project.baseSrc ? "" : "hidden"}`}
              playsInline
              crossOrigin="anonymous"
            />
            {selection?.kind === "base" && project.baseSrc && !cropping && (
              <>
                <div className="pointer-events-none absolute inset-0 z-10 outline outline-2 outline-accent" />
                <span
                  onPointerDown={(e) => onBaseDown(e, "resize")}
                  className="absolute -bottom-1.5 -right-1.5 z-20 h-4 w-4 cursor-se-resize rounded-full border border-white bg-accent shadow"
                />
              </>
            )}

            {visibleElements.map((el) => (
              <ElementView
                key={el.id}
                el={el}
                selected={selection?.kind === "element" && selection.id === el.id}
                stageHeight={box.h}
                onMoveDown={(e) => onElementPointerDown(e, el, "move")}
                onResizeDown={(e) => onElementPointerDown(e, el, "resize")}
              />
            ))}

            {cropping && (
              <div className="absolute inset-0 z-30">
                <div
                  className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                  style={{ left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`, width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%` }}
                  onPointerDown={(e) => onCropHandleDown(e, "move")}
                >
                  {(["nw", "ne", "sw", "se"] as const).map((c) => (
                    <span
                      key={c}
                      onPointerDown={(e) => onCropHandleDown(e, c)}
                      className={`absolute h-3 w-3 rounded-full border border-neutral-400 bg-white ${
                        c === "nw" ? "-left-1.5 -top-1.5 cursor-nwse-resize" : c === "ne" ? "-right-1.5 -top-1.5 cursor-nesw-resize" : c === "sw" ? "-left-1.5 -bottom-1.5 cursor-nesw-resize" : "-right-1.5 -bottom-1.5 cursor-nwse-resize"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {!project.baseSrc && project.elements.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                <ImageIcon className="h-8 w-8 opacity-40" />
                Wybierz materiał z biblioteki, wgraj plik lub przeciągnij go tutaj.
              </div>
            )}
          </div>

          {cropping && (
            <div className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-elevated backdrop-blur">
              <span className="text-xs text-muted-foreground">Kadrowanie</span>
              <button type="button" onClick={() => setCropRect({ x: 0, y: 0, w: 1, h: 1 })} className="rounded-full border border-border px-2 py-1 text-xs hover:bg-muted">
                Całość
              </button>
              <button
                type="button"
                disabled={cropBusy}
                onClick={() => void applyCrop()}
                className="inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background hover:opacity-90 disabled:opacity-60"
              >
                {cropBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Zastosuj
              </button>
              <button type="button" disabled={cropBusy} onClick={() => setCropping(false)} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60">
                <X className="h-3.5 w-3.5" /> Anuluj
              </button>
            </div>
          )}
        </main>

        {/* Prawy panel ustawień */}
        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-border bg-surface-elevated/40 p-4 text-sm">
          {selection?.kind === "base" && project.baseSrc ? (
            <BaseSettings
              project={project}
              onChange={(patch) => commit((p) => ({ ...p, ...patch }))}
              onReset={() => commit((p) => ({ ...p, baseScale: 1, baseOffsetX: 0, baseOffsetY: 0 }))}
              onRemove={() => removeBase()}
            />
          ) : selectedElement ? (
            <ElementSettings
              element={selectedElement}
              duration={project.durationSec}
              onChange={(patch) => updateElement(selectedElement.id, patch)}
              onDelete={() => removeElement(selectedElement.id)}
            />
          ) : selectedAudio ? (
            <AudioSettings
              audio={selectedAudio}
              duration={project.durationSec}
              onChange={(patch) => updateAudio(selectedAudio.id, patch)}
              onDelete={() => removeAudio(selectedAudio.id)}
            />
          ) : (
            <ProjectSettings
              project={project}
              onChange={(patch) => commit((p) => ({ ...p, ...patch }))}
              onExport={() => setShowExport(true)}
            />
          )}
        </aside>
      </div>

      {/* Timeline */}
      <div className="border-t border-border bg-surface-elevated/60">
        <div className="flex items-center gap-2 px-3 py-2">
          <IconBtn title={playing ? "Pauza" : "Odtwórz"} onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </IconBtn>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {fmtTime(currentTime)} / {fmtTime(project.durationSec)}
          </span>
          <div className="mx-2 h-5 w-px bg-border" />
          <IconBtn title="Cofnij" onClick={undo} disabled={historyRef.current.length === 0}>
            <Redo2 className="h-4 w-4 -scale-x-100" />
          </IconBtn>
          <IconBtn title="Ponów" onClick={redo} disabled={futureRef.current.length === 0}>
            <Redo2 className="h-4 w-4" />
          </IconBtn>
          <IconBtn title="Usuń zaznaczony" onClick={deleteSelected}>
            <Trash2 className="h-4 w-4" />
          </IconBtn>
        </div>

        <div className="px-3 pb-3">
          {/* Linijka czasu */}
          <div
            ref={timelineRef}
            className="relative select-none"
            onPointerMove={onTlPointerMove}
            onPointerUp={onTlPointerUp}
          >
            <div
              className="relative mb-1 h-5 cursor-pointer rounded bg-muted"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                seek(((e.clientX - rect.left) / rect.width) * project.durationSec);
              }}
            >
              {/* playhead */}
              <div className="pointer-events-none absolute top-0 z-20 h-full w-0.5 bg-accent" style={{ left: `${(currentTime / project.durationSec) * 100}%` }} />
            </div>

            <TimelineRow label="Wideo">
              {project.baseSrc && (
                <button
                  type="button"
                  onClick={() => setSelection({ kind: "base", id: "base" })}
                  className={`absolute inset-y-1 left-0 right-0 flex items-center rounded bg-blue-500/25 px-2 text-[10px] text-blue-700 dark:text-blue-300 ${selection?.kind === "base" ? "ring-2 ring-accent" : ""}`}
                >
                  {project.baseKind === "video" ? "Wideo 1" : "Zdjęcie 1"}
                </button>
              )}
            </TimelineRow>

            <TimelineRow label="Tekst">
              {project.elements.filter((e) => e.type === "text").map((el, i) => (
                <TimelineBlock key={el.id} startPct={(el.startTime / project.durationSec) * 100} widthPct={((el.endTime - el.startTime) / project.durationSec) * 100} color="bg-emerald-500/30 text-emerald-800 dark:text-emerald-200" active={selection?.kind === "element" && selection.id === el.id} label={`Tekst ${i + 1}`} onDown={(e, m) => onTlBlockDown(e, "element", el.id, m)} />
              ))}
            </TimelineRow>

            <TimelineRow label="Grafiki">
              {project.elements.filter((e) => e.type !== "text").map((el, i) => (
                <TimelineBlock key={el.id} startPct={(el.startTime / project.durationSec) * 100} widthPct={((el.endTime - el.startTime) / project.durationSec) * 100} color="bg-violet-500/30 text-violet-800 dark:text-violet-200" active={selection?.kind === "element" && selection.id === el.id} label={el.type === "image" ? `Grafika ${i + 1}` : `Kształt ${i + 1}`} onDown={(e, m) => onTlBlockDown(e, "element", el.id, m)} />
              ))}
            </TimelineRow>

            <TimelineRow label="Audio">
              {project.audios.map((a, i) => (
                <TimelineBlock key={a.id} startPct={(a.startAt / project.durationSec) * 100} widthPct={(a.duration / project.durationSec) * 100} color="bg-amber-500/30 text-amber-800 dark:text-amber-200" active={selection?.kind === "audio" && selection.id === a.id} label={`Audio ${i + 1}`} onDown={(e, m) => onTlBlockDown(e, "audio", a.id, m)} />
              ))}
            </TimelineRow>
          </div>
        </div>
      </div>

      {/* Ukryte elementy audio do odtwarzania w podglądzie */}
      {project.audios.map((a) => (
        <audio
          key={a.id}
          src={a.src}
          crossOrigin="anonymous"
          ref={(node) => {
            if (node) audioRefs.current.set(a.id, node);
            else audioRefs.current.delete(a.id);
          }}
        />
      ))}

      {/* Modal eksportu */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !exporting && setShowExport(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Eksport kreacji</h2>
            <p className="mt-1 text-sm text-muted-foreground">Gotowy plik trafi do biblioteki „Zasoby”.</p>

            <div className="mt-4 space-y-3">
              <div>
                <PanelLabel>Format</PanelLabel>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(["png", "jpg", "mp4"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setExportFormat(f)}
                      className={`rounded-lg border px-3 py-2 text-sm uppercase ${exportFormat === f ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {exportFormat === "mp4" && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Wideo nagrywane jest w czasie rzeczywistym ({fmtTime(project.durationSec)}). Jeśli przeglądarka nie wspiera MP4, zapiszemy WebM.
                  </p>
                )}
              </div>

              {exportFormat === "mp4" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <PanelLabel>Jakość</PanelLabel>
                    <select value={exportQuality} onChange={(e) => setExportQuality(e.target.value as "standard" | "high")} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <option value="standard">Standard (5 Mbps)</option>
                      <option value="high">Wysoka (10 Mbps)</option>
                    </select>
                  </div>
                  <div>
                    <PanelLabel>Płynność</PanelLabel>
                    <select value={exportFps} onChange={(e) => setExportFps(Number(e.target.value) as 24 | 30)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <option value={24}>24 FPS</option>
                      <option value={30}>30 FPS</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <PanelLabel>Produkt (opcjonalnie)</PanelLabel>
                <select
                  value={project.productId ?? ""}
                  onChange={(e) => {
                    const p = products.find((x) => x.id === e.target.value);
                    setProjectState((prev) => ({ ...prev, productId: p?.id ?? null, productName: p?.name ?? null }));
                  }}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">— brak —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <PanelLabel>Kampania (opcjonalnie)</PanelLabel>
                <input
                  value={project.campaignName ?? ""}
                  onChange={(e) => setProjectState((prev) => ({ ...prev, campaignName: e.target.value || null }))}
                  placeholder="np. Wiosenna promocja"
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              {exporting && exportFormat === "mp4" && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-accent transition-all" style={{ width: `${Math.round(exportProgress * 100)}%` }} />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={exporting} onClick={() => setShowExport(false)} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
                Anuluj
              </button>
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting ? "Eksportuję…" : "Eksportuj"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ---------- Komponenty pomocnicze ---------- */

function IconBtn({ children, title, onClick, disabled }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ToolButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-xs hover:bg-muted">
      {icon}
      {label}
    </button>
  );
}

function LibTabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 ${active ? "bg-background font-medium shadow-soft" : "text-muted-foreground"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyLib({ text }: { text: string }) {
  return <p className="col-span-2 py-6 text-center text-xs text-muted-foreground">{text}</p>;
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>;
}

function LayerRow({
  active,
  label,
  isAudio,
  isBaseVideo,
  hidden,
  locked,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onUp,
  onDown,
  onDelete,
  hideVisibilityControls,
}: {
  active: boolean;
  label: string;
  isAudio?: boolean;
  isBaseVideo?: boolean;
  hidden: boolean;
  locked: boolean;
  onSelect: () => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onDelete: () => void;
  hideVisibilityControls?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 text-xs ${active ? "border-accent bg-accent/10" : "border-border"}`}>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        {isAudio ? (
          <Music className="h-3.5 w-3.5 shrink-0 text-amber-600" />
        ) : isBaseVideo ? (
          <Video className="h-3.5 w-3.5 shrink-0 text-blue-600" />
        ) : (
          <Type className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{label}</span>
      </button>
      {!hideVisibilityControls && (
        <>
          <button type="button" title="Pokaż/ukryj" onClick={onToggleHidden} className="text-muted-foreground hover:text-foreground">
            {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button type="button" title="Zablokuj" onClick={onToggleLocked} className="text-muted-foreground hover:text-foreground">
            {locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          </button>
        </>
      )}
      {onUp && (
        <button type="button" title="W górę" onClick={onUp} className="text-muted-foreground hover:text-foreground">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      )}
      {onDown && (
        <button type="button" title="W dół" onClick={onDown} className="text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
      <button type="button" title="Usuń" onClick={onDelete} className="text-red-600 hover:opacity-80">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ElementView({
  el,
  selected,
  stageHeight,
  onMoveDown,
  onResizeDown,
}: {
  el: EditorElement;
  selected: boolean;
  stageHeight: number;
  onMoveDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent) => void;
}) {
  const ring = selected ? "outline outline-2 outline-accent" : "";
  const handle = selected && !el.locked && (
    <span
      onPointerDown={onResizeDown}
      className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-se-resize rounded-full border border-white bg-accent shadow"
    />
  );

  if (el.type === "text") {
    return (
      <div
        onPointerDown={onMoveDown}
        style={{
          left: `${el.x * 100}%`,
          top: `${el.y * 100}%`,
          transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
          color: el.color,
          fontFamily: el.fontFamily,
          fontWeight: el.fontWeight,
          fontSize: `${Math.max(8, el.fontSize * stageHeight)}px`,
          textAlign: el.align,
          whiteSpace: "pre",
        }}
        className={`absolute cursor-move select-none leading-tight ${ring}`}
      >
        {el.text}
        {handle}
      </div>
    );
  }
  if (el.type === "image") {
    return (
      <div
        onPointerDown={onMoveDown}
        style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, opacity: el.opacity }}
        className={`absolute cursor-move ${ring}`}
      >
        <img src={el.src} alt="" draggable={false} className="h-full w-full object-contain" />
        {handle}
      </div>
    );
  }
  return (
    <div
      onPointerDown={onMoveDown}
      style={{
        left: `${el.x * 100}%`,
        top: `${el.y * 100}%`,
        width: `${el.w * 100}%`,
        height: `${el.h * 100}%`,
        backgroundColor: el.color,
        opacity: el.opacity,
        borderRadius: el.type === "ellipse" ? "9999px" : `${el.radius}px`,
      }}
      className={`absolute cursor-move ${ring}`}
    >
      {handle}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function TimingRows({ startTime, endTime, duration, onChange }: { startTime: number; endTime: number; duration: number; onChange: (p: { startTime?: number; endTime?: number }) => void }) {
  return (
    <>
      <Row label="Pojawia się">
        <input type="range" min={0} max={duration} step={0.1} value={startTime} onChange={(e) => onChange({ startTime: Math.min(Number(e.target.value), endTime - 0.2) })} className="w-full" />
      </Row>
      <Row label="Znika">
        <input type="range" min={0} max={duration} step={0.1} value={endTime} onChange={(e) => onChange({ endTime: Math.max(Number(e.target.value), startTime + 0.2) })} className="w-full" />
      </Row>
      <p className="text-[11px] text-muted-foreground">
        {fmtTime(startTime)} – {fmtTime(endTime)}
      </p>
    </>
  );
}

function ProjectSettings({ project, onChange, onExport }: { project: EditorProject; onChange: (patch: Partial<EditorProject>) => void; onExport: () => void }) {
  return (
    <>
      <div>
        <PanelLabel>Ustawienia projektu</PanelLabel>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange({ aspect: r.id as EditorAspect })}
              className={`rounded-lg border px-2 py-1.5 text-xs ${project.aspect === r.id ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"}`}
            >
              {r.id}
            </button>
          ))}
        </div>
      </div>
      <Row label="Kolor tła">
        <input type="color" value={project.bgColor} onChange={(e) => onChange({ bgColor: e.target.value })} className="h-7 w-10 cursor-pointer rounded border border-border" />
      </Row>
      <Row label="Czas (s)">
        <input
          type="number"
          min={1}
          max={MAX_PROJECT_DURATION_SEC}
          step={1}
          value={project.durationSec}
          onChange={(e) => onChange({ durationSec: clamp(Number(e.target.value) || 1, 1, MAX_PROJECT_DURATION_SEC) })}
          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-sm"
        />
      </Row>
      {project.baseKind === "video" && project.baseDuration != null && project.baseDuration > 0 && (
        <button
          type="button"
          onClick={() =>
            onChange({ durationSec: Math.min(Math.round(project.baseDuration! * 10) / 10, MAX_PROJECT_DURATION_SEC) })
          }
          className="w-full rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Dopasuj do wideo ({fmtTime(project.baseDuration)})
        </button>
      )}
      <p className="text-[11px] text-muted-foreground">
        {project.baseKind === "video"
          ? "Długość ustawia się automatycznie po wczytaniu wideo (max 10 min)."
          : `Maks. ${MAX_PROJECT_DURATION_SEC / 60} min.`}
      </p>
      {project.baseKind === "video" && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={project.muteBase} onChange={(e) => onChange({ muteBase: e.target.checked })} />
          Wycisz oryginalny dźwięk wideo
        </label>
      )}
      <button type="button" onClick={onExport} className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90">
        <Download className="h-4 w-4" /> Eksportuj kreację
      </button>
      <p className="text-[11px] text-muted-foreground">Zaznacz element na podglądzie lub w warstwach, aby edytować jego ustawienia.</p>
    </>
  );
}

function BaseSettings({
  project,
  onChange,
  onReset,
  onRemove,
}: {
  project: EditorProject;
  onChange: (patch: Partial<EditorProject>) => void;
  onReset: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <PanelLabel>{project.baseKind === "video" ? "Wideo (tło)" : "Obraz (tło)"}</PanelLabel>
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-xs text-red-600 hover:opacity-80">
          <Trash2 className="h-3.5 w-3.5" /> Usuń
        </button>
      </div>
      <p className="line-clamp-1 text-xs text-muted-foreground">{project.baseName || project.baseSrc}</p>
      <Row label="Rozmiar">
        <input type="range" min={0.2} max={4} step={0.02} value={project.baseScale} onChange={(e) => onChange({ baseScale: Number(e.target.value) })} className="w-full" />
      </Row>
      <Row label="Poziomo">
        <input type="range" min={-1} max={1} step={0.01} value={project.baseOffsetX} onChange={(e) => onChange({ baseOffsetX: Number(e.target.value) })} className="w-full" />
      </Row>
      <Row label="Pionowo">
        <input type="range" min={-1} max={1} step={0.01} value={project.baseOffsetY} onChange={(e) => onChange({ baseOffsetY: Number(e.target.value) })} className="w-full" />
      </Row>
      <button type="button" onClick={onReset} className="w-full rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
        Wyśrodkuj i przywróć rozmiar
      </button>
      {project.baseKind === "video" && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={project.muteBase} onChange={(e) => onChange({ muteBase: e.target.checked })} />
          Wycisz oryginalny dźwięk wideo
        </label>
      )}
      <p className="text-[11px] text-muted-foreground">Wskazówka: przeciągaj materiał na podglądzie, aby zmienić pozycję, a uchwyt w rogu — aby zmienić rozmiar.</p>
    </div>
  );
}

function ElementSettings({
  element,
  duration,
  onChange,
  onDelete,
}: {
  element: EditorElement;
  duration: number;
  onChange: (patch: Partial<EditorElement>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <PanelLabel>{element.type === "text" ? "Tekst" : element.type === "image" ? "Grafika / logo" : "Kształt"}</PanelLabel>
        <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 text-xs text-red-600 hover:opacity-80">
          <Trash2 className="h-3.5 w-3.5" /> Usuń
        </button>
      </div>

      {element.type === "text" && (
        <>
          <textarea value={element.text} onChange={(e) => onChange({ text: e.target.value })} rows={2} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm" />
          <Row label="Font">
            <select value={element.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs">
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Rozmiar">
            <input type="range" min={0.02} max={0.3} step={0.005} value={element.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) })} className="w-full" />
          </Row>
          <Row label="Grubość">
            <select value={element.fontWeight} onChange={(e) => onChange({ fontWeight: Number(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs">
              <option value={400}>Normalna</option>
              <option value={600}>Średnia</option>
              <option value={700}>Pogrubiona</option>
              <option value={900}>Bardzo gruba</option>
            </select>
          </Row>
          <Row label="Wyrównanie">
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button key={a} type="button" onClick={() => onChange({ align: a })} className={`flex-1 rounded border px-2 py-1 text-xs ${element.align === a ? "border-foreground bg-foreground text-background" : "border-border"}`}>
                  {a === "left" ? "L" : a === "center" ? "C" : "P"}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Obrót">
            <input type="range" min={-180} max={180} step={1} value={element.rotation} onChange={(e) => onChange({ rotation: Number(e.target.value) })} className="w-full" />
          </Row>
          <Row label="Kolor">
            <input type="color" value={element.color} onChange={(e) => onChange({ color: e.target.value })} className="h-7 w-10 cursor-pointer rounded border border-border" />
          </Row>
        </>
      )}

      {(element.type === "rect" || element.type === "ellipse") && (
        <>
          <Row label="Szerokość">
            <input type="range" min={0.05} max={1} step={0.01} value={element.w} onChange={(e) => onChange({ w: Number(e.target.value) })} className="w-full" />
          </Row>
          <Row label="Wysokość">
            <input type="range" min={0.05} max={1} step={0.01} value={element.h} onChange={(e) => onChange({ h: Number(e.target.value) })} className="w-full" />
          </Row>
          {element.type === "rect" && (
            <Row label="Zaokrągl.">
              <input type="range" min={0} max={120} step={1} value={element.radius} onChange={(e) => onChange({ radius: Number(e.target.value) })} className="w-full" />
            </Row>
          )}
          <Row label="Krycie">
            <input type="range" min={0.1} max={1} step={0.05} value={element.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} className="w-full" />
          </Row>
          <Row label="Kolor">
            <input type="color" value={element.color} onChange={(e) => onChange({ color: e.target.value })} className="h-7 w-10 cursor-pointer rounded border border-border" />
          </Row>
        </>
      )}

      {element.type === "image" && (
        <>
          <Row label="Szerokość">
            <input type="range" min={0.05} max={1} step={0.01} value={element.w} onChange={(e) => onChange({ w: Number(e.target.value) })} className="w-full" />
          </Row>
          <Row label="Wysokość">
            <input type="range" min={0.05} max={1} step={0.01} value={element.h} onChange={(e) => onChange({ h: Number(e.target.value) })} className="w-full" />
          </Row>
          <Row label="Krycie">
            <input type="range" min={0.1} max={1} step={0.05} value={element.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} className="w-full" />
          </Row>
        </>
      )}

      <div className="border-t border-border pt-2">
        <PanelLabel>Czas na osi</PanelLabel>
        <div className="mt-2 space-y-2">
          <TimingRows startTime={element.startTime} endTime={element.endTime} duration={duration} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

function AudioSettings({
  audio,
  duration,
  onChange,
  onDelete,
}: {
  audio: EditorAudio;
  duration: number;
  onChange: (patch: Partial<EditorAudio>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <PanelLabel>Audio</PanelLabel>
        <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 text-xs text-red-600 hover:opacity-80">
          <Trash2 className="h-3.5 w-3.5" /> Usuń
        </button>
      </div>
      <p className="line-clamp-1 text-xs text-muted-foreground">{audio.name}</p>
      <Row label="Głośność">
        <input type="range" min={0} max={1} step={0.05} value={audio.volume} onChange={(e) => onChange({ volume: Number(e.target.value) })} className="w-full" />
      </Row>
      <Row label="Start (s)">
        <input type="range" min={0} max={duration} step={0.1} value={audio.startAt} onChange={(e) => onChange({ startAt: clamp(Number(e.target.value), 0, duration - 0.2) })} className="w-full" />
      </Row>
      <Row label="Długość (s)">
        <input type="range" min={0.2} max={duration} step={0.1} value={audio.duration} onChange={(e) => onChange({ duration: clamp(Number(e.target.value), 0.2, duration - audio.startAt) })} className="w-full" />
      </Row>
      <Row label="Przytnij od">
        <input type="range" min={0} max={Math.max(0.2, duration)} step={0.1} value={audio.trimStart} onChange={(e) => onChange({ trimStart: Math.max(0, Number(e.target.value)) })} className="w-full" />
      </Row>
      <Row label="Fade in">
        <input type="range" min={0} max={5} step={0.1} value={audio.fadeIn} onChange={(e) => onChange({ fadeIn: Number(e.target.value) })} className="w-full" />
      </Row>
      <Row label="Fade out">
        <input type="range" min={0} max={5} step={0.1} value={audio.fadeOut} onChange={(e) => onChange({ fadeOut: Number(e.target.value) })} className="w-full" />
      </Row>
      <p className="text-[11px] text-muted-foreground">
        {fmtTime(audio.startAt)} – {fmtTime(audio.startAt + audio.duration)}
      </p>
    </div>
  );
}

function TimelineRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-stretch gap-2">
      <span className="flex w-16 shrink-0 items-center text-[10px] font-medium uppercase text-muted-foreground">{label}</span>
      <div className="relative h-8 flex-1 rounded bg-muted/60">{children}</div>
    </div>
  );
}

function TimelineBlock({
  startPct,
  widthPct,
  color,
  active,
  label,
  onDown,
}: {
  startPct: number;
  widthPct: number;
  color: string;
  active: boolean;
  label: string;
  onDown: (e: React.PointerEvent, mode: "move" | "trimL" | "trimR") => void;
}) {
  return (
    <div
      onPointerDown={(e) => onDown(e, "move")}
      style={{ left: `${startPct}%`, width: `${Math.max(2, widthPct)}%` }}
      className={`absolute inset-y-1 flex cursor-grab items-center overflow-hidden rounded px-2 text-[10px] ${color} ${active ? "ring-2 ring-accent" : ""}`}
    >
      <span
        onPointerDown={(e) => {
          e.stopPropagation();
          onDown(e, "trimL");
        }}
        className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/20"
      />
      <span className="truncate">{label}</span>
      <span
        onPointerDown={(e) => {
          e.stopPropagation();
          onDown(e, "trimR");
        }}
        className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-black/20"
      />
    </div>
  );
}
