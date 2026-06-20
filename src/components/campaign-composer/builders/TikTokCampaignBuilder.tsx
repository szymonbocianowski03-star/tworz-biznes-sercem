import { useRef, useState } from "react";
import { CampaignMediaPicker } from "@/components/campaign-composer/CampaignMediaPicker";
import { tiktokAdsFields, TIKTOK_AGE_OPTIONS, TIKTOK_GENDER_OPTIONS } from "@/modules/campaign-composer/config/tiktokAdsFields";
import { tiktokAdsManagerUrl } from "@/lib/campaignComposerLabels";
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

export function TikTokCampaignBuilder(props: BuilderProps) {
  const { value, onChange, account, workspaceId, issues, preview } = props;
  const [step, setStep] = useState("account");
  const latestValue = useRef(value);
  latestValue.current = value;
  const tt = value.tiktok;
  if (!tt) return <ConnectAccountPrompt providerLabel="TikTok Ads" />;

  const ag = tt.adGroup;
  const target = tt.targeting;
  const ad = tt.ad;

  const setTT = (patch: Partial<NonNullable<typeof value.tiktok>>) => onChange({ ...value, tiktok: { ...tt, ...patch } });
  const setAG = (patch: Partial<typeof ag>) => onChange({ ...value, tiktok: { ...tt, adGroup: { ...ag, ...patch } } });
  const setTarget = (patch: Partial<typeof target>) => onChange({ ...value, tiktok: { ...tt, targeting: { ...target, ...patch } } });
  const setAd = (patch: Partial<typeof ad>) => onChange({ ...value, tiktok: { ...tt, ad: { ...ad, ...patch } } });

  const isConversion = tt.objective === "website_conversion" || tt.objective === "tiktok_shop";
  const cr0 = value.structure.adSets[0]?.creatives[0];

  return (
    <div className="space-y-5">
      <StepTabs steps={tiktokAdsFields.steps} active={step} onSelect={setStep} />

      <div className="space-y-4 text-sm">
        {/* 1. Konto */}
        {step === "account" && (
          <div className="space-y-4">
            <SectionTitle>Konto TikTok Ads</SectionTitle>
            {!account.connected ? (
              <ConnectAccountPrompt providerLabel="TikTok Ads" />
            ) : (
              <>
                <Field label="Konto reklamowe (Advertiser)">
                  {account.adAccounts.length > 0 ? (
                    <Select
                      value={value.channel.adAccountId}
                      onChange={(v) => onChange({ ...value, channel: { ...value.channel, adAccountId: v, tiktokAdvertiserId: v } })}
                      options={account.adAccounts.map((a) => ({ value: a.id, label: a.name }))}
                    />
                  ) : (
                    <Text value={value.channel.adAccountId} onChange={(v) => onChange({ ...value, channel: { ...value.channel, adAccountId: v, tiktokAdvertiserId: v } })} placeholder="Advertiser ID" />
                  )}
                </Field>
                {account.name && <p className="text-xs text-zinc-500">Połączone konto: {account.name}</p>}
              </>
            )}
          </div>
        )}

        {/* 2. Campaign */}
        {step === "campaign" && (
          <div className="space-y-4">
            <SectionTitle>Campaign</SectionTitle>
            <Field label="Nazwa kampanii">
              <Text value={value.structure.campaignName} onChange={(v) => onChange({ ...value, structure: { ...value.structure, campaignName: v } })} />
            </Field>
            <Field label="Cel kampanii (Objective)">
              <Select value={tt.objective} onChange={(v) => setTT({ objective: v as typeof tt.objective })} options={tiktokAdsFields.campaignObjectives} />
            </Field>
            <Field label="Tryb budżetu kampanii">
              <Select value={tt.budgetMode} onChange={(v) => setTT({ budgetMode: v as typeof tt.budgetMode })} options={tiktokAdsFields.budgetTypes} />
            </Field>
            {tt.budgetMode !== "no_limit" && (
              <Field label="Kwota budżetu kampanii">
                <Money minor={tt.budgetAmountMinor} onChange={(m) => setTT({ budgetAmountMinor: m })} />
              </Field>
            )}
            <Field label="Status po publikacji">
              <Select
                value={tt.status}
                onChange={(v) => setTT({ status: v as typeof tt.status })}
                options={[
                  { value: "draft", label: "Szkic (nie aktywuj)" },
                  { value: "paused", label: "Wstrzymana" },
                  { value: "active", label: "Aktywna" },
                ]}
              />
            </Field>
          </div>
        )}

        {/* 3. Ad Group */}
        {step === "adgroup" && (
          <div className="space-y-4">
            <SectionTitle>Ad Group</SectionTitle>
            <Field label="Nazwa grupy reklam">
              <Text value={ag.name} onChange={(v) => setAG({ name: v })} />
            </Field>
            <Field label="Placement">
              <Select
                value={ag.placementMode}
                onChange={(v) => setAG({ placementMode: v as typeof ag.placementMode })}
                options={[
                  { value: "automatic", label: "Automatyczny (zalecane)" },
                  { value: "manual", label: "Ręczny" },
                ]}
              />
            </Field>
            {ag.placementMode === "manual" && (
              <Field label="Wybierz placementy">
                <MultiCheck selected={ag.placements} onChange={(v) => setAG({ placements: v })} options={tiktokAdsFields.placements.filter((p) => p.value !== "automatic")} />
              </Field>
            )}
            <Field label="Cel optymalizacji (Optimization Goal)">
              <Select value={ag.optimizationGoal} onChange={(v) => setAG({ optimizationGoal: v })} options={tiktokAdsFields.optimizationGoals} />
            </Field>
            <Field label="Strategia stawki (Bid Strategy)">
              <Select value={ag.bidStrategy ?? ""} onChange={(v) => setAG({ bidStrategy: v || undefined })} options={tiktokAdsFields.bidStrategies} />
            </Field>
          </div>
        )}

        {/* 4. Targetowanie i budżet */}
        {step === "targeting" && (
          <div className="space-y-4">
            <SectionTitle>Targetowanie i budżet grupy reklam</SectionTitle>
            <Field label="Lokalizacje (ID lokalizacji TikTok, po przecinku)" hint="Wymagane. Np. identyfikatory krajów/regionów z TikTok Ads.">
              <Chips values={target.locations} onChange={(v) => setTarget({ locations: v })} placeholder="np. 2616977 (Polska)" />
            </Field>
            <Field label="Grupy wiekowe">
              <MultiCheck selected={target.ageGroups} onChange={(v) => setTarget({ ageGroups: v })} options={TIKTOK_AGE_OPTIONS} />
            </Field>
            <Field label="Płeć">
              <MultiCheck selected={target.genders} onChange={(v) => setTarget({ genders: v })} options={TIKTOK_GENDER_OPTIONS} />
            </Field>
            <Field label="Języki (kody, po przecinku)">
              <Chips values={target.languages} onChange={(v) => setTarget({ languages: v })} placeholder="np. pl, en" />
            </Field>
            <Field label="Zainteresowania (ID kategorii, po przecinku)">
              <Chips values={target.interests} onChange={(v) => setTarget({ interests: v })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tryb budżetu grupy">
                <Select
                  value={ag.budgetMode}
                  onChange={(v) => setAG({ budgetMode: v as typeof ag.budgetMode })}
                  options={[
                    { value: "daily", label: "Dzienny" },
                    { value: "lifetime", label: "Całkowity" },
                  ]}
                />
              </Field>
              <Field label="Kwota budżetu grupy">
                <Money minor={ag.budgetAmountMinor} onChange={(m) => setAG({ budgetAmountMinor: m })} />
              </Field>
            </div>
            <Field label="Harmonogram">
              <Select
                value={ag.scheduleType}
                onChange={(v) => setAG({ scheduleType: v as typeof ag.scheduleType })}
                options={[
                  { value: "continuous", label: "Ciągły (od teraz)" },
                  { value: "specific_dates", label: "Konkretne daty" },
                ]}
              />
            </Field>
            {ag.scheduleType === "specific_dates" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start">
                  <Text type="datetime-local" value={ag.startAt ?? ""} onChange={(v) => setAG({ startAt: v || undefined })} />
                </Field>
                <Field label="Koniec">
                  <Text type="datetime-local" value={ag.endAt ?? ""} onChange={(v) => setAG({ endAt: v || undefined })} />
                </Field>
              </div>
            )}
          </div>
        )}

        {/* 5. Video i kreacja */}
        {step === "creative" && (
          <div className="space-y-4">
            <SectionTitle>Video i kreacja</SectionTitle>
            <Field label="Nazwa reklamy">
              <Text value={ad.name} onChange={(v) => setAd({ name: v })} />
            </Field>
            <Field label="Typ kreacji">
              <Select value={ad.creativeType} onChange={(v) => setAd({ creativeType: v as typeof ad.creativeType })} options={tiktokAdsFields.creativeFormats} />
            </Field>
            {ad.creativeType === "spark" ? (
              <Field label="Link / ID posta TikTok (Spark Ad)">
                <Text value={ad.sparkPostUrl ?? ""} onChange={(v) => setAd({ sparkPostUrl: v || undefined })} placeholder="https://www.tiktok.com/@.../video/..." />
              </Field>
            ) : (
              cr0 && (
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <CampaignMediaPicker
                    workspaceId={workspaceId}
                    provider="tiktok"
                    selectedAssetIds={cr0.assetIds ?? []}
                    format="video"
                    onChange={(assetIds) => {
                      const base = ensureFirstCreative(latestValue.current);
                      onChange(
                        patchCreative(base, {
                          assetIds,
                          format: "video",
                        }),
                      );
                    }}
                  />
                </div>
              )
            )}
            <Field label="Tekst reklamy (caption)">
              <Area value={ad.adText} onChange={(v) => setAd({ adText: v })} />
            </Field>
            <Field label="Przycisk akcji (CTA)">
              <Select value={ad.cta} onChange={(v) => setAd({ cta: v })} options={tiktokAdsFields.ctaOptions} />
            </Field>
            <Field label="URL docelowy" hint="Wymagany dla celu Ruch/Konwersje. Musi być https://">
              <Text value={ad.destinationUrl ?? ""} onChange={(v) => setAd({ destinationUrl: v || undefined })} placeholder="https://" />
            </Field>
            <Field label="Nazwa wyświetlana (Display name)">
              <Text value={ad.displayName ?? ""} onChange={(v) => setAd({ displayName: v || undefined })} />
            </Field>
          </div>
        )}

        {/* 6. Tracking */}
        {step === "tracking" && (
          <div className="space-y-4">
            <SectionTitle>Tracking i konwersje</SectionTitle>
            {isConversion && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                Cel konwersji wymaga TikTok Pixela oraz zdarzenia konwersji.
              </p>
            )}
            <Field label="TikTok Pixel">
              {account.pixels.length > 0 ? (
                <Select value={ag.pixelId ?? ""} onChange={(v) => setAG({ pixelId: v || undefined })} options={account.pixels.map((p) => ({ value: p.id, label: p.name }))} />
              ) : (
                <Text value={ag.pixelId ?? ""} onChange={(v) => setAG({ pixelId: v || undefined })} placeholder="Pixel ID" />
              )}
            </Field>
            <Field label="Zdarzenie konwersji (Optimization event)">
              <Text value={ag.conversionEvent ?? ""} onChange={(v) => setAG({ conversionEvent: v || undefined })} placeholder="np. COMPLETE_PAYMENT" />
            </Field>
            <Field label="UTM / parametry śledzenia">
              <Text value={ad.utm ?? ""} onChange={(v) => setAd({ utm: v || undefined })} placeholder="utm_source=tiktok&utm_medium=cpc" />
            </Field>
          </div>
        )}

        {/* 7. Podgląd i publikacja */}
        {step === "review" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <SectionTitle>Podgląd reklamy</SectionTitle>
              <div className="mt-2 space-y-1 text-xs">
                <p className="font-semibold">{ad.displayName || account.name || "Twoja marka"}</p>
                <p className="text-muted-foreground">{ad.adText || preview?.body || "Tekst reklamy pojawi się tutaj."}</p>
                <p className="truncate text-muted-foreground">{ad.destinationUrl || preview?.destination || "—"}</p>
              </div>
            </div>
            <AuditList issues={issues} />
            <LaunchPanel {...props} />
            {value.channel.tiktokAdvertiserId && (
              <a href={tiktokAdsManagerUrl(value.channel.tiktokAdvertiserId)} target="_blank" rel="noreferrer" className="inline-block text-xs font-semibold text-sky-700 underline dark:text-sky-300">
                Otwórz w TikTok Ads Manager →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}