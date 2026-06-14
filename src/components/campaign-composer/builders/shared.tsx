import { type ReactNode, useState } from "react";
import type { CampaignComposerDraftPayload } from "@/modules/campaign-composer/domain/draft-schema";
import type { FieldOption } from "@/modules/campaign-composer/config/types";
import type { ValidationIssue } from "@/modules/campaign-composer/validation/preflight";

/** Wspólne propsy przekazywane do każdego kreatora platformy. */
export type BuilderProps = {
  value: CampaignComposerDraftPayload;
  workspaceId: string;
  /** Aktualizacja + zapis szkicu (cicho, bez toastu). */
  onChange: (next: CampaignComposerDraftPayload) => void;
  pages: { id: string; name: string }[];
  account: AccountInfo;
  issues: ValidationIssue[];
  preview: { headline: string; body: string; destination: string } | null;
  jobs: { id: string; status: string; intent: string }[];
  jobItems: { step_kind: string; status: string; provider_message: string | null }[];
  activeJob: string | null;
  blocking: number;
  onRunAudit: () => void;
  onEnqueue: (intent: "draft_only" | "go_live") => void;
  onRefreshJobs: () => void;
  onLoadItems: (jobId: string) => void;
  onCancelJob: (jobId: string) => void;
};

export type AccountInfo = {
  connected: boolean;
  name?: string;
  /** Lista kont reklamowych (id + nazwa) dla wyboru. */
  adAccounts: { id: string; name: string }[];
  pixels: { id: string; name: string }[];
  identities?: { id: string; name: string }[];
};

/* ── Prymitywy formularza ───────────────────────────────────────────────── */

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">{hint}</span>}
    </label>
  );
}

export function Text({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return <input type={type} className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function Area({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      className={`${inputCls} min-h-[100px]`}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: FieldOption[] }) {
  return (
    <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— wybierz —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Pole pieniężne: wyświetla wartość w jednostkach głównych, zapisuje w podrzędnych (np. grosze). */
export function Money({
  minor,
  onChange,
  currency = "PLN",
}: {
  minor: number | undefined;
  onChange: (minor: number | undefined) => void;
  currency?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        min={0}
        step={1}
        className={inputCls}
        value={minor != null ? String(Math.round(minor) / 100) : ""}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (v === "") return onChange(undefined);
          const num = Number(v);
          onChange(Number.isFinite(num) ? Math.round(num * 100) : undefined);
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{currency}</span>
    </div>
  );
}

/** Tagi rozdzielone przecinkami (np. lokalizacje, języki, zainteresowania). */
export function Chips({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <input
      className={inputCls}
      defaultValue={values.join(", ")}
      placeholder={placeholder}
      onBlur={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
    />
  );
}

/** Wielokrotny wybor z listy opcji (checkboxy w siatce). */
export function MultiCheck({
  selected,
  onChange,
  options,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  options: FieldOption[];
}) {
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter((x) => x !== val) : [...selected, val]);
  };
  return (
    <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o.value)}
          className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
            selected.includes(o.value)
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Nawigacja krokami kreatora. */
export function StepTabs({
  steps,
  active,
  onSelect,
}: {
  steps: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {steps.map((s, i) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            active === s.id
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-200/70 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          <span className="mr-1 opacity-50">{i + 1}.</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</p>;
}

export function useStep(initial: string) {
  return useState(initial);
}

/** Komponent kroku audytu (lista problemów) — wspólny dla wszystkich platform. */
export function AuditList({ issues }: { issues: ValidationIssue[] }) {
  return (
    <div className="text-sm">
      <p className="mb-3 text-xs text-zinc-500">
        Sprawdź listę przed publikacją. Pozycje oznaczone jako krytyczne blokują przycisk „Opublikuj kampanię”.
      </p>
      <ul className="space-y-2">
        {issues.length === 0 ? (
          <li className="text-emerald-700 dark:text-emerald-400">Brak zgłoszonych problemów. Uruchom przegląd, aby odświeżyć.</li>
        ) : (
          issues.map((i) => (
            <li
              key={i.code + i.message}
              className={`rounded-lg border px-3 py-2 text-xs ${
                i.severity === "blocking"
                  ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                  : "border-border bg-muted text-foreground"
              }`}
            >
              {i.severity === "blocking" ? "Krytyczne: " : "Uwaga: "}
              {i.message}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** Prompt łączenia konta, gdy platforma nie jest podłączona. */
export function ConnectAccountPrompt({ providerLabel }: { providerLabel: string }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
      <p className="font-semibold">Połącz konto {providerLabel}</p>
      <p className="mt-1 text-xs leading-relaxed">
        Aby utworzyć i opublikować kampanię, najpierw połącz swoje konto reklamowe {providerLabel} w sekcji Integracje.
      </p>
      <a
        href="/integrations"
        className="mt-3 inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
      >
        Przejdź do Integracji
      </a>
    </div>
  );
}

/** Gdy starszy szkic nie ma kreacji — dodaje domyślną jednostkę reklamową. */
export function ensureFirstCreative(value: CampaignComposerDraftPayload): CampaignComposerDraftPayload {
  const adSet = value.structure.adSets[0];
  if (!adSet || adSet.creatives.length > 0) return value;
  const adSets = value.structure.adSets.map((a, i) =>
    i === 0
      ? {
          ...a,
          creatives: [{ id: crypto.randomUUID(), format: "single_image" as const, assetIds: [] }],
        }
      : a,
  );
  return { ...value, structure: { ...value.structure, adSets } };
}

/** Aktualizuje pola pierwszej kreacji (assetIds/format) — wspólny nośnik mediów. */
export function patchCreative(
  value: CampaignComposerDraftPayload,
  patch: Partial<{ assetIds: string[]; format: CampaignComposerDraftPayload["structure"]["adSets"][number]["creatives"][number]["format"]; headline: string; primaryText: string; destinationUrl: string; cta: string }>,
): CampaignComposerDraftPayload {
  const base = ensureFirstCreative(value);
  const adSets = base.structure.adSets.map((a, i) => {
    if (i !== 0) return a;
    const creatives = a.creatives.map((c, j) => (j === 0 ? { ...c, ...patch } : c));
    return { ...a, creatives };
  });
  return { ...base, structure: { ...base.structure, adSets } };
}