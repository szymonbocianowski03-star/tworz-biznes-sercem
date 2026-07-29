import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, TrendingUp, Megaphone, MousePointerClick, Mail, BarChart3, Rocket, Eye, Play, FileText, ArrowRight, Compass, Pencil, X, ImagePlus, Square, Clock, RotateCw, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { useCreditsUpgrade } from "@/contexts/CreditsUpgradeContext";
import { useChats } from "@/hooks/useChats";
import { useProducts } from "@/hooks/useProducts";
import { formatBrandContextForAgent, useBrands } from "@/hooks/useBrands";
import { useCredits } from "@/hooks/useCredits";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_META, type Scenario, type ScenarioCategory, SCENARIOS } from "@/lib/scenarioLibrary";
import { saveImageToProjectAssets, VIDEO_PROMPT_SEED_KEY } from "@/lib/saveProjectAsset";
import { readImageAsDataUrl } from "@/lib/readImageAsDataUrl";
import { supabaseFnHeaders } from "@/lib/supabaseFnHeaders";
import { ASSET_AGENT_SEED_KEY, type AssetAgentSeedPayload } from "@/lib/assetAgentSeed";
import { scheduleCreditsRefresh } from "@/lib/creditsRefresh";
import { callGenerateImageApi, chooseImageSizeFromPrompt } from "@/lib/adImageGeneration";
import { checkImageGenerationAffordability } from "@/lib/imageCreditsGate";
import { GeneratedImageToolbar } from "@/components/GeneratedImageToolbar";
import { supabaseEdgeFunctionUrl } from "@/integrations/supabase/publicEnv";
import { getUserCalendarStatus, scheduleUserCalendarEvent } from "@/lib/userCalendar.functions";
import { getUserEmailStatus, sendUserEmail } from "@/lib/userEmail.functions";
import {
  addMinutesIso,
  extractCalMarkers,
  normalizeCalDateTime,
  stripCalMarkers,
} from "@/lib/agentCalendar";
import {
  extractMailMarker,
  isValidEmail,
  mailBodyToHtml,
  stripMailMarkers,
  stripFalseSentClaims,
  type MailDraft,
} from "@/lib/agentEmail";

type ImageEntry = { url: string; dbId: string | null; prompt: string };
type Msg = { role: "user" | "assistant"; content: string; images?: string[]; imageSet?: ImageEntry[] };

function chatMessagesPayload(messages: Msg[]): { role: Msg["role"]; content: string }[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

const CHAT_URL = supabaseEdgeFunctionUrl("chat");
const SUGGEST_URL = supabaseEdgeFunctionUrl("suggest");

/** Prośba o generację wideo lub przejście do generatora — nie generuj grafik w czacie. */
function shouldOpenVideoGenerator(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(wideo|film|filmik|reels|tiktok|rolk|short.?form|stories)\b/.test(t)) {
    if (/\b(wygeneruj|generuj|stwórz|zrób|utwórz|nagraj|zrób mi|otwórz|przejdź)\b/.test(t)) return true;
    if (/\b(generator wideo|generator film)\b/.test(t)) return true;
  }
  return false;
}

/** Użytkownik wyraźnie prosi o grafiki (nie wideo) — wtedy można auto-generować pojedynczy [IMG:]. */
function userExplicitlyWantsImages(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(wideo|film|filmik|reels|tiktok)\b/.test(t)) return false;
  return (
    (/\b(generuj|wygeneruj|stwórz|zrób)\b/.test(t) &&
      /\b(grafik|obraz|kreacj|baner|plakat|poster|visual|creative|reklam)\b/.test(t)) ||
    /\b(generuj wszystko|wygeneruj wszystko)\b/.test(t)
  );
}
const USER_SKILLS_KEY = "mn.userSkills.v1";
const LLM_VIS_AGENT_SEED_KEY = "mn.llmVis.agentSeed";

