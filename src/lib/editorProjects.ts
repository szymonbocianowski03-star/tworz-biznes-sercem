// Model projektów edytora kreacji + zapis w localStorage (prefiks "mn." —
// czyszczony przy zmianie konta przez localUserData). To szkice; eksport trafia
// do biblioteki Zasoby (generated_images / generated_videos) osobno.

export type EditorAspect = "1:1" | "4:5" | "9:16" | "16:9";

export const ASPECT_RATIOS: { id: EditorAspect; label: string; w: number; h: number }[] = [
  { id: "1:1", label: "Kwadrat 1:1", w: 1, h: 1 },
  { id: "4:5", label: "Pionowy 4:5", w: 4, h: 5 },
  { id: "9:16", label: "Story 9:16", w: 9, h: 16 },
  { id: "16:9", label: "Poziomy 16:9", w: 16, h: 9 },
];

/** Maksymalna długość projektu (s). */
export const MAX_PROJECT_DURATION_SEC = 600;

/** Domyślna długość projektu bez wideo (s). */
export const DEFAULT_PROJECT_DURATION_SEC = 15;

/** Dłuższy bok eksportu w px. */
export const EXPORT_LONG_EDGE = 1080;

export function aspectDimensions(aspect: EditorAspect, longEdge = EXPORT_LONG_EDGE): { width: number; height: number } {
  const r = ASPECT_RATIOS.find((a) => a.id === aspect) ?? ASPECT_RATIOS[0];
  if (r.w >= r.h) {
    return { width: longEdge, height: Math.round((longEdge * r.h) / r.w) };
  }
  return { width: Math.round((longEdge * r.w) / r.h), height: longEdge };
}

/** Wspólne pola czasowe i warstwowe elementów. */
type TimedFlags = {
  startTime: number; // sekunda pojawienia
  endTime: number; // sekunda zniknięcia
  hidden: boolean;
  locked: boolean;
};

/** Wszystkie pozycje/rozmiary jako ułamek wymiaru płótna (0..1) — niezależne od skali podglądu. */
export type TextElement = TimedFlags & {
  id: string;
  type: "text";
  text: string;
  x: number; // środek elementu (0..1)
  y: number;
  fontSize: number; // ułamek wysokości płótna
  color: string;
  fontFamily: string;
  fontWeight: number;
  align: "left" | "center" | "right";
  rotation: number; // stopnie
};

export type ShapeElement = TimedFlags & {
  id: string;
  type: "rect" | "ellipse";
  x: number; // lewy-górny róg (0..1)
  y: number;
  w: number;
  h: number;
  color: string;
  radius: number; // px zaokrąglenia (dla rect)
  opacity: number; // 0..1
};

export type ImageOverlayElement = TimedFlags & {
  id: string;
  type: "image";
  src: string;
  name: string;
  x: number; // lewy-górny róg (0..1)
  y: number;
  w: number; // ułamek szerokości
  h: number; // ułamek wysokości
  opacity: number;
};

export type EditorElement = TextElement | ShapeElement | ImageOverlayElement;

export type EditorAudio = {
  id: string;
  src: string;
  name: string;
  volume: number; // 0..1
  startAt: number; // pozycja startu na osi czasu (s)
  trimStart: number; // przesunięcie wewnątrz źródła (s)
  duration: number; // długość na osi czasu (s)
  fadeIn: number; // s
  fadeOut: number; // s
  hidden: boolean;
  locked: boolean;
};

export type EditorProject = {
  id: string;
  name: string;
  baseKind: "image" | "video" | "blank";
  baseSrc: string | null;
  baseName: string | null;
  baseDuration: number | null; // naturalny czas wideo (s)
  baseScale: number; // mnożnik względem wypełnienia (1 = cover)
  baseOffsetX: number; // przesunięcie w ułamku szerokości
  baseOffsetY: number; // przesunięcie w ułamku wysokości
  bgColor: string;
  aspect: EditorAspect;
  durationSec: number; // długość kreacji
  muteBase: boolean; // wycisz oryginalny dźwięk wideo
  elements: EditorElement[]; // kolejność = warstwy (ostatni = na wierzchu)
  audios: EditorAudio[];
  productId: string | null;
  productName: string | null;
  campaignName: string | null;
  thumbnail: string | null;
  createdAt: number;
  updatedAt: number;
};

