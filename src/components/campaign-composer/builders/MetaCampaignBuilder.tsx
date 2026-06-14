import { useRef, useState } from "react";
import { CampaignMediaPicker } from "@/components/campaign-composer/CampaignMediaPicker";
import { metaAdsFields, META_GENDER_OPTIONS } from "@/modules/campaign-composer/config/metaAdsFields";
import { metaObjectiveSchema } from "@/modules/campaign-composer/domain/draft-schema";
import { normalizeDestinationUrl } from "@/modules/campaign-composer/validation/preflight";
import {
  Area,
  AuditList,
  Chips,
  ConnectAccountPrompt,
  ensureFirstCreative,
  Field,
  Money,
  MultiCheck,
  SectionTitle,
  Select,
  StepTabs,
  Text,
  patchCreative,
  type BuilderProps,
} from "./shared";
import { LaunchPanel } from "./LaunchPanel";

export function MetaCampaignBuilder(props: BuilderProps) {
  const { value, onChange, account, workspaceId, pages, issues, preview } = props;
  const [step, setStep] = useState("account");
  const latestValue = useRef(value);
  latestValue.current = value;
  const draft = ensureFirstCreative(value);
  const meta = draft.meta;
  if (!meta) return <ConnectAccountPrompt providerLabel="Meta Ads" />;

  const adset = draft.structure.adSets[0];
  const cr = adset?.creatives[0];

  const applyChange = (next: typeof draft) => onChange(ensureFirstCreative(next));
  const setMeta = (patch: Partial<NonNullable<typeof draft.meta>>) => applyChange({ ...draft, meta: { ...meta, ...patch } });
  const setAdset = (patch: Partial<typeof adset>) =>
    applyChange({ ...draft, structure: { ...draft.structure, adSets: draft.structure.adSets.map((a, i) => (i === 0 ? { ...a, ...patch } : a)) } });
  const setBudget = (patch: Partial<NonNullable<typeof adset.budget>>) =>
    setAdset({ budget: { currency: "PLN", ...(adset.budget ?? {}), ...patch } });
  const setAudience = (patch: Partial<typeof adset.audience>) => setAdset({ audience: { ...adset.audience, ...patch } });
  const setSchedule = (patch: Partial<NonNullable<typeof adset.schedule>>) => setAdset({ schedule: { ...(adset.schedule ?? {}), ...patch } });

  return (
    <div className="space-y-5">
      <StepTabs steps={metaAdsFields.steps} active={step} onSelect={setStep} />
      <div className="space-y-4 text-sm">
        {step === "account" && (
          <div className="space-y-4">
            <SectionTitle>Konto i zasoby Meta</SectionTitle>
            {!account.connected && <ConnectAccountPrompt providerLabel="Meta Ads" />}
            <Field label="Konto reklamowe">
              {account.adAccounts.length > 0 ? (
                <Select value={draft.channel.adAccountId} onChange={(v) => applyChange({ ...draft, channel: { ...draft.channel, adAccountId: v } })} options={account.adAccounts.map((a) => ({ value: a.id, label: a.name }))} />
              ) : (
                <Text value={draft.channel.adAccountId} onChange={(v) => applyChange({ ...draft, channel: { ...draft.channel, adAccountId: v } })} placeholder="act_..." />
              )}
            </Field>
            <Field label="Strona na Facebooku (Page)">
              <Select value={draft.channel.metaPageId ?? ""} onChange={(v) => applyChange({ ...draft, channel: { ...draft.channel, metaPageId: v || undefined } })} options={pages.map((p) => ({ value: p.id, label: p.name }))} />
            </Field>
            {pages.length === 0 && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                Brak stron na Facebooku. W sekcji Integracje połącz ponownie konto Meta, aby nadać uprawnienie do listy stron (pages_show_list).
              </p>
            )}
          </div>
        )}

        {step === "campaign" && (
          <div className="space-y-4">
            <SectionTitle>Kampania</SectionTitle>
            <Field label="Nazwa kampanii">
              <Text value={draft.structure.campaignName} onChange={(v) => applyChange({ ...draft, structure: { ...draft.structure, campaignName: v } })} />
            </Field>
            <Field label="Cel kampanii">
              <Select value={meta.objective} onChange={(v) => setMeta({ objective: metaObjectiveSchema.parse(v) })} options={metaAdsFields.campaignObjectives} />
            </Field>
            <Field label="Kategoria reklam specjalnych">
              <Select
                value={meta.specialAdCategory}
                onChange={(v) => setMeta({ specialAdCategory: v as typeof meta.specialAdCategory })}
                options={[
                  { value: "NONE", label: "Brak (zwykła reklama)" },
                  { value: "EMPLOYMENT", label: "Oferty pracy" },
                  { value: "HOUSING", label: "Nieruchomości" },
                  { value: "CREDIT", label: "Kredyt / finanse" },
                  { value: "ISSUES_ELECTIONS_POLITICS", label: "Sprawy społeczne / polityka" },
                ]}
              />
            </Field>
            {meta.specialAdCategory !== "NONE" && (
              <Field label="Kraje dla kategorii specjalnej (po przecinku)">
                <Chips values={meta.specialAdCategoryCountry} onChange={(v) => setMeta({ specialAdCategoryCountry: v })} placeholder="PL" />
              </Field>
            )}
            <Field label="Strategia budżetu">
              <Select value={meta.budgetStrategy} onChange={(v) => setMeta({ budgetStrategy: v as typeof meta.budgetStrategy })} options={[{ value: "ad_set_budget", label: "Budżet na poziomie zestawu reklam" }, { value: "campaign_budget", label: "Budżet kampanii (CBO)" }]} />
            </Field>
          </div>
        )}

        {step === "adset" && (
          <div className="space-y-4">
            <SectionTitle>Zestaw reklam</SectionTitle>
            <Field label="Nazwa zestawu reklam">
              <Text value={adset.name} onChange={(v) => setAdset({ name: v })} />
            </Field>
            <Field label="Cel optymalizacji">
              <Select value={adset.optimizationGoal ?? ""} onChange={(v) => setAdset({ optimizationGoal: v })} options={metaAdsFields.optimizationGoals} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Typ budżetu">
                <Select value={meta.campaignBudgetType} onChange={(v) => setMeta({ campaignBudgetType: v as typeof meta.campaignBudgetType })} options={metaAdsFields.budgetTypes} />
              </Field>
              <Field label="Budżet dzienny">
                <Money minor={adset.budget?.dailyBudgetMinorUnits} onChange={(m) => setBudget({ dailyBudgetMinorUnits: m })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <Text type="datetime-local" value={adset.schedule?.startAt?.slice(0, 16) ?? ""} onChange={(v) => setSchedule({ startAt: v ? new Date(v).toISOString() : undefined })} />
              </Field>
              <Field label="Koniec">
                <Text type="datetime-local" value={adset.schedule?.endAt?.slice(0, 16) ?? ""} onChange={(v) => setSchedule({ endAt: v ? new Date(v).toISOString() : undefined })} />
              </Field>
            </div>
          </div>
        )}

        {step === "targeting" && (
          <div className="space-y-4">
            <SectionTitle>Targetowanie</SectionTitle>
            <Field label="Kraje docelowe (po przecinku)">
              <Chips values={adset.audience.geoInclude} onChange={(v) => setAudience({ geoInclude: v })} placeholder="PL, DE" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Wiek min">
                <Text type="number" value={String(adset.audience.ageMin ?? 18)} onChange={(v) => setAudience({ ageMin: Number(v) || 18 })} />
              </Field>
              <Field label="Wiek max">
                <Text type="number" value={String(adset.audience.ageMax ?? 65)} onChange={(v) => setAudience({ ageMax: Number(v) || 65 })} />
              </Field>
            </div>
            <Field label="Płeć">
              <MultiCheck selected={meta.adSet.genders} onChange={(v) => setMeta({ adSet: { ...meta.adSet, genders: v } })} options={META_GENDER_OPTIONS} />
            </Field>
            <Field label="Placementy">
              <Select value={meta.adSet.placementMode} onChange={(v) => setMeta({ adSet: { ...meta.adSet, placementMode: v as typeof meta.adSet.placementMode } })} options={[{ value: "advantage", label: "Advantage+ (automatyczne)" }, { value: "manual", label: "Ręczne" }]} />
            </Field>
            {meta.adSet.placementMode === "manual" && (
              <Field label="Wybierz placementy">
                <MultiCheck selected={meta.adSet.placements} onChange={(v) => setMeta({ adSet: { ...meta.adSet, placements: v } })} options={metaAdsFields.placements} />
              </Field>
            )}
          </div>
        )}

        {step === "creative" && (
          <div className="space-y-4">
            <SectionTitle>Kreacja</SectionTitle>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <CampaignMediaPicker
                workspaceId={workspaceId}
                provider="meta"
                selectedAssetIds={cr!.assetIds}
                format={cr!.format}
                onFormatChange={(fmt) => applyChange(patchCreative(latestValue.current, { format: fmt }))}
                onChange={(assetIds) => applyChange(patchCreative(latestValue.current, { assetIds }))}
              />
            </div>
            <Field label="Nagłówek">
              <Text value={cr!.headline ?? ""} onChange={(v) => applyChange(patchCreative(draft, { headline: v }))} />
            </Field>
            <Field label="Tekst główny">
              <Area value={cr!.primaryText ?? ""} onChange={(v) => applyChange(patchCreative(draft, { primaryText: v }))} />
            </Field>
            <Field label="URL docelowy">
              <Text
                value={cr!.destinationUrl ?? ""}
                onChange={(v) => applyChange(patchCreative(draft, { destinationUrl: v }))}
                onBlur={() => {
                  const normalized = normalizeDestinationUrl(cr!.destinationUrl);
                  if (normalized && normalized !== cr!.destinationUrl) {
                    applyChange(patchCreative(latestValue.current, { destinationUrl: normalized }));
                  }
                }}
                placeholder="https://twoja-strona.pl"
              />
            </Field>
            <Field label="Przycisk akcji">
              <Select value={cr!.cta ?? "LEARN_MORE"} onChange={(v) => applyChange(patchCreative(draft, { cta: v }))} options={metaAdsFields.ctaOptions} />
            </Field>
          </div>
        )}

        {step === "tracking" && (
          <div className="space-y-4">
            <SectionTitle>Śledzenie</SectionTitle>
            <Field label="Piksel Meta">
              {account.pixels.length > 0 ? (
                <Select value={draft.channel.metaPixelId ?? ""} onChange={(v) => applyChange({ ...draft, channel: { ...draft.channel, metaPixelId: v || undefined } })} options={account.pixels.map((p) => ({ value: p.id, label: p.name }))} />
              ) : (
                <Text value={draft.channel.metaPixelId ?? ""} onChange={(v) => applyChange({ ...draft, channel: { ...draft.channel, metaPixelId: v || undefined } })} placeholder="Pixel ID" />
              )}
            </Field>
            <Field label="UTM / parametry URL">
              <Text
                value={cr?.urlTags ?? ""}
                onChange={(v) => setAdset({ creatives: adset.creatives.map((c, j) => (j === 0 ? { ...c, urlTags: v } : c)) })}
                placeholder="utm_source=facebook"
              />
            </Field>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <SectionTitle>Podgląd reklamy</SectionTitle>
              <div className="mt-2 space-y-1 text-xs">
                <p className="font-semibold">{cr?.headline || preview?.headline || "Nagłówek"}</p>
                <p className="text-muted-foreground">{cr?.primaryText || preview?.body || "Tekst reklamy"}</p>
                <p className="truncate text-muted-foreground">{cr?.destinationUrl || preview?.destination || "—"}</p>
              </div>
            </div>
            <AuditList issues={issues} />
            <LaunchPanel {...props} />
          </div>
        )}
      </div>
    </div>
  );
}