// Parsuje końcowy blok Q&A z odpowiedzi bota.
// Format:
//   Q: pytanie
//   A: opcja 1
//   A: opcja 2
// Zwraca { body: tekst bez bloku, question, options[] } albo null jeśli nie znaleziono.
function extractQA(
  content: string,
): { body: string; question: string; options: string[]; multi: boolean } | null {
  if (!content) return null;
  const lines = content.split("\n");
  // znajdź ostatnie "Q:" które ma pod sobą same A: (lub nic = open input)
  let qIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim().replace(/^[`*_>#-]+\s*/, "");
    if (/^Q:\s*/i.test(l)) { qIdx = i; break; }
  }
  if (qIdx === -1) return null;
  const qLineRaw = lines[qIdx].trim().replace(/^[`*_>#-]+\s*/, "");
  const question = qLineRaw.replace(/^Q:\s*/i, "").trim();
  const options: string[] = [];
  for (let i = qIdx + 1; i < lines.length; i++) {
    const l = lines[i].trim().replace(/^[`*_>#-]+\s*/, "");
    if (!l) continue;
    const m = l.match(/^A:\s*(.+)$/i);
    if (m) {
      const opt = m[1].trim();
      // Jeśli model zwraca placeholder typu "<wpisz ...>" albo "[wpisz ...]",
      // traktuj to jako open input, nie jako “przycisk do kliknięcia”.
      const isBracketPlaceholder = /^<[^>]+>$/.test(opt) || /^\[[^\]]+\]$/.test(opt);
      const normalized = opt
        .replace(/^<|>$/g, "")
        .replace(/^\[|\]$/g, "")
        .toLowerCase()
        .trim();
      const looksLikeTypingInstruction =
        /\b(wpisz|podaj|wklej|enter|type)\b/.test(normalized) &&
        /\b(url|link|adres|e-?mail|email|imię|nazwa|telefon)\b/.test(normalized);

      if (!isBracketPlaceholder && !looksLikeTypingInstruction) options.push(opt);
    }
    else return null; // śmieci po Q — nie traktuj jako Q&A
  }
  if (!question) return null;
  // body = wszystko przed Q: (usuń też ewentualne ``` fencing wokół bloku)
  let body = lines.slice(0, qIdx).join("\n").trim();
  body = body.replace(/```\s*$/, "").trim();
  // Wielokrotny wybór: pytanie zawiera adnotację typu „(Select all that apply)”.
  const multi =
    options.length > 0 &&
    /select all that apply|można wybra(?:ć|c) kilka|wybierz wszystkie|zaznacz wszystkie|wiele odpowiedzi|kilka opcji|multiple answers/i.test(
      question,
    );
  return { body, question, options, multi };
}

function qaInputPlaceholder(question: string): string {
  if (/url|adres|stron|link|domen|http/i.test(question)) return "https://twoja-strona.pl";
  if (/e-?mail/i.test(question)) return "np. jan@firma.pl";
  if (/telefon|numer/i.test(question)) return "np. +48 123 456 789";
  return "Wpisz odpowiedź…";
}

function qaInputType(question: string): "text" | "url" | "email" {
  if (/url|adres|stron|link|domen|http/i.test(question)) return "url";
  if (/e-?mail/i.test(question)) return "email";
  return "text";
}

type QaReplyFieldProps = {
  question: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  loading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

function QaReplyField({ question, value, onChange, onSubmit, loading, inputRef }: QaReplyFieldProps) {
  const type = qaInputType(question);
  return (
    <form
      className="flex items-stretch gap-2 rounded-xl border border-neutral-200 bg-neutral-50/80 p-1.5 focus-within:border-neutral-400 focus-within:bg-white focus-within:shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim();
        if (!v || loading) return;
        onSubmit(v);
      }}
    >
      <input
        ref={inputRef}
        type={type}
        inputMode={type === "url" ? "url" : type === "email" ? "email" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={qaInputPlaceholder(question)}
        disabled={loading}
        className="flex-1 min-w-0 rounded-lg border-0 bg-transparent px-3 py-2.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="inline-flex items-center self-center px-4 py-2 rounded-lg bg-neutral-900 text-white text-[12px] font-medium disabled:opacity-30 hover:bg-neutral-800 transition-colors shrink-0"
      >
        Wyślij
      </button>
    </form>
  );
}

// Wbudowane skille (40+ plików SKILL.md) — wstrzykiwane do każdej rozmowy,
// żeby NOW znał ich treść, a nie tylko nazwy z indeksu.
const BUILTIN_SKILL_FILES = import.meta.glob("../skills/**/SKILL.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function parseSkillBody(raw: string): { name: string; body: string } {
  let body = raw.replace(/^---[\s\S]*?---\s*/, "");
  const h1 = body.match(/^#\s+(.+)$/m);
  const name = h1 ? h1[1].trim() : "Skill";
  body = body.replace(/^#\s+.+$/m, "").trim();
  return { name, body };
}

/** Pełna treść skilli (budżet ~50k znaków) — agent musi trzymać się tych frameworków. */
const BUILTIN_SKILLS_DIGEST: string = (() => {
  const MAX_TOTAL = 50_000;
  const entries = Object.entries(BUILTIN_SKILL_FILES)
    .map(([path, raw]) => {
      const id = path.replace(/^.*\/skills\//, "").replace(/\/SKILL\.md$/, "");
      const { name, body } = parseSkillBody(raw);
      return { id, name, body };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const perSkill = Math.min(2_500, Math.floor(MAX_TOTAL / Math.max(entries.length, 1)));
  let used = 0;
  const parts: string[] = [];

  for (const { id, name, body } of entries) {
    if (used >= MAX_TOTAL) break;
    const budget = Math.min(perSkill, MAX_TOTAL - used);
    const chunk = body.slice(0, budget).trim();
    parts.push(`### ${id} — ${name}\n${chunk}`);
    used += chunk.length;
  }

  return parts.join("\n\n");
})();

const GREETINGS = [
  "Od czego zaczynamy?",
  "Co dziś tworzymy?",
  "Jaką kampanię odpalamy?",
  "Co planujemy na dziś?",
  "W co dziś gramy?",
  "Jaki ruch robimy?",
  "Co dowieziemy dziś?",
  "Nad czym pracujemy?",
  "Jaki jest plan?",
  "Co testujemy dziś?",
  "Jaki content dziś robimy?",
  "Co skalujemy dziś?",
];

const QUICK = [
  { label: "Strategia", icon: Compass, prompt: "Ułóż szybkie pozycjonowanie mojego produktu: klient idealny, problem, przewaga, dowody." },
  { label: "Kampanie reklamowe", icon: Megaphone, prompt: "Zbuduj pakiet reklam (wyszukiwarka + social) i plan testów A/B." },
  { label: "Treści i grafiki", icon: Pencil, prompt: "Zaproponuj plan treści na 4 tygodnie oraz haczyki do krótkich filmów." },
  { label: "Wiadomości i mailing", icon: Mail, prompt: "Stwórz sekwencję powitalną i aktywacyjną (3–5 maili) z harmonogramem." },
  { label: "Wyniki i raporty", icon: BarChart3, prompt: "Zdiagnozuj, gdzie na ścieżce sprzedaży odpadają klienci, i zaproponuj testy." },
  { label: "Premiera", icon: Rocket, prompt: "Przygotuj checklistę przed premierą i plan tygodnia publikacji." },
  { label: "Widoczność marki w AI", icon: Eye, prompt: "Zrób analizę widoczności marki w odpowiedziach asystentów AI — wnioski i plan działań na 30 dni." },
];

const QUICK_SUGGESTIONS_FALLBACK: Record<(typeof QUICK)[number]["label"], string[]> = {
  Strategia: [
    "Ułóż pozycjonowanie: klient idealny, problem, alternatywy, dowody — na jednej stronie.",
    "Wypisz 5 hipotez wzrostu na 90 dni (wpływ vs wysiłek).",
    "Zaproponuj mapę konkurencji: kto jest bezpośredni i pośredni oraz czym się różnimy.",
    "Ułóż strategię kanałów: Meta, Google, LinkedIn, TikTok pod mój produkt.",
    "Zdefiniuj jedno zdanie „dlaczego my” + 3 warianty pod różne segmenty.",
  ],
  "Kampanie reklamowe": [
    "Wygeneruj 5 wariantów reklam Meta (nagłówek + tekst + wezwanie do działania).",
    "Zrób 5 zestawów reklam Google (krótkie nagłówki + opisy) pod główne intencje.",
    "Zaproponuj 5 konceptów kreacji wideo 15 s (kąt, obietnica, dowód, ujęcia).",
    "Napisz 5 reklam „problem → rozwiązanie” w stylu B2B, bez clickbaitu.",
    "Zaproponuj 5 ofert lub lead magnetów podnoszących konwersję reklam.",
  ],
  "Treści i grafiki": [
    "Zaproponuj 10 pomysłów na krótkie filmy (TikTok/Reels) + haczyk do każdego.",
    "Wymyśl 5 formatów krótkich filmów do nagrywania 2× w tygodniu.",
    "Ułóż plan treści na 14 dni: tematy, wezwania, wskaźniki, testy.",
    "Napisz 5 mocnych haczyków na start wideo w mojej niszy.",
    "Zaproponuj 5 postów, które użytkownicy chętnie udostępniają.",
  ],
  "Wiadomości i mailing": [
    "Napisz 5-mailową sekwencję powitalną (temat + treść) po polsku.",
    "Zrób 5 tematów maili sprzedażowych z wysoką otwieralnością (bez spamu).",
    "Zaproponuj 3 maile reaktywacyjne dla nieaktywnych leadów.",
    "Napisz 5 maili edukacyjnych budujących autorytet w branży.",
    "Ułóż 7-dniowy plan newslettera: temat, cel, wezwanie, segment.",
  ],
  "Wyniki i raporty": [
    "Przygotuj szablon raportu tygodniowego marketingu (wskaźniki + wnioski + decyzje).",
    "Jakie wskaźniki śledzić w pierwszych 30 dniach? Podziel na świadomość, rozważanie, konwersję.",
    "Zrób listę 20 pytań diagnostycznych do analizy kampanii Meta i Google.",
    "Zaproponuj zasady: co wyłączać, co skalować, co poprawiać (z progami).",
    "Wymyśl 10 hipotez, dlaczego kampanie nie dowożą i jak to szybko sprawdzić.",
  ],
  Premiera: [
    "Ułóż plan premiery na 14 dni: przed startem, dzień startu, po starcie.",
    "Napisz 5 komunikatów premierowych (post, mail, LinkedIn).",
    "Zaproponuj 5 ofert startowych bez zaniżania wartości marki.",
    "Checklista: co musi być gotowe przed uruchomieniem reklam.",
    "Wymyśl 5 pomysłów na partnerstwa w dniu premiery.",
  ],
  "Widoczność marki w AI": [
    "Przygotuj analizę: na jakie zapytania mój klient pyta asystentów AI i czy moja marka powinna się tam pojawiać — 20 zapytań + diagnoza.",
    "Zaproponuj plan treści i stron docelowych, żeby zwiększyć cytowania marki w odpowiedziach AI (30 dni).",
    "Napisz „kanoniczną definicję kategorii” + 3 warianty USP w 1 zdaniu (do cytowania przez AI).",
    "Zaproponuj 10 tematów treści (definicje, porównania, „najlepsze dla…”, case studies) z priorytetami.",
    "Audyt „czytelności dla AI”: FAQ, HowTo, schema, autor, data aktualizacji — pass/fail + konkretne poprawki.",
  ],
};

export function AgentChat() {
  const { openCreditsUpgrade } = useCreditsUpgrade();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { active: brandProduct } = useProducts();
  const { getById: getBrandById } = useBrands();
  const linkedBrand = getBrandById(brandProduct?.brandId);
  const brandVisualRules =
    linkedBrand?.brandVisualRules ?? brandProduct?.brandVisualRules ?? null;
  const brandVisualImages =
    linkedBrand?.brandVisualImages ?? brandProduct?.brandVisualImages ?? [];
  const credits = useCredits();
  const legacyName =
    typeof window !== "undefined" ? localStorage.getItem("mn.activeProduct") : null;
  const activeProduct = brandProduct?.name || legacyName || "Nowy Produkt";
  const { active, create, update } = useChats(activeProduct);

  // Ensure there's always an active chat for current product
  useEffect(() => {
    if (!active) create(activeProduct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, activeProduct]);

  // Brief z modułu „Widoczność w AI” (sessionStorage — bez pokazywania technicznego outputu użytkownikowi na tamtej stronie)
  useEffect(() => {
    try {
      const seed = sessionStorage.getItem(LLM_VIS_AGENT_SEED_KEY);
      if (!seed?.trim()) return;
      sessionStorage.removeItem(LLM_VIS_AGENT_SEED_KEY);
      setInput(seed);
      requestAnimationFrame(() => document.getElementById("agent-input")?.focus());
    } catch {
      /* ignore */
    }
  }, []);

  const messages: Msg[] = (active?.messages ?? []) as Msg[];
  const setMessages = (updater: Msg[] | ((prev: Msg[]) => Msg[])) => {
    if (!active) return;
    const next = typeof updater === "function" ? (updater as (p: Msg[]) => Msg[])(active.messages) : updater;
    update(active.id, { messages: next });
  };

  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; mediaType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [quickLabel, setQuickLabel] = useState<string | null>(null);
  const [scenarioCategory, setScenarioCategory] = useState<ScenarioCategory>("Strategy");
  const [scenariosOpen, setScenariosOpen] = useState<boolean>(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState<boolean>(false);
  const [qaCustom, setQaCustom] = useState<string>("");
  const [qaSelected, setQaSelected] = useState<string[]>([]);
  const qaInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgConfirmPrompts, setImgConfirmPrompts] = useState<string[] | null>(null);
  const [imgConfirmMessageIdx, setImgConfirmMessageIdx] = useState<number | null>(null);
  const [calConfirmMarkers, setCalConfirmMarkers] = useState<
    Array<{ start: string; title: string; description?: string }> | null
  >(null);
  const [calConfirmMessageIdx, setCalConfirmMessageIdx] = useState<number | null>(null);
  const [calConfirmAccepted, setCalConfirmAccepted] = useState(false);
  const [calScheduling, setCalScheduling] = useState(false);
  const [mailDraft, setMailDraft] = useState<(MailDraft & { messageIdx: number }) | null>(null);
  const [mailAccepted, setMailAccepted] = useState(false);
  const [mailSending, setMailSending] = useState(false);
  const mailHandledRef = useRef<Set<number>>(new Set());
  const imgRatio = "1024x1024" as const;
  const imgDefaultN = 4;

  // Kolejka promptów: można wpisywać kolejne wiadomości, czekają na zakończenie bieżącej.
  const [queue, setQueue] = useState<string[]>([]);
  // Zawieszenie generowania (Stop) — wstrzymuje też przetwarzanie kolejki i generację grafik.
  const [paused, setPaused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const imgAbortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const calScheduledRef = useRef<Set<number>>(new Set());

  const fnCalStatus = useServerFn(getUserCalendarStatus);
  const fnScheduleCal = useServerFn(scheduleUserCalendarEvent);
  const fnEmailStatus = useServerFn(getUserEmailStatus);
  const fnSendEmail = useServerFn(sendUserEmail);
  const [calendarStatus, setCalendarStatus] = useState<{
    google: { email: string } | null;
    outlook: { email: string } | null;
  } | null>(null);
  const [emailStatus, setEmailStatus] = useState<{
    gmail: { email: string } | null;
    outlook: { email: string } | null;
    smtp: { provider: string; from_email: string } | null;
  } | null>(null);
  const emailProviderLabel = emailStatus?.gmail
    ? `Gmail (${emailStatus.gmail.email})`
    : emailStatus?.outlook
      ? `Outlook (${emailStatus.outlook.email})`
      : emailStatus?.smtp
        ? `${emailStatus.smtp.provider} (${emailStatus.smtp.from_email})`
        : null;

  const loadCalendarStatus = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setCalendarStatus(null);
        setEmailStatus(null);
        return;
      }
      const [c, e] = await Promise.all([fnCalStatus(), fnEmailStatus()]);
      setCalendarStatus(c);
      setEmailStatus(e);
    } catch {
      setCalendarStatus(null);
      setEmailStatus(null);
    }
  }, [fnCalStatus, fnEmailStatus]);

  useEffect(() => {
    void loadCalendarStatus();
  }, [loadCalendarStatus]);

  /** Wiadomość z Zasobów (obraz / wideo) — jednorazowo po wejściu na czat. */
  useEffect(() => {
    if (!active) return;
    const onMainChat = pathname === "/agent" || pathname === "/agent/";
    if (!onMainChat) return;
    try {
      const raw = sessionStorage.getItem(ASSET_AGENT_SEED_KEY);
      if (!raw?.trim()) return;
      sessionStorage.removeItem(ASSET_AGENT_SEED_KEY);
      const payload = JSON.parse(raw) as AssetAgentSeedPayload;
      const text = (payload.text ?? "").trim();
      if (!text) return;
      const userMsg: Msg = {
        role: "user",
        content: text,
        ...(payload.kind === "image" && payload.mediaUrl ? { images: [payload.mediaUrl] } : {}),
      };
      update(active.id, { messages: [...(active.messages ?? []), userMsg] });
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed przy nawigacji; update z useChats
  }, [active?.id, pathname]);

  useEffect(() => {
    if (loading || !messages.length) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    const qa = extractQA(last.content);
    if (!qa) return;
    const t = window.setTimeout(() => qaInputRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, [messages, loading]);

  function buildScenarioRunPrompt(s: { title: string; goal: string; requiredInputs: string[]; starterPrompt: string }) {
    const req = (s.requiredInputs ?? []).slice(0, 8).join(", ");
    return [
      `Uruchom scenariusz: ${s.title}.`,
      `Cel: ${s.goal}`,
      req ? `Jeśli brakuje danych, zapytaj maks. o 3 rzeczy z tej listy: ${req}.` : "Jeśli brakuje danych, zadaj maks. 3 krótkie pytania.",
      "",
      // W środku zostawiamy oryginalne instrukcje dla jakości (ale bez placeholderów w UI).
      "KONTEKST / INSTRUKCJE:",
      s.starterPrompt,
    ].join("\n");
  }

  const activeProductName = brandProduct?.name ?? legacyName ?? null;

  async function uploadToGallery(
    dataUrl: string,
    prompt: string,
    size: string,
  ): Promise<{ url: string; id: string | null }> {
    const r = await saveImageToProjectAssets({
      imageUrl: dataUrl,
      prompt,
      size,
      productName: activeProductName,
    });
    if (!r.id) {
      if (r.error) {
        console.error("[uploadToGallery] przesłanie grafiki nie powiodło się", r.error);
        toast.error(r.error);
      } else {
        toast.error("Grafika wygenerowana, ale nie trafiła do galerii. Sprawdź połączenie i migracje Supabase (generated_images, bucket generations).");
      }
    }
    return { url: r.url, id: r.id };
  }

  function runScenario(s: Scenario) {
    setScenariosOpen(false);
    setInput("");
    setSuggestions([]);
    setQuickLabel(null);

    if (s.runKind === "image") {
      toast.message("Generuję grafikę…");
      void generateImage(s.imagePromptSeed?.trim() || s.title);
      return;
    }
    if (s.runKind === "video-page") {
      try {
        sessionStorage.setItem(
          VIDEO_PROMPT_SEED_KEY,
          "Krótki film reklamowy UGC: produkt w centrum, haczyk w pierwszych 2 sekundach, napisy po polsku, naturalne światło",
        );
      } catch {
        /* ignore */
      }
      toast.message("Otwieram generator wideo…");
      void navigate({ to: "/assets/video" });
      return;
    }
    if (s.runKind === "assets-page") {
      toast.message("Biblioteka zasobów projektu");
      void navigate({ to: "/assets/gallery" });
      return;
    }
    void send(buildScenarioRunPrompt(s));
  }

  async function generateImage(prompt: string) {
    if (!prompt.trim() || imgLoading || !active) return;

    const affordability = checkImageGenerationAffordability(
      {
        balance: credits.balance ?? 0,
        current_plan: credits.current_plan ?? "free",
        free_ai_usage_usd_cents: credits.free_ai_usage_usd_cents ?? 0,
      },
      imgDefaultN,
    );
    if (!affordability.allowed) {
      if (affordability.maxAffordable <= 0) {
        openCreditsUpgrade(affordability.reason);
        toast.error(affordability.reason ?? "Brak kredytów.");
        return;
      }
      toast.message(`Masz limit na ${affordability.maxAffordable} grafik — generuję tyle.`, {
        description: affordability.reason,
      });
    }
    const nToGen = Math.max(1, Math.min(imgDefaultN, affordability.maxAffordable || imgDefaultN));

    const userMsg: Msg = { role: "user", content: `🎨 Wygeneruj kreację: ${prompt}` };
    update(active.id, {
      messages: [...messages, userMsg],
      title: active.messages.length === 0 ? prompt.slice(0, 60) : active.title,
    });
    setInput("");
    setImgLoading(true);
    // placeholder assistant
    const placeholder: Msg = { role: "assistant", content: `Generuję ${nToGen} warianty (wysoka jakość)…` };
    update(active.id, { messages: [...messagesRef.current, placeholder] });
    try {
      const brandRules = brandVisualRules;
      const api = await callGenerateImageApi({
        prompt,
        brandVisualRules: brandRules,
        singleVariant: true,
        n: nToGen,
      });
      if (!api.ok) {
        if (api.isCredits) {
          openCreditsUpgrade(api.error);
        }
        const prev = messagesRef.current;
        const content = api.isCredits
          ? `💳 ${api.error}`
          : api.status === 401
            ? "❌ Zaloguj się, aby generować obrazy."
            : api.status === 429
              ? "⏳ Limit — spróbuj za chwilę."
              : `❌ Błąd generowania obrazu: ${api.error}`;
        update(active.id, {
          messages: prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m)),
        });
        if (!api.isCredits) toast.error(api.error);
        return;
      }
      const size = api.size;
      const rawImages: string[] = api.images;
      const uploaded = await Promise.all(rawImages.map((src) => uploadToGallery(src, prompt, size)));
      const savedCount = uploaded.filter((u) => u.id).length;
      if (rawImages.length > 0 && savedCount < rawImages.length) {
        toast.message(`Zapisano ${savedCount}/${rawImages.length} grafik w galerii Zasoby.`, {
          description: savedCount === 0 ? "Sprawdź migracje Supabase (generated_images, bucket generations)." : undefined,
        });
      }
      const imageSet: ImageEntry[] = uploaded.map((r) => ({ url: r.url, dbId: r.id, prompt }));
      const prev = messagesRef.current;
      const updated: Msg = {
        role: "assistant",
        content: imageSet.length ? "Gotowe ✓" : "Brak obrazu w odpowiedzi.",
        imageSet,
        images: imageSet.map((x) => x.url),
      };
      update(active.id, { messages: prev.map((m, i) => i === prev.length - 1 ? updated : m) });
      if (imageSet.length) {
        void supabase.functions.invoke("dispatch-notification", {
          body: {
            event: "generation_ready",
            payload: {
              kind: "creative_images",
              chatId: active.id,
              prompt: prompt.slice(0, 800),
              imageCount: imageSet.length,
              imageUrls: imageSet.map((x) => x.url).slice(0, 8),
            },
          },
        });
      }
    } catch (e) {
      console.error(e);
      const prev = messagesRef.current;
      update(active.id, { messages: prev.map((m, i) => i === prev.length - 1 ? { ...m, content: "❌ Błąd połączenia." } : m) });
    } finally {
      setImgLoading(false);
      scheduleCreditsRefresh();
    }
  }

  const [greetingIdx, setGreetingIdx] = useState(0);
  useEffect(() => {
    setGreetingIdx(Math.floor(Math.random() * GREETINGS.length));
    const id = setInterval(() => {
      setGreetingIdx((i) => (i + 1 + Math.floor(Math.random() * (GREETINGS.length - 1))) % GREETINGS.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function readUserSkills(): { name?: string; description?: string; whenToUse?: string; content?: string }[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(USER_SKILLS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function buildSkillsContext(): string | null {
    const userBlock = (() => {
      const skills = readUserSkills();
      if (!skills.length) return "";
      const top = skills.slice(0, 8).map((s) => {
      const name = s?.name ? String(s.name) : "Skill";
      const desc = s?.description ? String(s.description) : "";
      const when = s?.whenToUse ? String(s.whenToUse) : "";
      const content = s?.content ? String(s.content) : "";
      const body = [desc, when, content].filter(Boolean).join("\n\n").slice(0, 2500);
      return `### ${name}\n${body}`.trim();
      });
      return (
        "## Moje umiejętności użytkownika (PRIORYTET — stosuj jako pierwsze, jeśli pasują do intencji)\n\n" +
        top.join("\n\n")
      );
    })();

    const builtinBlock =
      "## Wbudowane skille MarketingNow (OBOWIĄZKOWE — NIE ODBIEGAJ)\n\n" +
      "To jedyne dozwolone metodyki. ZAWSZE:\n" +
      "1. Wybierz 1 skill (max 2) pasujący do intencji użytkownika.\n" +
      "2. Otwórz odpowiedź linią `🧠 Skill: <id>` (np. `🧠 Skill: marketing/copywriting`).\n" +
      "3. Trzymaj się checklisty, kroków i zasad z treści skillu poniżej — nie improwizuj własnych metod.\n" +
      "4. Gdy brakuje danych — zadaj pytanie Q&A zamiast zgadywać poza ramą skillu.\n" +
      "5. Nie udzielaj porad spoza skilli marketingowych (prawo, medycyna itd.).\n\n" +
      BUILTIN_SKILLS_DIGEST;

    const brandVisualBlock = (() => {
      const rules = brandVisualRules?.trim();
      if (!rules) return "";
      let block =
        "## Tożsamość wizualna marki (obowiązuje przy kreacjach i propozycjach grafiki)\n\n" + rules;
      const n = brandVisualImages.length;
      if (n > 0) {
        block += `\n\n(Użytkownik dodał ${n} obraz(ów) referencyjnych w panelu „Tożsamość wizualna” — odwzoruj styl, światło i kompozycję; nie kopiuj 1:1 cudzych znaków towarowych.)`;
      }
      return block;
    })();

    const brandWebBlock = (() => {
      if (!linkedBrand?.aiContext?.summary?.trim()) return "";
      const offerLabel =
        brandProduct?.kind === "service"
          ? `Aktywna usługa: ${brandProduct.name}`
          : brandProduct?.name
            ? `Aktywny produkt: ${brandProduct.name}`
            : null;
      let block =
        "## Kontekst marki (pobrany ze strony WWW — stosuj przy copy, strategii i kampaniach)\n\n" +
        formatBrandContextForAgent(linkedBrand);
      if (offerLabel) block += `\n\n${offerLabel}`;
      return block;
    })();

    const parts = [builtinBlock, userBlock, brandWebBlock, brandVisualBlock].filter(Boolean);
    if (calendarStatus?.google || calendarStatus?.outlook) {
      const providers = [
        calendarStatus.google ? "Google Calendar" : null,
        calendarStatus.outlook ? "Outlook Calendar" : null,
      ]
        .filter(Boolean)
        .join(" / ");
      parts.push(
        `## Kalendarz użytkownika (POŁĄCZONY: ${providers})\n\n` +
          "Gdy proponujesz posty lub plan publikacji — automatycznie dodawaj markery `[CAL: data | tytuł | opis]` (szczegóły w instrukcji systemowej).",
      );
    }
    if (!parts.length) return null;
    return "KONTEKST UMIEJĘTNOŚCI NOW:\n\n" + parts.join("\n\n---\n\n");
  }

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  async function handlePickImage(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Wybierz plik graficzny (JPG, PNG, WebP).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Zdjęcie jest za duże (max 5 MB).");
      return;
    }
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setPendingImage({ dataUrl, mediaType: file.type || "image/jpeg" });
      document.getElementById("agent-input")?.focus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wczytać zdjęcia.");
    }
  }

  // Wyślij prompt lub — gdy trwa generowanie — dodaj go do kolejki.
  function submitPrompt(text: string) {
    const t = text.trim();
    if (!t && !pendingImage) return;
    if (loading || sendingRef.current) {
      if (!t) return; // samego zdjęcia nie kolejkujemy
      setQueue((q) => [...q, t]);
      setInput("");
      return;
    }
    setPaused(false);
    void send(t);
  }

  // Zatrzymaj (zawieś) bieżące generowanie, grafiki i kolejkę.
  function stopGeneration() {
    setPaused(true);
    abortRef.current?.abort();
    imgAbortRef.current?.abort();
    setImgLoading(false);
    setImgConfirmPrompts(null);
    setImgConfirmMessageIdx(null);
    setQueue([]);
  }

  function answerQaOption(opt: string) {
    setQaCustom("");
    if (shouldOpenVideoGenerator(opt)) {
      const lastUser = [...messagesRef.current].reverse().find((m) => m.role === "user");
      try {
        sessionStorage.setItem(VIDEO_PROMPT_SEED_KEY, lastUser?.content?.trim() || opt);
      } catch {
        /* ignore */
      }
      toast.message("Otwieram generator wideo…");
      void navigate({ to: "/assets/video" });
      return;
    }
    void send(opt);
  }

  function removeFromQueue(idx: number) {
    setQueue((q) => q.filter((_, i) => i !== idx));
  }

  function clearQueue() {
    setQueue([]);
  }

  function resumeQueue() {
    setPaused(false);
  }

  // Przetwarzaj kolejkę gdy nie trwa generowanie i nie jest wstrzymana.
  useEffect(() => {
    if (loading || imgLoading || sendingRef.current || paused) return;
    if (queue.length === 0) return;
    const nextPrompt = queue[0];
    setQueue((q) => q.slice(1));
    void send(nextPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, imgLoading, queue, paused]);

  async function send(text: string) {
    const trimmed = text.trim();
    const effective = trimmed;
    const attachment = pendingImage;
    // Pozwól wysłać samo zdjęcie (bez tekstu), jeśli jest załączone.
    if ((!effective && !attachment) || loading) return;
    if (!active) return;

    // Prośba o wideo → generator w Zasobach (czat nie generuje filmów).
    if (effective && shouldOpenVideoGenerator(effective)) {
      try {
        sessionStorage.setItem(VIDEO_PROMPT_SEED_KEY, effective);
      } catch {
        /* ignore */
      }
      toast.message("Otwieram generator wideo…");
      void navigate({ to: "/assets/video" });
      setInput("");
      return;
    }

    sendingRef.current = true;
    const ac = new AbortController();
    abortRef.current = ac;
    const headers = await supabaseFnHeaders();
    if (!headers) {
      sendingRef.current = false;
      toast.error("Zaloguj się, żeby korzystać z agenta AI.");
      return;
    }
    setSuggestions([]);
    const userMsg: Msg = {
      role: "user",
      content: effective,
      ...(attachment ? { images: [attachment.dataUrl] } : {}),
    };
    const skillCtx = buildSkillsContext();
    const next = [...messages, userMsg];
    update(active.id, {
      messages: next,
      title: active.messages.length === 0 ? (effective || "Analiza zdjęcia").slice(0, 60) : active.title,
    });
    setInput("");
    setPendingImage(null);
    setLoading(true);

    let acc = "";
    const upsert = (chunk: string) => {
      acc += chunk;
      const prev = messagesRef.current;
      const last = prev[prev.length - 1];
      const updated: Msg[] = last?.role === "assistant"
        ? prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m))
        : [...prev, { role: "assistant" as const, content: acc }];
      update(active.id, { messages: updated });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: chatMessagesPayload(next),
          skillsContext: skillCtx ?? undefined,
          calendarConnected: calendarStatus
            ? { google: !!calendarStatus.google, outlook: !!calendarStatus.outlook }
            : undefined,
          emailConnected: emailStatus
            ? {
                gmail: !!emailStatus.gmail,
                outlook: !!emailStatus.outlook,
                smtp: !!emailStatus.smtp,
                provider: emailProviderLabel ?? undefined,
              }
            : undefined,
          imageAttachment: attachment
            ? { media_type: attachment.mediaType, data: attachment.dataUrl }
            : undefined,
        }),
        signal: ac.signal,
      });
      if (resp.status === 429) {
        upsert("⏳ Za dużo zapytań. Spróbuj ponownie za chwilę.");
        return;
      }
      if (resp.status === 401) {
        upsert("🔐 Sesja wygasła. Zaloguj się ponownie.");
        return;
      }
      if (resp.status === 402) {
        let msg =
          "Brak kredytów albo limit planu Free. Otwórz „Plan i kredyty”, żeby dokupić lub zmienić plan.";
        try {
          const j = (await resp.json()) as { message?: string };
          if (j?.message) msg = j.message;
        } catch { /* ignore */ }
        openCreditsUpgrade(msg);
        upsert(`💳 ${msg}`);
        return;
      }
      if (!resp.ok || !resp.body) {
        upsert("❌ Coś poszło nie tak. Spróbuj jeszcze raz.");
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { done = true; break; }
          try {
            const p = JSON.parse(j);
            const c = p.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        upsert("\n\n⏹ Zatrzymano generowanie.");
      } else {
        console.error(e);
        upsert("❌ Błąd połączenia.");
      }
    } finally {
      sendingRef.current = false;
      abortRef.current = null;
      setLoading(false);
      if (!paused) void detectAndScheduleCalendarEvents();
      if (!paused) void detectAndPrepareEmail();
      if (!paused) void detectAndGenerateImages();
      // Nie pokazuj "Sugerowanych kroków" jeśli asystent sam zadał pytanie (Q&A) —
      // inaczej ekran dubluje opcje wyboru.
      const lastAssist = messagesRef.current[messagesRef.current.length - 1];
      const hasQA = !!lastAssist && lastAssist.role === "assistant" && /(^|\n)Q:\s/.test(lastAssist.content || "");
      if (!paused && !hasQA) void fetchSuggestions();
      else setSuggestions([]);
      scheduleCreditsRefresh();
    }
  }

  /** Po odpowiedzi agenta: prosi o akceptację przed zapisem markerów [CAL:] do kalendarza. */
  async function detectAndScheduleCalendarEvents() {
    if (!active) return;
    const prev = messagesRef.current;
    const lastIdx = prev.length - 1;
    const last = prev[lastIdx];
    if (!last || last.role !== "assistant") return;
    if (calScheduledRef.current.has(lastIdx)) return;

    const markers = extractCalMarkers(last.content);
    if (!markers.length) return;

    const providers: Array<"google" | "outlook"> = [];
    if (calendarStatus?.google) providers.push("google");
    if (calendarStatus?.outlook) providers.push("outlook");
    if (!providers.length) return;

    calScheduledRef.current.add(lastIdx);
    setCalConfirmMarkers(markers);
    setCalConfirmMessageIdx(lastIdx);
    setCalConfirmAccepted(false);
  }

  function cancelPendingCalendar() {
    if (calConfirmMessageIdx != null) {
      const prev = messagesRef.current;
      const cleaned = stripCalMarkers(prev[calConfirmMessageIdx]?.content ?? "");
      update(active!.id, {
        messages: prev.map((m, i) =>
          i === calConfirmMessageIdx
            ? { ...m, content: cleaned + "\n\n_📅 Pominięto zapis do kalendarza (brak akceptacji)._"}
            : m,
        ),
      });
    }
    setCalConfirmMarkers(null);
    setCalConfirmMessageIdx(null);
    setCalConfirmAccepted(false);
  }

  async function confirmPendingCalendar() {
    if (!active || !calConfirmMarkers?.length || calConfirmMessageIdx == null) return;
    if (!calConfirmAccepted) {
      toast.error("Zaakceptuj zapis na własne ryzyko.");
      return;
    }
    const markers = calConfirmMarkers;
    const lastIdx = calConfirmMessageIdx;
    const providers: Array<"google" | "outlook"> = [];
    if (calendarStatus?.google) providers.push("google");
    if (calendarStatus?.outlook) providers.push("outlook");
    if (!providers.length) {
      toast.error("Brak połączonego kalendarza.");
      return;
    }

    setCalScheduling(true);
    const prev = messagesRef.current;
    const cleaned = stripCalMarkers(prev[lastIdx]?.content ?? "");
    let scheduled = 0;
    let lastError = "";

    for (const m of markers) {
      try {
        const start = normalizeCalDateTime(m.start);
        const end = addMinutesIso(start, 30);
        const r = await fnScheduleCal({
          data: {
            title: m.title.slice(0, 255),
            description: m.description,
            start,
            end,
            providers,
          },
        });
        if (r.results.some((x) => x.ok)) scheduled++;
        else {
          const err = r.results.find((x) => !x.ok && x.error)?.error;
          if (err) lastError = err;
        }
      } catch (e) {
        console.error("calendar schedule", e);
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    const statusLine =
      scheduled > 0
        ? `\n\n_📅 Dodano ${scheduled} ${scheduled === 1 ? "wpis" : scheduled < 5 ? "wpisy" : "wpisów"} do kalendarza (po Twojej akceptacji)._`
        : `\n\n_⚠️ Nie udało się zapisać w kalendarzu${lastError ? ` — ${lastError}` : " — sprawdź połączenie w Integracjach."}_`;

    if (scheduled === 0 && lastError) toast.error(lastError);

    update(active.id, {
      messages: prev.map((m, i) => (i === lastIdx ? { ...m, content: cleaned + statusLine } : m)),
    });
    setCalConfirmMarkers(null);
    setCalConfirmMessageIdx(null);
    setCalConfirmAccepted(false);
    setCalScheduling(false);
    if (scheduled > 0) {
      toast.success(
        scheduled === 1
          ? "Dodano wpis do kalendarza"
          : `Dodano ${scheduled} wpisów do kalendarza`,
      );
    }
  }

  /** Po odpowiedzi agenta: wykrywa marker [MAIL:] i pokazuje edytowalny kreator maila. */
  async function detectAndPrepareEmail() {
    if (!active) return;
    const prev = messagesRef.current;
    const lastIdx = prev.length - 1;
    const last = prev[lastIdx];
    if (!last || last.role !== "assistant") return;
    if (mailHandledRef.current.has(lastIdx)) return;

    const draft = extractMailMarker(last.content);
    if (!draft) return;

    mailHandledRef.current.add(lastIdx);
    // Usuń surowy marker + ewentualne fałszywe „wysłałem maila” (mail wysyła dopiero użytkownik).
    const cleaned = stripFalseSentClaims(stripMailMarkers(last.content));
    update(active.id, {
      messages: prev.map((m, i) => (i === lastIdx ? { ...m, content: cleaned } : m)),
    });
    setMailDraft({ ...draft, messageIdx: lastIdx });
    setMailAccepted(false);
  }

  function discardMailDraft() {
    setMailDraft(null);
    setMailAccepted(false);
  }

  async function copyMailDraft() {
    if (!mailDraft) return;
    const text = `${mailDraft.subject ? `Temat: ${mailDraft.subject}\n\n` : ""}${mailDraft.body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Skopiowano treść maila");
    } catch {
      toast.error("Nie udało się skopiować — zaznacz i skopiuj ręcznie.");
    }
  }

  async function sendMailDraft() {
    if (!mailDraft || !active) return;
    const to = mailDraft.to.trim();
    const subject = mailDraft.subject.trim();
    const bodyText = mailDraft.body.trim();
    if (!isValidEmail(to)) {
      toast.error("Podaj poprawny adres odbiorcy.");
      return;
    }
    if (!subject) {
      toast.error("Uzupełnij temat wiadomości.");
      return;
    }
    if (!bodyText) {
      toast.error("Treść wiadomości jest pusta.");
      return;
    }
    if (!emailProviderLabel) {
      toast.error("Połącz skrzynkę (Gmail / Outlook / Resend) w Integracjach, aby wysyłać maile.");
      return;
    }
    if (!mailAccepted) {
      toast.error("Zaakceptuj wysyłkę na własne ryzyko.");
      return;
    }

    setMailSending(true);
    try {
      const r = await fnSendEmail({
        data: {
          to,
          subject: subject.slice(0, 998),
          html: mailBodyToHtml(bodyText),
          text: bodyText,
          acceptedAtOwnRisk: true,
        },
      });
      const idx = mailDraft.messageIdx;
      const cur = messagesRef.current;
      const note = `\n\n_✉️ Wysłano e-mail do ${to} przez ${r.provider}._`;
      update(active.id, {
        messages: cur.map((m, i) => (i === idx ? { ...m, content: (m.content + note).trim() } : m)),
      });
      toast.success(`Wysłano e-mail przez ${r.provider}`);
      setMailDraft(null);
      setMailAccepted(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nie udało się wysłać maila.");
    } finally {
      setMailSending(false);
    }
  }

  // Wykrywa markery [IMG: prompt] w ostatniej wiadomości asystenta.
  // Generacja wymaga potwierdzenia (chyba że 1 marker + wyraźna prośba o grafikę).
  async function detectAndGenerateImages() {
    if (!active || paused || imgLoading) return;
    const prev = messagesRef.current;
    const lastIdx = prev.length - 1;
    const last = prev[lastIdx];
    if (!last || last.role !== "assistant") return;
    const matches = [...last.content.matchAll(/\[IMG:\s*([^\]]+?)\s*\]/gi)];
    if (!matches.length) return;

    const prompts = matches.map((m) => m[1].trim()).slice(0, 4);
    const cleaned = last.content.replace(/\[IMG:\s*[^\]]+?\s*\]\s*/gi, "").trim();
    const lastUser = [...prev].reverse().find((m) => m.role === "user");
    const lastUserText = lastUser?.content ?? "";
    const autoOk = prompts.length === 1 && userExplicitlyWantsImages(lastUserText);

    if (!autoOk) {
      setImgConfirmPrompts(prompts);
      setImgConfirmMessageIdx(lastIdx);
      const n = prompts.length;
      const statusLine = `\n\n_🎨 Przygotowano opis ${n} ${n === 1 ? "grafiki" : "grafik"}. Potwierdź generację przyciskiem poniżej — bez zgody nie zużyjemy kredytów._`;
      update(active.id, {
        messages: prev.map((m, i) => (i === lastIdx ? { ...m, content: cleaned + statusLine } : m)),
      });
      return;
    }

    await runImageGeneration(prompts, lastIdx, cleaned);
  }

  function cancelPendingImages() {
    setImgConfirmPrompts(null);
    setImgConfirmMessageIdx(null);
  }

  async function confirmPendingImages() {
    if (!active || !imgConfirmPrompts?.length || imgConfirmMessageIdx == null) return;
    const prompts = imgConfirmPrompts;
    const lastIdx = imgConfirmMessageIdx;
    const cleaned = (messagesRef.current[lastIdx]?.content ?? "")
      .replace(/\[IMG:\s*[^\]]+?\s*\]\s*/gi, "")
      .replace(/\n\n_🎨 Przygotowano opis[^_]*_\s*$/i, "")
      .trim();
    setImgConfirmPrompts(null);
    setImgConfirmMessageIdx(null);
    setPaused(false);
    await runImageGeneration(prompts, lastIdx, cleaned);
  }

  async function runImageGeneration(prompts: string[], lastIdx: number, cleaned: string) {
    if (!active || paused) return;
    const affordability = checkImageGenerationAffordability(
      {
        balance: credits.balance ?? 0,
        current_plan: credits.current_plan ?? "free",
        free_ai_usage_usd_cents: credits.free_ai_usage_usd_cents ?? 0,
      },
      prompts.length,
    );
    if (!affordability.allowed) {
      if (affordability.maxAffordable <= 0) {
        openCreditsUpgrade(affordability.reason);
        toast.error(affordability.reason ?? "Brak kredytów.");
        return;
      }
      toast.message(`Masz limit na ${affordability.maxAffordable} grafik — generuję tyle.`, {
        description: affordability.reason,
      });
      prompts = prompts.slice(0, affordability.maxAffordable);
    }

    const statusLine = `\n\n_🎨 Generuję ${prompts.length} ${prompts.length === 1 ? "kreację" : "kreacji"}…_`;
    update(active.id, {
      messages: messagesRef.current.map((m, i) => (i === lastIdx ? { ...m, content: cleaned + statusLine } : m)),
    });
    setImgLoading(true);
    const ac = new AbortController();
    imgAbortRef.current = ac;
    try {
      const brandRules = brandVisualRules;
      const headers = await supabaseFnHeaders();
      if (!headers) {
        toast.error("Zaloguj się, aby generować grafiki.");
        update(active.id, {
          messages: messagesRef.current.map((m, i) =>
            i === lastIdx ? { ...m, content: `${cleaned}\n\n_⚠️ Zaloguj się, aby generować obrazy._` } : m,
          ),
        });
        return;
      }

      const results = await Promise.all(
        prompts.map(async (p): Promise<{ src: string } | { error: string } | null> => {
          if (ac.signal.aborted) return null;
          try {
            const api = await callGenerateImageApi({
              prompt: p,
              brandVisualRules: brandRules,
              singleVariant: true,
              n: 1,
              signal: ac.signal,
            });
            if (!api.ok) {
              if (api.isCredits) openCreditsUpgrade(api.error);
              return { error: api.error };
            }
            return api.images[0] ? { src: api.images[0] } : { error: "Brak obrazu w odpowiedzi API" };
          } catch (e) {
            return { error: e instanceof Error ? e.message : "Błąd sieci" };
          }
        }),
      );
      if (ac.signal.aborted) return;
      const errors = results
        .map((r, i) => (r && "error" in r ? `${prompts[i]?.slice(0, 40) ?? "grafika"}: ${r.error}` : null))
        .filter((x): x is string => Boolean(x));
      if (errors.length) {
        toast.error(errors[0] ?? "Nie udało się wygenerować obrazów");
      }
      const pairs = results
        .map((r, i) => (r && "src" in r ? { src: r.src, prompt: prompts[i] ?? "kreacja" } : null))
        .filter((x): x is { src: string; prompt: string } => Boolean(x));
      const uploaded = await Promise.all(
        pairs.map((p) => uploadToGallery(p.src, p.prompt, chooseImageSizeFromPrompt(p.prompt))),
      );
      if (ac.signal.aborted) return;
      const newEntries: ImageEntry[] = uploaded
        .map((r, idx) => ({
          url: r.url || pairs[idx]?.src || "",
          dbId: r.id,
          prompt: pairs[idx]?.prompt ?? "",
        }))
        .filter((e) => Boolean(e.url));
      const cur = messagesRef.current;
      const prevSet = cur[lastIdx].imageSet ?? (cur[lastIdx].images ?? []).map((url) => ({ url, dbId: null, prompt: "" }));
      const merged = [...prevSet, ...newEntries];
      const updated: Msg = {
        ...cur[lastIdx],
        content:
          cleaned +
          (newEntries.length
            ? `\n\n_✓ Wygenerowano ${newEntries.length}/${prompts.length}_`
            : `\n\n_⚠️ Nie udało się wygenerować obrazów${errors[0] ? ` — ${errors[0]}` : ""}_`),
        imageSet: merged,
        images: merged.map((x) => x.url),
      };
      update(active.id, { messages: cur.map((m, i) => (i === lastIdx ? updated : m)) });
    } finally {
      imgAbortRef.current = null;
      setImgLoading(false);
      scheduleCreditsRefresh();
    }
  }

  async function fetchSuggestions() {
    setSuggestLoading(true);
    try {
      const h = await supabaseFnHeaders();
      if (!h) return;
      const current = (s => s)(messagesRef.current);
      const skillCtx = buildSkillsContext();
      const suggestMessages = chatMessagesPayload(skillCtx ? [{ role: "user", content: skillCtx }, ...current] : current);
      const resp = await fetch(SUGGEST_URL, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ count: 5, messages: suggestMessages }),
      });
      if (resp.status === 402) {
        let msg =
          "Nie masz kredytów albo wykorzystałeś limit planu Free. Otwórz „Plan i kredyty”.";
        try {
          const j = (await resp.json()) as { message?: string };
          if (j?.message) msg = j.message;
        } catch {
          /* ignore */
        }
        openCreditsUpgrade(msg);
        setSuggestions([]);
        return;
      }
      const data = await resp.json();
      setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions.slice(0, 5) : []);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestLoading(false);
      scheduleCreditsRefresh();
    }
  }

  function readAgentProfile() {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("mn.agentProfile.v1");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function generateQuickSuggestions(label: (typeof QUICK)[number]["label"], fallbackPrompt: string) {
    setQuickLabel(label);
    setSuggestLoading(true);
    try {
      const profile = readAgentProfile();
      const skillCtx = buildSkillsContext();
      const context = [
        `Produkt: ${activeProduct}`,
        profile?.tone ? `Ton: ${profile.tone}` : null,
        profile?.industry ? `Branża: ${profile.industry}` : null,
        profile?.audience ? `Grupa docelowa: ${profile.audience}` : null,
        profile?.uvp ? `USP: ${profile.uvp}` : null,
        Array.isArray(profile?.selectedGoals) && profile.selectedGoals.length
          ? `Cele (checkboxy): ${profile.selectedGoals.join(", ")}`
          : null,
        profile?.goalsText ? `Cele (opis): ${profile.goalsText}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const seed = [
        ...(skillCtx ? [{ role: "user" as const, content: skillCtx }] : []),
        {
          role: "user" as const,
          content:
            `Wygeneruj 5 bardzo skutecznych propozycji promptów dla kategorii: "${label}".\n` +
            `Każda propozycja ma być gotowa do kliknięcia w aplikacji (jednozdaniowa lub max 2 zdania), konkretna, bez ogólników.\n` +
            `Zastosuj się do profilu marki poniżej i pisz po polsku.\n\n` +
            `PROFIL / KONTEKST:\n${context || "(brak profilu — zaproponuj uniwersalne, ale konkretne prompt-y)"}\n\n` +
            `Wynik zwróć jako tablicę 5 stringów (bez numerowania w treści).`,
        },
      ];

      const h = await supabaseFnHeaders();
      if (!h) {
        setSuggestions(QUICK_SUGGESTIONS_FALLBACK[label] ?? [fallbackPrompt]);
        return;
      }
      const resp = await fetch(SUGGEST_URL, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ count: 5, messages: seed }),
      });
      if (resp.status === 402) {
        let msg =
          "Nie masz kredytów albo wykorzystałeś limit planu Free. Otwórz „Plan i kredyty”.";
        try {
          const j = (await resp.json()) as { message?: string };
          if (j?.message) msg = j.message;
        } catch {
          /* ignore */
        }
        openCreditsUpgrade(msg);
        setSuggestions(QUICK_SUGGESTIONS_FALLBACK[label] ?? [fallbackPrompt]);
        return;
      }
      const data = await resp.json().catch(() => ({}));
      const list = Array.isArray(data?.suggestions) ? data.suggestions.filter((s: unknown) => typeof s === "string") : [];
      const top5 = list.slice(0, 5);
      if (top5.length >= 3) {
        setSuggestions(top5);
        return;
      }
      setSuggestions(QUICK_SUGGESTIONS_FALLBACK[label] ?? [fallbackPrompt]);
    } catch {
      setSuggestions(QUICK_SUGGESTIONS_FALLBACK[label] ?? [fallbackPrompt]);
    } finally {
      setSuggestLoading(false);
      scheduleCreditsRefresh();
    }
  }

  const messagesRef = useRef<Msg[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto mn-scrollbar">
        {empty ? (
          <div className="h-full flex flex-col items-center justify-center px-6">
            <h1 className="serif text-[clamp(1.75rem,4vw,2.25rem)] leading-[1.08] tracking-[-0.03em] text-foreground text-center animate-in fade-in duration-500">
              <span className="mn-shake">{GREETINGS[greetingIdx]}</span>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground text-center max-w-md">
              Wybierz gotowe działanie poniżej lub opisz, co chcesz osiągnąć.
            </p>
            <div className="mt-6 w-full max-w-md">
              <Link
                to="/llm-visibility"
                className="group w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 transition-all text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-md bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-neutral-600" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-neutral-900 leading-tight">
                      Panel widoczności w AI
                    </p>
                    <p className="text-[12px] text-neutral-500 truncate">
                      Analiza widoczności marki w odpowiedziach asystentów AI
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-700 transition-colors shrink-0" strokeWidth={1.75} />
              </Link>
            </div>

            <div className="mt-6 w-full max-w-3xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400 mb-2.5">
                Propozycje
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {QUICK.map((q) => {
                  const active = quickLabel === q.label;
                  return (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => {
                        void generateQuickSuggestions(q.label, q.prompt);
                        document.getElementById("agent-input")?.focus();
                      }}
                      className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                        active
                          ? "border-neutral-300 bg-neutral-50"
                          : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60"
                      }`}
                    >
                      <q.icon className="h-4 w-4 text-neutral-500 shrink-0" strokeWidth={1.5} />
                      <span className="text-[13px] font-medium text-neutral-800 truncate">
                        {q.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(suggestLoading || suggestions.length > 0) && (
                <div className="mt-3">
                  <SuggestionsPanel
                    title={quickLabel ? `Propozycje: ${quickLabel}` : "Propozycje"}
                    suggestions={suggestions}
                    loading={suggestLoading}
                    onPick={(s) => {
                      setInput(s);
                      document.getElementById("agent-input")?.focus();
                    }}
                    onRun={(s) => {
                      setInput(s);
                      void send(s);
                    }}
                    onCustom={() => {
                      setInput("");
                      document.getElementById("agent-input")?.focus();
                    }}
                  />
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4 md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                      Jak działa aplikacja
                    </p>
                    <p className="mt-1.5 text-[13px] text-neutral-600 leading-relaxed">
                      Krótki przewodnik po MarketingNow — od czatu AI po kampanie, integracje i raporty.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHowItWorksOpen((v) => !v)}
                    className="shrink-0 text-[12px] px-4 py-2 rounded-full border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 transition font-semibold text-neutral-800"
                  >
                    {howItWorksOpen ? "Zwiń" : "Pokaż jak działa aplikacja"}
                  </button>
                </div>

                {howItWorksOpen && (
                  <ol className="mt-4 space-y-3">
                    {[
                      {
                        t: "1. Opisz zadanie w czacie",
                        d: "Wpisz, co chcesz osiągnąć, albo kliknij propozycję / gotowe działanie — agent AI (Anthropic) prowadzi Cię krok po kroku.",
                      },
                      {
                        t: "2. Wybierz markę i produkt",
                        d: "U góry ustaw kontekst (Osobiste / marka / produkt), żeby treści i kampanie były dopasowane.",
                      },
                      {
                        t: "3. Połącz integracje",
                        d: "W „Integracje” podłącz Gmail, Kalendarz, Meta, Google Ads, TikTok lub LinkedIn — potem publikujesz z panelu kampanii.",
                      },
                      {
                        t: "4. Twórz kampanie z AI",
                        d: "W Panelu kampanii uzupełniaj nagłówki i opisy przyciskiem AI przy polach — ten sam silnik co w czacie.",
                      },
                      {
                        t: "5. Mierz i rozwijaj",
                        d: "SEO, konkurencja, widoczność w AI, virale i kalendarz — wszystko w jednym miejscu z kredytu planu.",
                      },
                    ].map((step) => (
                      <li
                        key={step.t}
                        className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3"
                      >
                        <p className="text-[13px] font-semibold text-neutral-900">{step.t}</p>
                        <p className="mt-1 text-[13px] text-neutral-600 leading-relaxed">{step.d}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "items-start gap-3"}`}>
                {m.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-neutral-900 text-white text-[10px] font-semibold flex items-center justify-center shrink-0 mt-1">
                    N
                  </div>
                )}
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] max-h-[min(42vh,380px)] overflow-y-auto rounded-xl bg-neutral-100 border border-neutral-200/70 px-4 py-2.5 text-sm text-neutral-900 whitespace-pre-wrap break-words text-left"
                      : "flex-1 prose prose-sm max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-strong:text-foreground prose-table:border-collapse prose-table:text-[13px] prose-th:border prose-th:border-neutral-200 prose-td:border prose-td:border-neutral-200 prose-th:bg-neutral-50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2"
                  }
                >
                  {m.role === "assistant" ? (
                    <>
                      {(() => {
                        const isLast = i === messages.length - 1;
                        const qa = isLast && !loading ? extractQA(m.content) : null;
                        const display = qa ? qa.body : m.content;
                        return (
                          <>
                            {display && (
                              <div className="overflow-x-auto max-w-full mn-scrollbar">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{display}</ReactMarkdown>
                              </div>
                            )}
                            {qa && (
                              <div className="mt-4 not-prose">
                                <p className="text-[13px] font-semibold text-neutral-900 mb-2.5">
                                  {qa.question}
                                </p>
                                {qa.options.length > 0 && qa.multi ? (
                                  <div className="mb-3">
                                    <div className="flex flex-wrap gap-2 mb-3">
                                      {qa.options.map((opt, k) => {
                                        const checked = qaSelected.includes(opt);
                                        return (
                                          <button
                                            key={k}
                                            type="button"
                                            aria-pressed={checked}
                                            onClick={() =>
                                              setQaSelected((prev) =>
                                                prev.includes(opt)
                                                  ? prev.filter((o) => o !== opt)
                                                  : [...prev, opt],
                                              )
                                            }
                                            disabled={loading}
                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] transition-colors disabled:opacity-50 ${
                                              checked
                                                ? "border-neutral-900 bg-neutral-900 text-white"
                                                : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-900"
                                            }`}
                                          >
                                            <span
                                              className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border text-[10px] leading-none ${
                                                checked ? "border-white bg-white text-neutral-900" : "border-neutral-300"
                                              }`}
                                            >
                                              {checked ? "✓" : ""}
                                            </span>
                                            {opt}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!qaSelected.length) return;
                                        const text = qaSelected.join(", ");
                                        setQaSelected([]);
                                        setQaCustom("");
                                        void send(text);
                                      }}
                                      disabled={loading || qaSelected.length === 0}
                                      className="inline-flex items-center px-3.5 py-1.5 rounded-lg border border-neutral-900 bg-neutral-900 text-[13px] text-white hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {qaSelected.length > 0
                                        ? `Zatwierdź wybór (${qaSelected.length})`
                                        : "Zaznacz opcje"}
                                    </button>
                                  </div>
                                ) : qa.options.length > 0 ? (
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {qa.options.map((opt, k) => (
                                      <button
                                        key={k}
                                        type="button"
                                        onClick={() => answerQaOption(opt)}
                                        disabled={loading}
                                        className="inline-flex items-center px-3 py-1.5 rounded-lg border border-neutral-200 bg-white text-[13px] text-neutral-800 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors disabled:opacity-50"
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => qaInputRef.current?.focus()}
                                      disabled={loading}
                                      className="inline-flex items-center px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-[13px] text-neutral-800 hover:border-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors disabled:opacity-50"
                                    >
                                      Inna odpowiedź…
                                    </button>
                                  </div>
                                ) : null}
                                <QaReplyField
                                  question={qa.question}
                                  value={qaCustom}
                                  onChange={setQaCustom}
                                  loading={loading}
                                  inputRef={qaInputRef}
                                  onSubmit={(v) => {
                                    setQaCustom("");
                                    void send(v);
                                  }}
                                />
                              </div>
                            )}
                          </>
                        );
                      })()}
                      {(() => {
                        const entries: ImageEntry[] =
                          m.imageSet?.length ? m.imageSet : (m.images ?? []).map((url) => ({ url, dbId: null, prompt: "" }));
                        if (!entries.length) return null;
                        return (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 not-prose">
                            {entries.map((entry, k) => (
                              <div
                                key={`${entry.url}-${k}`}
                                className="rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50"
                              >
                                <div className="relative group">
                                  <img src={entry.url} alt={`Kreacja ${k + 1}`} className="w-full h-auto block" />
                                </div>
                                <div className="p-2.5 bg-white border-t border-neutral-100">
                                  <GeneratedImageToolbar
                                    imageUrl={entry.url}
                                    dbId={entry.dbId}
                                    prompt={entry.prompt}
                                    productName={activeProductName}
                                    brandVisualRules={brandVisualRules}
                                    onPromptUpdated={(next) => {
                                      if (!active) return;
                                      const cur = messagesRef.current;
                                      const nextSet = (cur[i].imageSet ?? []).map((e, j) =>
                                        j === k ? { ...e, prompt: next } : e,
                                      );
                                      if (!nextSet.length) return;
                                      update(active.id, {
                                        messages: cur.map((x, idx) =>
                                          idx === i ? { ...x, imageSet: nextSet } : x,
                                        ),
                                      });
                                    }}
                                    onImageReplaced={({ dbId, url, prompt: nextPrompt }) => {
                                      if (!active) return;
                                      const cur = messagesRef.current;
                                      const nextSet = (cur[i].imageSet ?? []).map((e, j) =>
                                        j === k ? { ...e, dbId, url, prompt: nextPrompt } : e,
                                      );
                                      update(active.id, {
                                        messages: cur.map((x, idx) =>
                                          idx === i
                                            ? { ...x, imageSet: nextSet, images: nextSet.map((e) => e.url) }
                                            : x,
                                        ),
                                      });
                                    }}
                                    onRegenerate={(p) => void generateImage(p)}
                                    onSaved={({ dbId, url }) => {
                                      if (!active) return;
                                      const cur = messagesRef.current;
                                      const nextSet = (cur[i].imageSet ?? []).map((e, j) =>
                                        j === k ? { ...e, dbId, url } : e,
                                      );
                                      update(active.id, {
                                        messages: cur.map((x, idx) =>
                                          idx === i ? { ...x, imageSet: nextSet, images: nextSet.map((e) => e.url) } : x,
                                        ),
                                      });
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      {(m.images?.length ?? 0) > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2 justify-end">
                          {m.images!.map((src, k) => (
                            <img
                              key={`${src}-${k}`}
                              src={src}
                              alt={`Załącznik ${k + 1}`}
                              className="max-h-48 w-auto rounded-lg border border-neutral-200"
                            />
                          ))}
                        </div>
                      )}
                      {m.content}
                    </>
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-neutral-900 shrink-0 mt-1 animate-pulse" />
                <div className="text-sm text-neutral-500">Generowanie odpowiedzi…</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4">
          {mailDraft && (
            <div className="mb-3 rounded-xl border border-neutral-300 bg-white px-4 py-3 space-y-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-neutral-700" strokeWidth={1.75} />
                <p className="text-sm font-semibold text-neutral-900">
                  Wiadomość e-mail — edytuj przed wysłaniem
                </p>
              </div>
              <div className="space-y-2">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Do</span>
                  <input
                    type="email"
                    value={mailDraft.to}
                    onChange={(e) => setMailDraft((d) => (d ? { ...d, to: e.target.value } : d))}
                    placeholder="np. klient@firma.pl"
                    className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-neutral-400 focus:bg-white focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Temat</span>
                  <input
                    type="text"
                    value={mailDraft.subject}
                    onChange={(e) => setMailDraft((d) => (d ? { ...d, subject: e.target.value } : d))}
                    placeholder="Temat wiadomości"
                    className="mt-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:border-neutral-400 focus:bg-white focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Treść</span>
                  <textarea
                    value={mailDraft.body}
                    onChange={(e) => setMailDraft((d) => (d ? { ...d, body: e.target.value } : d))}
                    rows={8}
                    placeholder="Treść wiadomości…"
                    className="mt-1 w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-relaxed focus:border-neutral-400 focus:bg-white focus:outline-none"
                  />
                </label>
              </div>
              {emailProviderLabel ? (
                <p className="text-[12px] text-neutral-500">
                  Wyślemy z: <span className="font-semibold text-neutral-700">{emailProviderLabel}</span>
                </p>
              ) : (
                <p className="text-[12px] text-amber-700">
                  Brak połączonej skrzynki. Możesz edytować i skopiować treść, a wysyłkę włączysz po połączeniu
                  Gmaila / Outlooka / Resend w{" "}
                  <Link to="/integrations" className="font-semibold underline">
                    Integracjach
                  </Link>
                  .
                </p>
              )}
              {emailProviderLabel && (
                <label className="flex items-start gap-2 text-[12px] text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={mailAccepted}
                    onChange={(e) => setMailAccepted(e.target.checked)}
                  />
                  <span>
                    Akceptuję wysyłkę <strong>na własne ryzyko</strong> i potwierdzam treść wiadomości.
                  </span>
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                {emailProviderLabel && (
                  <button
                    type="button"
                    disabled={!mailAccepted || mailSending}
                    onClick={() => void sendMailDraft()}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" strokeWidth={2} />
                    {mailSending ? "Wysyłanie…" : "Wyślij e-mail"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void copyMailDraft()}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-neutral-300 bg-white text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} /> Kopiuj treść
                </button>
                <button
                  type="button"
                  onClick={discardMailDraft}
                  className="inline-flex items-center h-8 px-3 rounded-md border border-neutral-300 bg-white text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition-colors"
                >
                  Odrzuć
                </button>
              </div>
            </div>
          )}
          {calConfirmMarkers && calConfirmMarkers.length > 0 && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
              <p className="text-sm text-amber-950">
                Agent chce dodać <strong>{calConfirmMarkers.length}</strong>{" "}
                {calConfirmMarkers.length === 1 ? "wpis" : "wpisy"} do kalendarza. Zapis działa{" "}
                <strong>na własne ryzyko</strong> — potwierdź, zanim coś trafi do Google Calendar.
              </p>
              <ul className="text-xs text-amber-900/90 space-y-1">
                {calConfirmMarkers.slice(0, 5).map((m, i) => (
                  <li key={i}>
                    • {m.title} — {m.start}
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-2 text-xs text-amber-950 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={calConfirmAccepted}
                  onChange={(e) => setCalConfirmAccepted(e.target.checked)}
                />
                <span>
                  Akceptuję zapis do kalendarza <strong>na własne ryzyko</strong>.
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!calConfirmAccepted || calScheduling}
                  onClick={() => void confirmPendingCalendar()}
                  className="h-8 px-3 rounded-md bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  {calScheduling ? "Zapisywanie…" : "Zapisz w kalendarzu"}
                </button>
                <button
                  type="button"
                  onClick={cancelPendingCalendar}
                  className="h-8 px-3 rounded-md border border-neutral-300 bg-white text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition-colors"
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}
          {imgConfirmPrompts && imgConfirmPrompts.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-950">
                Agent chce wygenerować <strong>{imgConfirmPrompts.length}</strong>{" "}
                {imgConfirmPrompts.length === 1 ? "grafikę" : "grafik"}. Każda zużywa kredyty — potwierdź, jeśli chcesz kontynuować.
              </p>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void confirmPendingImages()}
                  className="h-8 px-3 rounded-md bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
                >
                  Wygeneruj grafiki
                </button>
                <button
                  type="button"
                  onClick={cancelPendingImages}
                  className="h-8 px-3 rounded-md border border-neutral-300 bg-white text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition-colors"
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitPrompt(input);
            }}
            className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] focus-within:border-neutral-400 focus-within:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all"
          >
            {(queue.length > 0 || (paused && loading)) && (
              <div className="px-3 pt-3 flex flex-col gap-1.5">
                {queue.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                      <Clock className="h-3.5 w-3.5" strokeWidth={1.75} /> W kolejce ({queue.length})
                    </span>
                    <div className="flex items-center gap-2">
                      {paused && (
                        <button
                          type="button"
                          onClick={resumeQueue}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-700 hover:text-neutral-900"
                        >
                          <RotateCw className="h-3 w-3" strokeWidth={2} /> Wznów kolejkę
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={clearQueue}
                        className="text-[11px] font-medium text-neutral-500 hover:text-neutral-800"
                      >
                        Wyczyść
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {queue.map((q, i) => (
                    <span
                      key={`${i}-${q.slice(0, 12)}`}
                      className="inline-flex items-center gap-1.5 max-w-[260px] rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[12px] text-neutral-700"
                    >
                      <span className="truncate">{q}</span>
                      <button
                        type="button"
                        onClick={() => removeFromQueue(i)}
                        className="shrink-0 text-neutral-400 hover:text-neutral-700"
                        aria-label="Usuń z kolejki"
                      >
                        <X className="h-3 w-3" strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {pendingImage && (
              <div className="px-3 pt-3">
                <div className="relative inline-block">
                  <img
                    src={pendingImage.dataUrl}
                    alt="Załączone zdjęcie"
                    className="h-20 w-20 object-cover rounded-lg border border-neutral-200"
                  />
                  <button
                    type="button"
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-700 transition-colors"
                    aria-label="Usuń zdjęcie"
                  >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}
            <textarea
              id="agent-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitPrompt(input);
                }
              }}
              onPaste={(e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const item of items) {
                  if (item.kind === "file" && item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) {
                      e.preventDefault();
                      void handlePickImage(file);
                    }
                    break;
                  }
                }
              }}
              rows={4}
              placeholder={loading ? "Wpisz kolejny prompt — doda się do kolejki…" : "Opisz zadanie marketingowe… (możesz wkleić zdjęcie: Ctrl+V)"}
              className="w-full bg-transparent resize-none px-4 pt-3 pb-2 text-[15px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handlePickImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="flex items-center justify-between px-3 pb-2.5 gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Dodaj zdjęcie do promptu"
                className="h-8 px-2.5 rounded-md border border-neutral-200 bg-white text-neutral-600 text-xs font-medium flex items-center gap-1.5 hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-40 transition-colors shrink-0"
              >
                <ImagePlus className="h-4 w-4" strokeWidth={1.75} /> Zdjęcie
              </button>
              <div className="flex items-center gap-2 shrink-0">
                {loading || imgLoading || queue.length > 0 || (imgConfirmPrompts?.length ?? 0) > 0 ? (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    title="Zatrzymaj generowanie"
                    className="h-8 px-3 rounded-md border border-neutral-300 bg-white text-neutral-700 text-xs font-medium flex items-center gap-1.5 hover:bg-neutral-50 transition-colors"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" strokeWidth={2} /> Zatrzymaj
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={!input.trim() && !pendingImage}
                  className="h-8 px-3 rounded-md bg-neutral-900 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-30 hover:bg-neutral-800 transition-colors"
                >
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} /> {loading ? "Do kolejki" : "Wyślij"}
                </button>
              </div>
            </div>
          </form>

          {/* Scenariusze na dole (rozwijane). Klik = uruchom od razu */}
          <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                  Gotowe działania
                </p>
                <p className="mt-1.5 text-[13px] text-neutral-600 leading-relaxed">
                  Wybierz, co chcesz zrobić. Kliknięcie kafelka od razu uruchomi odpowiedni scenariusz w czacie. Możesz też dopisać jedno zdanie, jeśli chcesz doprecyzować zadanie.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScenariosOpen((v) => !v)}
                className="shrink-0 text-[12px] px-4 py-2 rounded-full border border-neutral-300 bg-white hover:bg-neutral-50 transition font-semibold text-neutral-800"
              >
                {scenariosOpen ? "Zwiń listę" : "Pokaż gotowe działania"}
              </button>
            </div>

            {scenariosOpen && (
              <div className="mt-3">
                {/* Category chips */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {(Object.keys(CATEGORY_META) as ScenarioCategory[]).map((k) => {
                    const meta = CATEGORY_META[k];
                    const Icon = meta.icon;
                    const active = scenarioCategory === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setScenarioCategory(k)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-[12px] font-semibold transition-all ${
                          active
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${active ? "text-white" : "text-neutral-500"}`} strokeWidth={1.75} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {SCENARIOS.filter((s) => s.category === scenarioCategory).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={loading}
                      onClick={() => runScenario(s)}
                      className="group rounded-2xl border border-neutral-200 bg-white p-4 text-left hover:border-neutral-300 hover:bg-neutral-50/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-neutral-900 leading-snug">
                            {s.title}
                          </p>
                          <p className="mt-1.5 text-[13px] text-neutral-600 leading-snug">
                            {s.goal}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                          {s.timeEstimate}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.requiredInputs.map((x) => (
                          <span key={x} className="text-[10px] px-2 py-1 rounded-full bg-white border border-neutral-200 text-neutral-600">
                            {x}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SuggestionsPanel({
  suggestions,
  loading,
  onPick,
  onRun,
  onCustom,
  title,
}: {
  suggestions: string[];
  loading: boolean;
  onPick: (s: string) => void;
  onRun: (s: string) => void;
  onCustom: () => void;
  title?: string;
}) {
  const total = suggestions.length || 5;
  return (
    <div className="mb-3">
      <div className="rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[13px] font-semibold tracking-tight text-neutral-900">
              {title ?? "Sugerowane kroki"}
            </h3>
            <span className="text-[11px] text-neutral-400">
              {loading && suggestions.length === 0 ? "—" : `${total} kroków`}
            </span>
          </div>
          <button
            onClick={onCustom}
            className="text-[12px] text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Napisz własne
          </button>
        </div>
        <div className="divide-y divide-neutral-100">
          {loading && suggestions.length === 0
            ? [0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-5 w-12 rounded bg-neutral-100 animate-pulse" />
                  <div className="h-3 flex-1 max-w-md rounded bg-neutral-100 animate-pulse" />
                </div>
              ))
            : suggestions.map((s, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-neutral-50/60 transition-colors"
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 w-12 shrink-0">
                    {`${i + 1}/${total}`}
                  </span>
                  <button
                    onClick={() => onPick(s)}
                    className="text-[13px] text-neutral-800 leading-snug flex-1 text-left hover:text-neutral-950"
                    title="Wstaw do pola — możesz edytować przed wysłaniem"
                  >
                    {s}
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onPick(s)}
                      className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[12px] font-medium text-neutral-600 px-2 py-1 rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 transition-all"
                      title="Edytuj przed wysłaniem"
                    >
                      Edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => onRun(s)}
                      className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[12px] font-medium text-white px-2 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 transition-all"
                    >
                      <Play className="h-3 w-3" strokeWidth={2} /> Uruchom
                    </button>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
