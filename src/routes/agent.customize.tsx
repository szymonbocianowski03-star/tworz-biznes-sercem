import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agent/customize")({
  component: CustomizeAgentPage,
});

type Goal =
  | "Tworzenie kampanii reklamowych"
  | "Analiza konkurencji"
  | "Generowanie postów social media"
  | "SEO i widoczność w Google"
  | "AI visibility / widoczność w ChatGPT"
  | "Lead generation"
  | "Pomysły na content"
  | "Analiza strony internetowej"
  | "Rekomendacje konwersji";

const TONE_PRESETS = [
  "Profesjonalny",
  "Ekspercki",
  "Sprzedażowy",
  "Premium",
  "Przyjazny",
  "Bezpośredni",
  "Edukacyjny",
  "Storytellingowy",
  "Inspirujący",
  "Konwersacyjny",
  "Luksusowy",
  "Minimalistyczny",
  "Z humorem",
  "Empatyczny",
  "Techniczny",
  "Buntowniczy",
  "Autorytatywny",
  "Casual",
] as const;

const INDUSTRY_CHIPS = [
  "SaaS",
  "E-commerce",
  "Nieruchomości",
  "Kancelarie prawne",
  "Finanse",
  "Medycyna",
  "Marketing agency",
  "Restauracje",
  "Beauty",
  "Edukacja",
  "Deweloperzy",
  "Firmy lokalne",
  "B2B services",
  "AI startup",
  "HR / Rekrutacja",
  "Fitness",
  "Coaching",
  "Fotografia",
  "Architektura",
  "Wnętrza",
  "Moda",
  "Gastronomia",
  "Hotelarstwo",
  "Turystyka",
  "Logistyka",
  "Produkcja",
  "Budownictwo",
  "Automotive",
  "Energia / OZE",
  "Rolnictwo",
  "Konsulting",
  "Księgowość",
  "Ubezpieczenia",
  "Wydawnictwa",
  "Kultura / sztuka",
  "Sport",
  "Gaming",
  "NGO",
  "Influencer / twórca",
  "Crypto / Web3",
  "Fintech",
  "Healthtech",
  "EdTech",
  "PropTech",
  "D2C",
] as const;