const KEY = "mn.editor.projects.v1";

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function subscribeEditorProjects(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Uzupełnia brakujące pola (kompatybilność starszych szkiców). */
export function normalizeProject(raw: unknown): EditorProject {
  const p = (raw ?? {}) as Record<string, unknown>;
  const now = Date.now();
  const durationSec =
    typeof p.durationSec === "number" && p.durationSec > 0 ? p.durationSec : DEFAULT_PROJECT_DURATION_SEC;

  const elements: EditorElement[] = Array.isArray(p.elements)
    ? (p.elements as Record<string, unknown>[]).map((e) => ({
        startTime: 0,
        endTime: durationSec,
        hidden: false,
        locked: false,
        name: typeof e.name === "string" ? e.name : "",
        ...(e as object),
      }) as EditorElement)
    : [];

  // Legacy: pojedyncze audio → tablica
  let audios: EditorAudio[] = [];
  if (Array.isArray(p.audios)) {
    audios = (p.audios as Record<string, unknown>[]).map((a) => ({
      id: typeof a.id === "string" ? a.id : newId("aud"),
      src: String(a.src ?? ""),
      name: String(a.name ?? "Audio"),
      volume: typeof a.volume === "number" ? a.volume : 1,
      startAt: typeof a.startAt === "number" ? a.startAt : 0,
      trimStart: typeof a.trimStart === "number" ? a.trimStart : 0,
      duration: typeof a.duration === "number" ? a.duration : durationSec,
      fadeIn: typeof a.fadeIn === "number" ? a.fadeIn : 0,
      fadeOut: typeof a.fadeOut === "number" ? a.fadeOut : 0,
      hidden: Boolean(a.hidden),
      locked: Boolean(a.locked),
    }));
  } else if (p.audio && typeof p.audio === "object") {
    const a = p.audio as Record<string, unknown>;
    audios = [
      {
        id: newId("aud"),
        src: String(a.src ?? ""),
        name: String(a.name ?? "Audio"),
        volume: typeof a.volume === "number" ? a.volume : 1,
        startAt: typeof a.startAt === "number" ? a.startAt : 0,
        trimStart: 0,
        duration: durationSec,
        fadeIn: 0,
        fadeOut: 0,
        hidden: false,
        locked: false,
      },
    ];
  }

  return {
    id: typeof p.id === "string" ? p.id : `proj_${now.toString(36)}`,
    name: typeof p.name === "string" ? p.name : "Nowa kreacja",
    baseKind: (p.baseKind as EditorProject["baseKind"]) ?? "blank",
    baseSrc: typeof p.baseSrc === "string" ? p.baseSrc : null,
    baseName: typeof p.baseName === "string" ? p.baseName : null,
    baseDuration: typeof p.baseDuration === "number" ? p.baseDuration : null,
    baseScale: typeof p.baseScale === "number" && p.baseScale > 0 ? p.baseScale : 1,
    baseOffsetX: typeof p.baseOffsetX === "number" ? p.baseOffsetX : 0,
    baseOffsetY: typeof p.baseOffsetY === "number" ? p.baseOffsetY : 0,
    bgColor: typeof p.bgColor === "string" ? p.bgColor : "#ffffff",
    aspect: (p.aspect as EditorAspect) ?? "1:1",
    durationSec,
    muteBase: Boolean(p.muteBase),
    elements,
    audios,
    productId: typeof p.productId === "string" ? p.productId : null,
    productName: typeof p.productName === "string" ? p.productName : null,
    campaignName: typeof p.campaignName === "string" ? p.campaignName : null,
    thumbnail: typeof p.thumbnail === "string" ? p.thumbnail : null,
    createdAt: typeof p.createdAt === "number" ? p.createdAt : now,
    updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : now,
  };
}

export function listEditorProjects(): EditorProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? (JSON.parse(raw) as unknown[]) : [];
    return items.map(normalizeProject).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function getEditorProject(id: string): EditorProject | null {
  return listEditorProjects().find((p) => p.id === id) ?? null;
}

export function saveEditorProject(project: EditorProject): void {
  if (typeof window === "undefined") return;
  const all = listEditorProjects().filter((p) => p.id !== project.id);
  all.unshift({ ...project, updatedAt: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(all));
  emit();
}

export function deleteEditorProject(id: string): void {
  if (typeof window === "undefined") return;
  const all = listEditorProjects().filter((p) => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
  emit();
}

export function createBlankProject(partial?: Partial<EditorProject>): EditorProject {
  const now = Date.now();
  return {
    id: `proj_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: "Nowa kreacja",
    baseKind: "blank",
    baseSrc: null,
    baseName: null,
    baseDuration: null,
    baseScale: 1,
    baseOffsetX: 0,
    baseOffsetY: 0,
    bgColor: "#ffffff",
    aspect: "1:1",
    durationSec: DEFAULT_PROJECT_DURATION_SEC,
    muteBase: false,
    elements: [],
    audios: [],
    productId: null,
    productName: null,
    campaignName: null,
    thumbnail: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Czy element jest widoczny w danej sekundzie. */
export function isVisibleAt(el: EditorElement, time: number): boolean {
  if (el.hidden) return false;
  return time >= el.startTime - 1e-3 && time < el.endTime - 1e-3;
}

export const FONT_FAMILIES: { value: string; label: string }[] = [
  { value: "Inter, system-ui, sans-serif", label: "Inter (domyślny)" },
  { value: "Georgia, serif", label: "Georgia (serif)" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Courier New', monospace", label: "Courier (mono)" },
  { value: "Impact, sans-serif", label: "Impact (mocny)" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet" },
];

export function elementLabel(el: EditorElement): string {
  if (el.type === "text") return el.text.split("\n")[0].slice(0, 24) || "Tekst";
  if (el.type === "image") return el.name || "Grafika / logo";
  return el.type === "rect" ? "Prostokąt" : "Koło";
}
