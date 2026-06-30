import { createFileRoute, Link } from "@tanstack/react-router";
import { AppBackLink } from "@/components/AppBackLink";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookUp, ChevronDown, ChevronRight, FileText, Folder, Plus, Search, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { MetaIntegrationCard } from "@/components/MetaIntegrationCard";
import { LinkedInIntegrationCard } from "@/components/LinkedInIntegrationCard";
import { AutomatedEmailsCard } from "@/components/AutomatedEmailsCard";
import { CalendarIntegrationCard } from "@/components/CalendarIntegrationCard";

import skillCreator from "@/skills/personal/skill-creator/SKILL.md?raw";
import marketingPrinciples from "@/skills/marketing-principles/SKILL.md?raw";
import adTemplates from "@/skills/ad-templates/SKILL.md?raw";
import { adTemplateFileNodes } from "@/lib/adTemplatesTree";
import { supabaseFnHeaders } from "@/lib/supabaseFnHeaders";
import { isCreditsLimitMessage, useCreditsUpgrade } from "@/contexts/CreditsUpgradeContext";
import { scheduleCreditsRefresh } from "@/lib/creditsRefresh";
import { supabaseEdgeFunctionUrl } from "@/integrations/supabase/publicEnv";

import { marketingSkillsBranch } from "./-marketingSkillsTree";

type SkillFile = {
  kind: "file";
  id: string;
  name: string;
  description: string;
  content: string;
};

type SkillDir = {
  kind: "dir";
  id: string;
  name: string;
  children: SkillNode[];
};

type SkillNode = SkillFile | SkillDir;

type UserSkill = {
  id: string;
  name: string;
  description: string;
  whenToUse: string;
  content: string;
  createdAt: number;
  updatedAt: number;
};

const USER_SKILLS_KEY = "mn.userSkills.v1";

const TREE: SkillNode[] = [
  {
    kind: "dir",
    id: "personal",
    name: "Osobiste",
    children: [
      {
        kind: "dir",
        id: "personal/skill-creator",
        name: "Kreator skilli",
        children: [
          {
            kind: "file",
            id: "personal/skill-creator/SKILL.md",
            name: "SKILL.md",
            description: "Twórz i doprecyzowuj skillsy przez rozmowę krok po kroku.",
            content: skillCreator,
          },
        ],
      },
    ],
  },
  marketingSkillsBranch,
  {
    kind: "dir",
    id: "ad-templates",
    name: "Szablony reklam",
    children: [
      {
        kind: "file",
        id: "ad-templates/SKILL.md",
        name: "SKILL.md",
        description: "Nawigacja po szablonach reklamowych.",
        content: adTemplates,
      },
      {
        kind: "dir",
        id: "marketing/templates",
        name: "szablony",
        children: [...adTemplateFileNodes],
      },
    ],
  },
  {
    kind: "dir",
    id: "marketing-principles",
    name: "Zasady marketingu",
    children: [
      {
        kind: "file",
        id: "marketing-principles/SKILL.md",
        name: "SKILL.md",
        description: "Zasady strategii, kreacji i compliance (minimum).",
        content: marketingPrinciples,
      },
    ],
  },
];