const GOAL_CHECKBOXES: Goal[] = [
  "Tworzenie kampanii reklamowych",
  "Analiza konkurencji",
  "Generowanie postów social media",
  "SEO i widoczność w Google",
  "AI visibility / widoczność w ChatGPT",
  "Lead generation",
  "Pomysły na content",
  "Analiza strony internetowej",
  "Rekomendacje konwersji",
];

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
        selected
          ? "border-blue-600/30 bg-blue-50 text-blue-700"
          : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      ].join(" ")}
    >
      {selected ? <Check className="h-3.5 w-3.5" /> : null}
      {label}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-4">
        <label className="text-sm font-semibold tracking-tight">{label}</label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function CustomizeAgentPage() {
  const navigate = useNavigate();

  const [tone, setTone] = useState("");
  const [industry, setIndustry] = useState("");
  const [audience, setAudience] = useState("");
  const [goalsText, setGoalsText] = useState("");
  const [uvp, setUvp] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<Goal[]>([]);

  const resetToAuto = () => {
    setTone("");
    setIndustry("");
    setAudience("");
    setGoalsText("");
    setUvp("");
    setSelectedGoals([]);
    try {
      localStorage.removeItem("mn.agentProfile.v1");
    } catch {}
    toast.success("Przywrócono tryb automatyczny — agent dobierze ustawienia sam.");
  };

  const previewGoals = useMemo(() => {
    const fromChecks = selectedGoals;
    const extra = goalsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const all = [...fromChecks, ...extra];
    const uniq = Array.from(new Set(all));
    return uniq.slice(0, 6);
  }, [goalsText, selectedGoals]);

  const saveProfile = () => {
    const payload = { tone, industry, audience, goalsText, selectedGoals, uvp };
    try {
      localStorage.setItem("mn.agentProfile.v1", JSON.stringify(payload));
      toast.success("Zapisano profil agenta.");
    } catch {
      toast.error("Nie udało się zapisać profilu (brak dostępu do pamięci).");
    }
  };

  const testAgent = () => {
    saveProfile();
    void navigate({ to: "/agent" });
  };

  return (
    <div className="px-6 md:px-10 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-2xl">
            <p className="editorial-eyebrow text-blue-600">Personalizacja</p>
            <h1 className="mt-3 font-display text-3xl md:text-4xl font-extrabold tracking-tighter">
              Skonfiguruj swojego agenta marketingowego
            </h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed">
              Ustaw profil agenta, aby generował kampanie, treści i rekomendacje dopasowane do Twojej marki, branży oraz
              grupy docelowej.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px] items-start">
          {/* Formularz */}
          <section className="rounded-md border border-foreground/10 bg-background shadow-soft">
            <div className="p-6 md:p-8">
              <div className="grid gap-6">
                <Field label="Ton komunikacji" hint="Jak ma brzmieć agent?">
                  <input
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="Np. profesjonalny, konkretny, sprzedażowy, ale nienachalny"
                    className="w-full rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/40"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {TONE_PRESETS.map((p) => (
                      <Chip
                        key={p}
                        label={p}
                        selected={tone.trim().toLowerCase() === p.toLowerCase()}
                        onClick={() => setTone(p)}
                      />
                    ))}
                  </div>
                </Field>

                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Branża">
                    <input
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="Np. SaaS, e-commerce, nieruchomości, usługi B2B, marketing agency"
                      className="w-full rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/40"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {INDUSTRY_CHIPS.map((c) => (
                        <Chip
                          key={c}
                          label={c}
                          selected={industry.trim().toLowerCase() === c.toLowerCase()}
                          onClick={() => setIndustry(c)}
                        />
                      ))}
                    </div>
                  </Field>

                  <Field label="Grupa docelowa">
                    <textarea
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="Np. founderzy startupów, marketing managerowie, właściciele firm 10–200 osób"
                      rows={4}
                      className="w-full resize-none rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/40"
                    />
                  </Field>
                </div>

                <Field label="Cele agenta">
                  <textarea
                    value={goalsText}
                    onChange={(e) => setGoalsText(e.target.value)}
                    placeholder="Np. tworzenie kampanii, analiza konkurencji, SEO, social media, lead generation"
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/40"
                  />
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {GOAL_CHECKBOXES.map((g) => {
                      const checked = selectedGoals.includes(g);
                      return (
                        <label
                          key={g}
                          className="flex items-start gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm hover:bg-muted/40 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedGoals((prev) =>
                                e.target.checked ? [...prev, g] : prev.filter((x) => x !== g)
                              );
                            }}
                            className="mt-0.5 h-4 w-4 accent-blue-600"
                          />
                          <span className="leading-snug">{g}</span>
                        </label>
                      );
                    })}
                  </div>
                </Field>

                <Field label="Unikalna propozycja wartości">
                  <textarea
                    value={uvp}
                    onChange={(e) => setUvp(e.target.value)}
                    placeholder="Np. Pomagamy firmom szybciej planować i automatyzować marketing dzięki agentom AI"
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/40"
                  />
                </Field>

                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={saveProfile}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition shadow-elevated"
                  >
                    Zapisz profil agenta
                  </button>
                  <button
                    type="button"
                    onClick={testAgent}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-border bg-white text-sm font-semibold hover:bg-muted/50 transition-colors"
                  >
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Przetestuj agenta
                  </button>
                  <button
                    type="button"
                    onClick={resetToAuto}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-border bg-white text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Wyczyść profil — agent sam dobierze ton, branżę i cele"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Przywróć automatyczne
                  </button>
                  <div className="sm:ml-auto text-xs text-muted-foreground">
                    Podpowiedź: zacznij od tonu i branży — to daje najlepszy efekt.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Podgląd */}
          <aside className="rounded-md border border-foreground/10 bg-muted/20 shadow-soft">
            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-bold tracking-tight">Podgląd NOW</h2>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-600/20">
                  Status: Gotowy do konfiguracji
                </span>
              </div>

              <div className="mt-5 rounded-md border border-foreground/10 bg-background p-4">
                <div className="text-sm font-semibold tracking-tight">MarketingNow · NOW</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Row label="Ton" value={tone} fallback="Automatyczne" />
                  <Row label="Branża" value={industry} fallback="Automatyczne" />
                  <Row
                    label="Cele"
                    value={previewGoals.length > 0 ? previewGoals.join(", ") : ""}
                    fallback="Automatyczne"
                  />
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                Pola oznaczone „Automatyczne" zostaną dobrane przez agenta na podstawie kontekstu rozmowy. Możesz w każdej
                chwili nacisnąć <span className="font-semibold text-foreground">Przywróć automatyczne</span>, żeby zresetować profil.
              </p>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}

function Row({ label, value, fallback }: { label: string; value: string; fallback?: string }) {
  const isAuto = !value && !!fallback;
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      {isAuto ? (
        <span className="text-right font-medium text-blue-700 inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          {fallback}
        </span>
      ) : (
        <span className="text-right font-medium text-foreground">{value || fallback}</span>
      )}
    </div>
  );
}
