import { useRef, useState } from "react";
import { CampaignMediaPicker } from "@/components/campaign-composer/CampaignMediaPicker";
import { linkedinAdsFields } from "@/modules/campaign-composer/config/linkedinAdsFields";
import { linkedInObjectiveSchema } from "@/modules/campaign-composer/domain/draft-schema";
import {
  Area,
  AuditList,
  Chips,
  ConnectAccountPrompt,
  ensureFirstCreative,
  Field,
  FieldWithAi,
  Money,
  SectionTitle,
  Select,
  StepTabs,
  Text,
  patchCreative,
  type BuilderProps,
} from "./shared";
import { LaunchPanel } from "./LaunchPanel";

export function LinkedInCampaignBuilder(props: BuilderProps) {
  const { value, onChange, account, workspaceId, issues, preview } = props;
  const [step, setStep] = useState("account");
  const latestValue = useRef(value);
  latestValue.current = value;
  const li = value.linkedin;
  if (!li) return <ConnectAccountPrompt providerLabel="LinkedIn Ads" />;

  const adset = value.structure.adSets[0];
  const cr = adset?.creatives[0];
  const group = value.structure.campaignGroup ?? { id: crypto.randomUUID(), name: "" };

  const setLi = (patch: Partial<NonNullable<typeof value.linkedin>>) => onChange({ ...value, linkedin: { ...li, ...patch } });
  const setGroup = (patch: Partial<typeof group>) => onChange({ ...value, structure: { ...value.structure, campaignGroup: { ...group, ...patch } } });
  const setAdset = (patch: Partial<typeof adset>) =>
    onChange({ ...value, structure: { ...value.structure, adSets: value.structure.adSets.map((a, i) => (i === 0 ? { ...a, ...patch } : a)) } });
  const setBudget = (patch: Partial<NonNullable<typeof adset.budget>>) => setAdset({ budget: { currency: "PLN", ...(adset.budget ?? {}), ...patch } });
  const setAudience = (patch: Partial<typeof adset.audience>) => setAdset({ audience: { ...adset.audience, ...patch } });
  const setSchedule = (patch: Partial<NonNullable<typeof adset.schedule>>) => setAdset({ schedule: { ...(adset.schedule ?? {}), ...patch } });
  const aiCtx = {
    provider: "linkedin" as const,
    campaignType: li.objective,
    campaignName: value.structure.campaignName,
    finalUrl: cr?.destinationUrl,
  };

  return (
    <div className="space-y-5">
      <StepTabs steps={linkedinAdsFields.steps} active={step} onSelect={setStep} />
      <div className="space-y-4 text-sm">
        {step === "account" && (
          <div className="space-y-4">
            <SectionTitle>Konto LinkedIn Ads</SectionTitle>
            {!account.connected && <ConnectAccountPrompt providerLabel="LinkedIn Ads" />}
            <Field label="Konto reklamowe">
              {account.adAccounts.length > 0 ? (
                <Select value={value.channel.adAccountId} onChange={(v) => onChange({ ...value, channel: { ...value.channel, adAccountId: v } })} options={account.adAccounts.map((a) => ({ value: a.id, label: a.name }))} />
              ) : (
                <Text value={value.channel.adAccountId} onChange={(v) => onChange({ ...value, channel: { ...value.channel, adAccountId: v } })} placeholder="urn:li:sponsoredAccount:..." />
              )}
            </Field>
            <Field label="Organizacja (Company Page)">
              <Text value={value.channel.linkedinOrganizationUrn ?? ""} onChange={(v) => onChange({ ...value, channel: { ...value.channel, linkedinOrganizationUrn: v || undefined } })} placeholder="urn:li:organization:..." />
            </Field>
          </div>
        )}

        {step === "campaign" && (
          <div className="space-y-4">
            <SectionTitle>Campaign / Campaign Group</SectionTitle>
            <Field label="Nazwa grupy kampanii (Campaign Group)">
              <Text value={group.name} onChange={(v) => setGroup({ name: v })} />
            </Field>
            <Field label="Nazwa kampanii">
              <Text value={value.structure.campaignName} onChange={(v) => onChange({ ...value, structure: { ...value.structure, campaignName: v } })} />
            </Field>
            <Field label="Budżet grupy dynamiczny">
              <Select value={li.campaign.dynamicGroupBudget} onChange={(v) => setLi({ campaign: { ...li.campaign, dynamicGroupBudget: v as typeof li.campaign.dynamicGroupBudget } })} options={[{ value: "disabled", label: "Wyłączony" }, { value: "enabled", label: "Włączony" }]} />
            </Field>
          </div>
        )}

        {step === "adset" && (
          <div className="space-y-4">
            <SectionTitle>Objective i Ad Set</SectionTitle>
            <Field label="Cel kampanii (Objective)">
              <Select value={li.objective} onChange={(v) => setLi({ objective: linkedInObjectiveSchema.parse(v) })} options={linkedinAdsFields.campaignObjectives} />
            </Field>
            <Field label="Nazwa zestawu reklam">
              <Text value={adset.name} onChange={(v) => setAdset({ name: v })} />
            </Field>
            <Field label="Cel optymalizacji">
              <Select value={adset.optimizationGoal ?? ""} onChange={(v) => setAdset({ optimizationGoal: v })} options={linkedinAdsFields.optimizationGoals} />
            </Field>
          </div>
        )}

        {step === "targeting" && (
          <div className="space-y-4">
            <SectionTitle>Targetowanie B2B</SectionTitle>
            <Field label="Lokalizacje (po przecinku)">
              <Chips values={adset.audience.geoInclude} onChange={(v) => setAudience({ geoInclude: v })} placeholder="PL, DE" />
            </Field>
            <Field label="Branże (industries)">
              <Chips values={li.adSet.industries} onChange={(v) => setLi({ adSet: { ...li.adSet, industries: v } })} />
            </Field>
            <Field label="Stanowiska (job titles)">
              <Chips values={li.adSet.jobTitles} onChange={(v) => setLi({ adSet: { ...li.adSet, jobTitles: v } })} />
            </Field>
            <Field label="Poziom stanowiska (seniorities)">
              <Chips values={li.adSet.seniorities} onChange={(v) => setLi({ adSet: { ...li.adSet, seniorities: v } })} />
            </Field>
            <Field label="Wielkość firmy (company sizes)">
              <Chips values={li.adSet.companySizes} onChange={(v) => setLi({ adSet: { ...li.adSet, companySizes: v } })} />
            </Field>
          </div>
        )}

        {step === "budget" && (
          <div className="space-y-4">
            <SectionTitle>Budżet i harmonogram</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Typ budżetu">
                <Select value={li.adSet.budgetType} onChange={(v) => setLi({ adSet: { ...li.adSet, budgetType: v as typeof li.adSet.budgetType } })} options={linkedinAdsFields.budgetTypes} />
              </Field>
              <Field label="Budżet dzienny">
                <Money minor={adset.budget?.dailyBudgetMinorUnits} onChange={(m) => setBudget({ dailyBudgetMinorUnits: m })} />
              </Field>
            </div>
            <Field label="Strategia stawki (Bid)">
              <Select value={li.adSet.bidType} onChange={(v) => setLi({ adSet: { ...li.adSet, bidType: v as typeof li.adSet.bidType } })} options={linkedinAdsFields.bidStrategies} />
            </Field>
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

        {step === "creative" && cr && (
          <div className="space-y-4">
            <SectionTitle>Format reklamy i kreacja</SectionTitle>
            <Field label="Format reklamy">
              <Select value={li.ad.adFormat} onChange={(v) => setLi({ ad: { ...li.ad, adFormat: v as typeof li.ad.adFormat } })} options={linkedinAdsFields.creativeFormats} />
            </Field>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <CampaignMediaPicker
                workspaceId={workspaceId}
                provider="linkedin"
                selectedAssetIds={cr.assetIds ?? []}
                format={cr.format}
                onFormatChange={(fmt) => onChange(patchCreative(latestValue.current, { format: fmt }))}
                onChange={(assetIds, suggestedFormat) => {
                  const base = ensureFirstCreative(latestValue.current);
                  onChange(
                    patchCreative(base, {
                      assetIds,
                      ...(suggestedFormat ? { format: suggestedFormat } : {}),
                    }),
                  );
                }}
              />
            </div>
            <FieldWithAi
              label="Nagłówek"
              ai={{
                kind: "headline",
                context: aiCtx,
                existing: cr.headline,
                maxChars: 70,
                onFilled: (text) => onChange(patchCreative(value, { headline: text.split("\n")[0] ?? text })),
              }}
            >
              <Text value={cr.headline ?? ""} onChange={(v) => onChange(patchCreative(value, { headline: v }))} />
            </FieldWithAi>
            <FieldWithAi
              label="Tekst wprowadzający"
              ai={{
                kind: "primaryText",
                context: aiCtx,
                existing: cr.primaryText,
                maxChars: 150,
                onFilled: (text) => onChange(patchCreative(value, { primaryText: text })),
              }}
            >
              <Area value={cr.primaryText ?? ""} onChange={(v) => onChange(patchCreative(value, { primaryText: v }))} />
            </FieldWithAi>
            <Field label="URL docelowy">
              <Text value={cr.destinationUrl ?? ""} onChange={(v) => onChange(patchCreative(value, { destinationUrl: v }))} placeholder="https://" />
            </Field>
            <Field label="Przycisk akcji (CTA)">
              <Select value={cr.cta ?? ""} onChange={(v) => onChange(patchCreative(value, { cta: v }))} options={linkedinAdsFields.ctaOptions} />
            </Field>
          </div>
        )}

        {step === "tracking" && (
          <div className="space-y-4">
            <SectionTitle>Tracking i zgodność</SectionTitle>
            <Field label="Insight Tag / Pixel (URN konwersji)">
              <Text value={li.conversionPixelUrn ?? ""} onChange={(v) => setLi({ conversionPixelUrn: v || undefined })} placeholder="urn:li:..." />
            </Field>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={li.complianceAcknowledged ?? false} onChange={(e) => setLi({ complianceAcknowledged: e.target.checked })} />
              Potwierdzam wymagane oświadczenia zgodności LinkedIn
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={li.nonDiscriminationAcknowledged ?? false} onChange={(e) => setLi({ nonDiscriminationAcknowledged: e.target.checked })} />
              Potwierdzam politykę niedyskryminacji
            </label>
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