function flattenFiles(nodes: SkillNode[]): SkillFile[] {
  const out: SkillFile[] = [];
  const walk = (n: SkillNode) => {
    if (n.kind === "file") out.push(n);
    else n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

function collectDirIds(nodes: SkillNode[]): string[] {
  const out: string[] = [];
  const walk = (n: SkillNode) => {
    if (n.kind === "dir") {
      out.push(n.id);
      n.children.forEach(walk);
    }
  };
  nodes.forEach(walk);
  return out;
}

function filterTree(nodes: SkillNode[], q: string): SkillNode[] {
  const query = q.trim().toLowerCase();
  if (!query) return nodes;

  const filterNode = (n: SkillNode): SkillNode | null => {
    if (n.kind === "file") {
      const hay = `${n.name} ${n.description} ${n.id}`.toLowerCase();
      return hay.includes(query) ? n : null;
    }
    const nextChildren = n.children.map(filterNode).filter(Boolean) as SkillNode[];
    if (nextChildren.length === 0) return null;
    return { ...n, children: nextChildren };
  };

  return nodes.map(filterNode).filter(Boolean) as SkillNode[];
}

export const Route = createFileRoute("/agent/skills")({
  head: () => ({ meta: [{ title: "Umiejętności — MarketingNow" }] }),
  component: SkillsPage,
});

function SkillsPage() {
  const allFiles = useMemo(() => flattenFiles(TREE), []);
  const defaultFileId = "personal/skill-creator/SKILL.md";

  const [tab, setTab] = useState<"skills" | "connectors">("skills");
  const [query, setQuery] = useState("");
  const [openDirs, setOpenDirs] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    for (const id of collectDirIds(TREE)) o[id] = true;
    return o;
  });
  const [activeId, setActiveId] = useState(defaultFileId);
  const [userSkillsVersion, setUserSkillsVersion] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const userSkills = useMemo(() => readUserSkills(), [userSkillsVersion]);

  const computedTree = useMemo(() => {
    const my: SkillDir = {
      kind: "dir",
      id: "my-skills",
      name: "Twoje umiejętności",
      children: userSkills.map((s) => ({
        kind: "file" as const,
        id: `my-skills/${s.id}.md`,
        name: `${s.name}.md`,
        description: s.description,
        content: renderUserSkillMd(s),
      })),
    };
    return [my, ...TREE];
  }, [userSkills]);

  const allFilesAll = useMemo(() => flattenFiles(computedTree), [computedTree]);
  const active = useMemo(
    () => allFilesAll.find((f) => f.id === activeId) ?? allFilesAll.find((f) => f.id === defaultFileId) ?? allFilesAll[0],
    [activeId, allFilesAll]
  );

  const tree = useMemo(() => filterTree(computedTree, query), [computedTree, query]);

  const toggleDir = (id: string) => setOpenDirs((p) => ({ ...p, [id]: !p[id] }));

  const removeUserSkillFile = (fileId: string) => {
    if (!fileId.startsWith("my-skills/") || !fileId.endsWith(".md")) return;
    const skillId = fileId.slice("my-skills/".length, -".md".length);
    if (!skillId) return;
    if (!confirm("Usunąć tę umiejętność z przeglądarki? Nie da się tego cofnąć.")) return;
    const next = readUserSkills().filter((s) => s.id !== skillId);
    writeUserSkills(next);
    setUserSkillsVersion((v) => v + 1);
    if (activeId === fileId) setActiveId(defaultFileId);
    toast.success("Usunięto umiejętność");
  };

  const activeIsUserSkill = activeId.startsWith("my-skills/") && activeId.endsWith(".md");

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[oklch(0.985_0.003_260)] text-foreground">
      <div className="mx-auto max-w-[1400px] px-4 pt-4 md:px-6">
        <AppBackLink />
      </div>
      <div className="mx-auto grid max-w-[1400px] gap-0 md:grid-cols-[320px_1fr]">
        <aside className="border-b border-border bg-[oklch(0.978_0.003_260)] md:border-b-0 md:border-r">
          <div className="p-4">
            <div className="flex items-center gap-2 rounded-xl bg-background/70 p-1 border border-border">
              <button
                type="button"
                onClick={() => setTab("skills")}
                className={[
                  "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  tab === "skills" ? "bg-background shadow-soft" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                Umiejętności
              </button>
              <button
                type="button"
                onClick={() => setTab("connectors")}
                className={[
                  "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  tab === "connectors" ? "bg-background shadow-soft" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                Integracje
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj…"
                  className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/25"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowUpload(true)}
                className="h-9 w-9 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
                title="Wgraj książkę / PDF jako umiejętność"
              >
                <BookUp className="h-4 w-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="h-9 w-9 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
                title="Utwórz nowy skill"
              >
                <Plus className="h-4 w-4 mx-auto" />
              </button>
            </div>
          </div>

          <div className="px-2 pb-4 md:max-h-[calc(100vh-3.5rem-92px)] md:overflow-y-auto">
            {tab === "connectors" ? (
              <div className="px-3 py-4 space-y-3">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold">Integracje</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    To są te same integracje co w{" "}
                    <Link to="/integrations" className="underline hover:text-foreground">
                      /integrations
                    </Link>
                    .
                  </p>
                </div>
                <MetaIntegrationCard />
                <LinkedInIntegrationCard />
                <CalendarIntegrationCard />
                <AutomatedEmailsCard />
              </div>
            ) : (
              <div className="space-y-0.5">
                {tree.map((n) => (
                  <SkillTreeNode
                    key={n.id}
                    node={n}
                    depth={0}
                    openDirs={openDirs}
                    toggleDir={toggleDir}
                    activeId={activeId}
                    onSelectFile={(id) => setActiveId(id)}
                    onDeleteUserFile={removeUserSkillFile}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="bg-background">
          <div className="border-b border-border px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="truncate font-mono">{active?.id}</span>
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">{active?.name}</h1>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{active?.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeIsUserSkill && (
                  <button
                    type="button"
                    onClick={() => removeUserSkillFile(activeId)}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Usuń umiejętność
                  </button>
                )}
                <Link
                  to="/agent/customize"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold hover:bg-muted/40 transition-colors"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Profil agenta
                </Link>
                <button
                  type="button"
                  onClick={() => setShowUpload(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold hover:bg-muted/40 transition-colors"
                >
                  <BookUp className="h-4 w-4 text-accent" />
                  Wgraj książkę / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold hover:bg-muted/40 transition-colors"
                >
                  <Sparkles className="h-4 w-4 text-accent" />
                  Nowa umiejętność (AI)
                </button>
                <Link
                  to="/agent"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
                >
                  Panel czatu
                </Link>
              </div>
            </div>
          </div>

          <div className="px-6 py-8">
            <div className="rounded-3xl border border-border bg-surface-elevated p-6 md:p-8 shadow-soft">
              <article className="prose prose-sm max-w-none prose-headings:tracking-tight prose-p:leading-relaxed prose-li:my-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{active?.content ?? ""}</ReactMarkdown>
              </article>
            </div>
          </div>
        </section>
      </div>

      <CreateSkillModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(created) => {
          setShowCreate(false);
          setUserSkillsVersion((v) => v + 1);
          setActiveId(`my-skills/${created.id}.md`);
        }}
      />

      <UploadBookModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onCreated={(created) => {
          setShowUpload(false);
          setUserSkillsVersion((v) => v + 1);
          setActiveId(`my-skills/${created.id}.md`);
        }}
      />
    </div>
  );
}

function SkillTreeNode({
  node,
  depth,
  openDirs,
  toggleDir,
  activeId,
  onSelectFile,
  onDeleteUserFile,
}: {
  node: SkillNode;
  depth: number;
  openDirs: Record<string, boolean>;
  toggleDir: (id: string) => void;
  activeId: string;
  onSelectFile: (id: string) => void;
  onDeleteUserFile?: (fileId: string) => void;
}) {
  const pad = 10 + depth * 12;

  if (node.kind === "file") {
    const active = node.id === activeId;
    const canDelete = node.id.startsWith("my-skills/") && typeof onDeleteUserFile === "function";
    return (
      <div
        className={[
          "group flex items-stretch gap-0.5 rounded-lg transition-colors",
          active ? "bg-[oklch(0.96_0.02_95)]" : "hover:bg-background/70",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => onSelectFile(node.id)}
          className={[
            "flex-1 min-w-0 text-left px-2 py-2 text-sm transition-colors rounded-lg",
            active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
          style={{ paddingLeft: pad }}
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{node.name}</span>
          </span>
        </button>
        {canDelete ? (
          <button
            type="button"
            title="Usuń"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDeleteUserFile!(node.id);
            }}
            className="shrink-0 self-center mr-1 p-2 rounded-md text-muted-foreground opacity-60 hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  const open = openDirs[node.id] ?? true;
  return (
    <div>
      <button
        type="button"
        onClick={() => toggleDir(node.id)}
        className="w-full text-left rounded-lg px-2 py-2 text-sm font-semibold text-foreground/90 hover:bg-background/60 transition-colors"
        style={{ paddingLeft: pad }}
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 opacity-70" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />}
          <Folder className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{node.name}</span>
        </span>
      </button>
      {open ? (
        <div className="space-y-0.5">
          {node.children.length === 0 ? (
            <p
              className="mx-2 py-2 text-[11px] leading-relaxed text-muted-foreground rounded-lg bg-background/50 border border-dashed border-border/80 px-2.5"
              style={{ marginLeft: pad + 8 }}
            >
              {node.id === "my-skills" ?
                "Tu pojawią się umiejętności, które sam dodasz (przycisk + przy wyszukiwarce lub wgranie PDF). Gotowe szablony masz niżej: „Osobiste”, „Umiejętności marketingowe” itd."
              : "Brak pozycji w tym folderze."}
            </p>
          ) : (
            node.children.map((c) => (
              <SkillTreeNode
                key={c.id}
                node={c}
                depth={depth + 1}
                openDirs={openDirs}
                toggleDir={toggleDir}
                activeId={activeId}
                onSelectFile={onSelectFile}
                onDeleteUserFile={onDeleteUserFile}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function readUserSkills(): UserSkill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_SKILLS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

function writeUserSkills(next: UserSkill[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_SKILLS_KEY, JSON.stringify(next));
}

function renderUserSkillMd(s: UserSkill) {
  return `# ${s.name}\n\n${s.description}\n\n## Kiedy używać\n\n${s.whenToUse}\n\n---\n\n${s.content}\n`;
}

function kebab(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9ąęłńóśźż _-]+/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function CreateSkillModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (s: UserSkill) => void;
}) {
  const { openCreditsUpgrade } = useCreditsUpgrade();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (e.target instanceof Node && boxRef.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const create = async () => {
    const q = goal.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const result = await generateSkillWithAI(q);
      const id = `${Date.now().toString(36)}-${kebab(result.name).slice(0, 40) || "skill"}`;
      const now = Date.now();
      const item: UserSkill = {
        id,
        name: result.name,
        description: result.description,
        whenToUse: result.whenToUse,
        content: result.content,
        createdAt: now,
        updatedAt: now,
      };
      const next = [item, ...readUserSkills()];
      writeUserSkills(next);
      toast.success("Utworzono umiejętność i dodano do „Umiejętności”.");
      setGoal("");
      onCreated(item);
      scheduleCreditsRefresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isCreditsLimitMessage(msg)) openCreditsUpgrade(msg);
      else toast.error("Nie udało się wygenerować skilla. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div ref={boxRef} className="w-full max-w-xl rounded-3xl border border-border bg-background shadow-elevated">
        <div className="flex items-start justify-between gap-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Kreator umiejętności</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Utwórz umiejętność przez AI</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Opisz jednym zdaniem, co umiejętność ma pomóc agentowi robić. AI wygeneruje nazwę, opis, triggery i treść w Markdown.
            </p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4 mx-auto" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-3">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder='Np. „Pomóż mi tworzyć reklamy Meta dla B2B SaaS: 5 wariantów, premium ton, bez clickbaitu.”'
            rows={4}
            className="w-full resize-none rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground px-4 py-2"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={create}
              disabled={loading || !goal.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Generuję…" : "Wygeneruj umiejętność"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function generateSkillWithAI(q: string): Promise<{
  name: string;
  description: string;
  whenToUse: string;
  content: string;
}> {
  const SUGGEST_URL = supabaseEdgeFunctionUrl("suggest");
  const headers = await supabaseFnHeaders();
  if (!headers) throw new Error("Zaloguj się, aby użyć AI.");
  const seed = [
    {
      role: "user" as const,
      content:
        `Jesteś „Kreatorem umiejętności”. Na podstawie opisu użytkownika wygeneruj nową umiejętność jako Markdown.\n` +
        `Wynik zwróć jako JSON z kluczami: name, description, whenToUse, content.\n` +
        `- name: krótka, opisowa nazwa (PL)\n` +
        `- description: jednolinijkowy opis kiedy agent ma ładować skilla (intencja + sytuacja)\n` +
        `- whenToUse: 5–12 trigger phrases (w jednym akapicie lub punktach)\n` +
        `- content: Markdown (max ~2000 tokenów), z nagłówkami ## i konkretnymi zasadami + przykłady.\n\n` +
        `Opis użytkownika:\n${q}`,
    },
  ];

  const resp = await fetch(SUGGEST_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages: seed }),
  });
  if (resp.status === 402) throw new Error("Limit planu darmowego — ulepsz konto w „Plan i kredyty”.");
  const data = await resp.json();
  const s0 = Array.isArray(data?.suggestions) ? data.suggestions[0] : null;
  if (typeof s0 !== "string" || !s0.trim()) throw new Error("No suggestions");

  // suggestion[0] powinno być JSON stringiem; próbujemy parse, a jak nie, to fallback do prostego formatu
  try {
    const parsed = JSON.parse(s0);
    if (!parsed?.name || !parsed?.description || !parsed?.whenToUse || !parsed?.content) throw new Error("bad json");
    return parsed;
  } catch {
    return {
      name: "Nowa umiejętność",
      description: "Używaj tej umiejętności, gdy użytkownik potrzebuje doprecyzowanego workflow.",
      whenToUse: "- gdy użytkownik chce nowy workflow\n- gdy chce szablon outputu\n- gdy chce zasady jakości",
      content: s0,
    };
  }
}

function UploadBookModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (s: UserSkill) => void;
}) {
  const { openCreditsUpgrade } = useCreditsUpgrade();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (e.target instanceof Node && boxRef.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const handleFile = (f: File | null) => {
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async () => {
    if (!file || loading) return;
    setLoading(true);
    try {
      setProgress("Czytam plik…");
      let raw = "";
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        raw = await extractPdfText(file, (p) => setProgress(p));
      } else {
        raw = await file.text();
      }
      const trimmed = raw.replace(/\s+\n/g, "\n").trim();
      if (!trimmed) throw new Error("Pusty plik");

      // Limit, by nie przesadzić z kontekstem do AI
      const MAX = 60_000;
      const corpus = trimmed.length > MAX ? trimmed.slice(0, MAX) + "\n…(skrócono)" : trimmed;

      setProgress("Wyciągam triki i zasady z książki…");
      const result = await summarizeBookToSkill({
        bookName: name.trim() || file.name,
        notes: notes.trim(),
        text: corpus,
      });

      const id = `${Date.now().toString(36)}-${kebab(result.name).slice(0, 40) || "ksiazka"}`;
      const now = Date.now();
      const item: UserSkill = {
        id,
        name: result.name,
        description: result.description,
        whenToUse: result.whenToUse,
        content: result.content,
        createdAt: now,
        updatedAt: now,
      };
      writeUserSkills([item, ...readUserSkills()]);
      toast.success("Książka zamieniona na umiejętność. Agent będzie z niej korzystał.");
      setFile(null);
      setName("");
      setNotes("");
      onCreated(item);
      scheduleCreditsRefresh();
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      if (isCreditsLimitMessage(msg)) openCreditsUpgrade(msg);
      else toast.error("Nie udało się przetworzyć pliku. Spróbuj innym PDF lub krótszym fragmentem.");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div ref={boxRef} className="w-full max-w-xl rounded-3xl border border-border bg-background shadow-elevated">
        <div className="flex items-start justify-between gap-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Wgraj książkę / PDF</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">Zamień książkę w umiejętność agenta</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Wgraj PDF lub plik tekstowy (np. notatki, triki, rozdział). AI wyciągnie kluczowe zasady i doda je jako
              umiejętność, z której będzie korzystać podczas rozmów.
            </p>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground">
            <X className="h-4 w-4 mx-auto" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Plik (PDF / TXT / MD, do ~10 MB)</span>
            <input
              type="file"
              accept=".pdf,application/pdf,.txt,.md,text/plain,text/markdown"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:text-background file:px-4 file:py-2 file:text-xs file:font-semibold hover:file:opacity-90"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Nazwa umiejętności</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Np. Triki z „Building a StoryBrand”"
              className="mt-1.5 w-full rounded-2xl border border-border bg-surface-elevated px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Notatka dla AI (opcjonalnie)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Np. „Skup się na frameworkach copy i strukturze landing page. Pomijaj historie autora.”"
              className="mt-1.5 w-full resize-none rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </label>

          {progress ? <p className="text-xs text-muted-foreground">{progress}</p> : null}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground px-4 py-2"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={loading || !file}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-40"
            >
              <BookUp className="h-4 w-4" />
              {loading ? "Przetwarzam…" : "Dodaj jako umiejętność"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function extractPdfText(file: File, onProgress?: (s: string) => void): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  // Worker via CDN — pasuje do wersji z node_modules
  const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  const total = doc.numPages;
  const limit = Math.min(total, 200);
  for (let i = 1; i <= limit; i++) {
    onProgress?.(`Czytam stronę ${i} z ${limit}…`);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    pages.push(text);
  }
  return pages.join("\n\n");
}

async function summarizeBookToSkill(input: { bookName: string; notes: string; text: string }): Promise<{
  name: string;
  description: string;
  whenToUse: string;
  content: string;
}> {
  const URL_ = supabaseEdgeFunctionUrl("extract-skill");
  const headers = await supabaseFnHeaders();
  if (!headers) throw new Error("Zaloguj się, aby użyć AI.");

  const system =
    `Jesteś „Kreatorem umiejętności z książki” dla agenta marketingowego MarketingNow. ` +
    `Wyciągasz konkretne triki, frameworki i zasady — nie streszczasz fabuły, nie cytujesz długich fragmentów (prawa autorskie). ` +
    `Odpowiadasz wyłącznie wywołując narzędzie build_skill.`;
  const prompt =
        `Z poniższego materiału wyciągnij konkretne triki, frameworki i zasady, ` +
        `które agent marketingowy ma stosować w rozmowach. Nie streszczaj fabuły, nie cytuj długich fragmentów (prawa autorskie). ` +
        `- name: krótka nazwa skilla po polsku, nawiązująca do tytułu „${input.bookName}”\n` +
        `- description: 1 zdanie kiedy ten skill ładować\n` +
        `- whenToUse: 5–10 trigger phrases (kropki)\n` +
        `- content: Markdown z sekcjami: ## Główne zasady, ## Frameworki krok-po-kroku, ## Szablony / formuły copy, ` +
        `## Czego unikać, ## Checklisty. Konkretnie i operacyjnie.\n\n` +
        (input.notes ? `Wskazówki użytkownika: ${input.notes}\n\n` : "") +
        `Materiał źródłowy (książka „${input.bookName}”):\n${input.text}`;

  const resp = await fetch(URL_, {
    method: "POST",
    headers,
    body: JSON.stringify({ system, prompt }),
  });
  if (resp.status === 402) throw new Error("Limit planu darmowego — ulepsz konto.");
  if (!resp.ok) throw new Error(`extract-skill ${resp.status}`);
  const parsed = await resp.json();
  if (!parsed?.name || !parsed?.description || !parsed?.whenToUse || !parsed?.content) {
    throw new Error("Niekompletna odpowiedź AI");
  }
  return parsed;
}
