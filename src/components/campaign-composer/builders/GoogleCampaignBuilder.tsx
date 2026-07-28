import { useMemo, useRef, useState } from "react";
import { CampaignMediaPicker } from "@/components/campaign-composer/CampaignMediaPicker";
import {
  GOOGLE_CAMPAIGN_TYPE_HINTS,
  GOOGLE_CAMPAIGN_TYPE_OPTIONS,
  GOOGLE_MIN_DAILY_BUDGET_MINOR,
  googleAdsFields,
  googleNeedsAppId,
  googleNeedsImages,
  googleNeedsKeywords,
  googleNeedsMerchant,
  googleNeedsYoutube,
  type GoogleCampaignType,
} from "@/modules/campaign-composer/config/googleAdsFields";
import { googleCampaignTypeSchema } from "@/modules/campaign-composer/domain/draft-schema";
import { normalizeDestinationUrl } from "@/modules/campaign-composer/validation/preflight";
import {
  Area,
  AuditList,
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

function parseYoutubeLines(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .map((s) => {
      const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/);
      return m?.[1] ?? (s.length >= 6 && !/[/:?]/.test(s) ? s : "");
    })
    .filter(Boolean);
}

export function GoogleCampaignBuilder(props: BuilderProps) {
  const { value, onChange, account, workspaceId, issues, preview } = props;
  const [step, setStep] = useState("account");
  const latestValue = useRef(value);
  latestValue.current = value;
  const draft = ensureFirstCreative(value);
  const google = draft.google;
  if (!google) return <ConnectAccountPrompt providerLabel="Google Ads" />;

  const type = google.campaignType as GoogleCampaignType;
  const adset = draft.structure.adSets[0];
  const cr = adset?.creatives[0];
  const assetCount = cr?.assetIds?.length ?? 0;
  const showMedia = type !== "SEARCH" && type !== "SHOPPING" && type !== "APP";
  const showYoutube = googleNeedsYoutube(type) || type === "PERFORMANCE_MAX" || type === "DEMAND_GEN";
  const showTexts = type !== "SHOPPING";
  const showUrl = type !== "APP" && type !== "SHOPPING";

  const applyChange = (next: typeof draft) => onChange(ensureFirstCreative(next));
  const setGoogle = (patch: Partial<NonNullable<typeof draft.google>>) =>
    applyChange({ ...draft, google: { ...google, ...patch } });
  const aiCtx = {
    provider: "google" as const,
    campaignType: type,
    campaignName: draft.structure.campaignName,
    finalUrl: google.finalUrl ?? cr?.destinationUrl,
    businessName: google.businessName,
  };

  const mediaSummary = useMemo(() => {
    if (!assetCount) return "Brak materiałów medialnych.";
    return `${assetCount} ${assetCount === 1 ? "materiał" : assetCount < 5 ? "materiały" : "materiałów"}`;
  }, [assetCount]);

  const defaultAdGroupName = (t: GoogleCampaignType) => {
    if (t === "PERFORMANCE_MAX") return "Asset group 1";
    if (t === "SHOPPING") return "Grupa produktowa";
    if (t === "APP") return "App assets";
    return "Grupa reklam 1";
  };

  return (
    <div className="space-y-5">
      <StepTabs steps={googleAdsFields.steps} active={step} onSelect={setStep} />
      <div className="space-y-4 text-sm">
        {step === "account" && (
          <div className="space-y-4">
            <SectionTitle>Konto Google Ads</SectionTitle>
            {!account.connected && <ConnectAccountPrompt providerLabel="Google Ads" />}
            <Field label="Customer ID (konto reklamowe)">
              {account.adAccounts.length > 0 ? (
                <Select
                  value={draft.channel.adAccountId}
                  onChange={(v) => applyChange({ ...draft, channel: { ...draft.channel, adAccountId: v } })}
                  options={account.adAccounts.map((a) => ({ value: a.id, label: a.name }))}
                />
              ) : (
                <Text
                  value={draft.channel.adAccountId}
                  onChange={(v) =>
                    applyChange({
                      ...draft,
                      channel: { ...draft.channel, adAccountId: v.replace(/[^0-9-]/g, "") },
                    })
                  }
                  placeholder="123-456-7890"
                />
              )}
            </Field>
            <Field label="Login Customer ID (MCC, opcjonalnie)">
              <Text
                value={draft.channel.googleLoginCustomerId ?? ""}
                onChange={(v) =>
                  applyChange({
                    ...draft,
                    channel: {
                      ...draft.channel,
                      googleLoginCustomerId: v.replace(/[^0-9]/g, "") || undefined,
                    },
                  })
                }
                placeholder="tylko cyfry — gdy zarządzasz przez MCC"
              />
            </Field>
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
              Integracja działa <strong>na własne ryzyko</strong>. Odpowiadasz za budżet, treści i zgodność z polityką
              Google Ads.
            </p>
          </div>
        )}

        {step === "campaign" && (
          <div className="space-y-4">
            <SectionTitle>Typ i nazwa kampanii</SectionTitle>
            <FieldWithAi
              label="Nazwa kampanii"
              ai={{
                kind: "campaignName",
                context: aiCtx,
                existing: draft.structure.campaignName,
                maxChars: 80,
                onFilled: (text) =>
                  applyChange({ ...draft, structure: { ...draft.structure, campaignName: text.split("\n")[0] ?? text } }),
              }}
            >
              <Text
                value={draft.structure.campaignName}
                onChange={(v) => applyChange({ ...draft, structure: { ...draft.structure, campaignName: v } })}
              />
            </FieldWithAi>
            <Field label="Typ kampanii (wszystkie dostępne)">
              <Select
                value={google.campaignType}
                onChange={(v) => {
                  const campaignType = googleCampaignTypeSchema.parse(v) as GoogleCampaignType;
                  setGoogle({
                    campaignType,
                    adGroupName: defaultAdGroupName(campaignType),
                  });
                }}
                options={[...GOOGLE_CAMPAIGN_TYPE_OPTIONS]}
              />
            </Field>
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
              {GOOGLE_CAMPAIGN_TYPE_HINTS[type]}
            </p>
            {type !== "PERFORMANCE_MAX" && type !== "APP" && (
              <Field label="Nazwa grupy reklam / asset group">
                <Text value={google.adGroupName} onChange={(v) => setGoogle({ adGroupName: v })} />
              </Field>
            )}
            {type === "PERFORMANCE_MAX" && (
              <Field label="Nazwa asset group">
                <Text value={google.adGroupName} onChange={(v) => setGoogle({ adGroupName: v })} />
              </Field>
            )}
            {googleNeedsMerchant(type) && (
              <Field label="Merchant Center ID">
                <Text
                  value={google.merchantCenterId ?? ""}
                  onChange={(v) => setGoogle({ merchantCenterId: v.replace(/[^0-9]/g, "") || undefined })}
                  placeholder="np. 123456789"
                />
              </Field>
            )}
            {googleNeedsAppId(type) && (
              <>
                <Field label="ID aplikacji">
                  <Text
                    value={google.appId ?? ""}
                    onChange={(v) => setGoogle({ appId: v.trim() || undefined })}
                    placeholder="com.firma.app lub numeryczne App Store ID"
                  />
                </Field>
                <Field label="Sklep">
                  <Select
                    value={google.appStore ?? "GOOGLE_APP_STORE"}
                    onChange={(v) => setGoogle({ appStore: v as "GOOGLE_APP_STORE" | "APPLE_APP_STORE" })}
                    options={[
                      { value: "GOOGLE_APP_STORE", label: "Google Play" },
                      { value: "APPLE_APP_STORE", label: "Apple App Store" },
                    ]}
                  />
                </Field>
              </>
            )}
            <Field label="Status startowy">
              <Select
                value={google.status}
                onChange={(v) => setGoogle({ status: v as "paused" | "active" })}
                options={[
                  { value: "paused", label: "Wstrzymana (zalecane)" },
                  { value: "active", label: "Aktywna po publikacji" },
                ]}
              />
            </Field>
          </div>
        )}

        {step === "targeting" && (
          <div className="space-y-4">
            <SectionTitle>Budżet i targetowanie</SectionTitle>
            <Field label="Budżet dzienny">
              <Money
                minor={google.dailyBudgetMinor}
                onChange={(minor) => {
                  const amount = minor ?? 0;
                  applyChange({
                    ...draft,
                    google: { ...google, dailyBudgetMinor: amount },
                    structure: {
                      ...draft.structure,
                      adSets: draft.structure.adSets.map((a, i) =>
                        i === 0
                          ? {
                              ...a,
                              budget: {
                                currency: "PLN",
                                ...(a.budget ?? {}),
                                dailyBudgetMinorUnits: amount,
                              },
                            }
                          : a,
                      ),
                    },
                  });
                }}
              />
            </Field>
            {google.dailyBudgetMinor < GOOGLE_MIN_DAILY_BUDGET_MINOR && (
              <p className="text-xs text-amber-700">
                Zalecane minimum ok. {(GOOGLE_MIN_DAILY_BUDGET_MINOR / 100).toFixed(0)} w walucie konta.
              </p>
            )}
            <Field label="Strategia stawek">
              <Select
                value={google.bidStrategy}
                onChange={(v) => setGoogle({ bidStrategy: v })}
                options={googleAdsFields.bidStrategies}
              />
            </Field>
            <Field label="Kraje (kody, np. PL)">
              <Text
                value={(google.geoTargets ?? []).join(", ")}
                onChange={(v) =>
                  setGoogle({
                    geoTargets: v
                      .split(",")
                      .map((s) => s.trim().toUpperCase())
                      .filter(Boolean),
                  })
                }
                placeholder="PL, DE"
              />
            </Field>
            {googleNeedsKeywords(type) && (
              <>
                <Field label="Słowa kluczowe (po przecinku)">
                  <Area
                    value={(google.keywords ?? []).join(", ")}
                    onChange={(v) =>
                      setGoogle({
                        keywords: v
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="marketing, reklama google, oferta"
                  />
                </Field>
                <Field label="Sieć partnerów wyszukiwania">
                  <Select
                    value={google.includeSearchPartners ? "yes" : "no"}
                    onChange={(v) => setGoogle({ includeSearchPartners: v === "yes" })}
                    options={[
                      { value: "no", label: "Nie" },
                      { value: "yes", label: "Tak" },
                    ]}
                  />
                </Field>
              </>
            )}
          </div>
        )}

        {step === "creative" && (
          <div className="space-y-4">
            <SectionTitle>Kreacja — {GOOGLE_CAMPAIGN_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type}</SectionTitle>

            {showUrl && (
              <Field label="Adres docelowy (Final URL)">
                <Text
                  value={google.finalUrl ?? cr?.destinationUrl ?? ""}
                  onChange={(v) => {
                    const url = normalizeDestinationUrl(v) ?? v;
                    applyChange(
                      patchCreative({ ...draft, google: { ...google, finalUrl: url } }, { destinationUrl: url }),
                    );
                  }}
                  placeholder="https://twoja-domena.pl"
                />
              </Field>
            )}

            {showTexts && (
              <>
                <FieldWithAi
                  label={type === "VIDEO" ? "Nagłówek / headline (1+)" : "Nagłówki (min. 3, max 30 znaków, jeden na linię)"}
                  ai={{
                    kind: "headlines",
                    context: aiCtx,
                    existing: (google.headlines?.length ? google.headlines : [google.headline]).filter(Boolean).join("\n"),
                    maxChars: 30,
                    count: type === "VIDEO" ? 2 : 5,
                    onFilled: (_t, lines) =>
                      setGoogle({
                        headlines: lines.map((s) => s.slice(0, 30)).filter(Boolean),
                        headline: lines[0],
                      }),
                  }}
                >
                  <Area
                    value={(google.headlines?.length ? google.headlines : [google.headline]).filter(Boolean).join("\n")}
                    onChange={(v) =>
                      setGoogle({
                        headlines: v
                          .split("\n")
                          .map((s) => s.trim().slice(0, 30))
                          .filter(Boolean),
                      })
                    }
                  />
                </FieldWithAi>
                {(type === "DISPLAY" || type === "DEMAND_GEN" || type === "LOCAL" || type === "SMART") && (
                  <FieldWithAi
                    label="Długie nagłówki (max 90 znaków, jeden na linię)"
                    ai={{
                      kind: "longHeadlines",
                      context: aiCtx,
                      existing: (google.longHeadlines ?? []).join("\n"),
                      maxChars: 90,
                      count: 2,
                      onFilled: (_t, lines) =>
                        setGoogle({ longHeadlines: lines.map((s) => s.slice(0, 90)).filter(Boolean) }),
                    }}
                  >
                    <Area
                      value={(google.longHeadlines ?? []).join("\n")}
                      onChange={(v) =>
                        setGoogle({
                          longHeadlines: v
                            .split("\n")
                            .map((s) => s.trim().slice(0, 90))
                            .filter(Boolean),
                        })
                      }
                    />
                  </FieldWithAi>
                )}
                {type !== "VIDEO" && (
                  <FieldWithAi
                    label="Opisy (min. 2, max 90 znaków, jeden na linię)"
                    ai={{
                      kind: "descriptions",
                      context: aiCtx,
                      existing: (google.descriptions?.length ? google.descriptions : [google.description])
                        .filter(Boolean)
                        .join("\n"),
                      maxChars: 90,
                      count: 3,
                      onFilled: (_t, lines) =>
                        setGoogle({
                          descriptions: lines.map((s) => s.slice(0, 90)).filter(Boolean),
                          description: lines[0],
                        }),
                    }}
                  >
                    <Area
                      value={
                        (google.descriptions?.length ? google.descriptions : [google.description])
                          .filter(Boolean)
                          .join("\n")
                      }
                      onChange={(v) =>
                        setGoogle({
                          descriptions: v
                            .split("\n")
                            .map((s) => s.trim().slice(0, 90))
                            .filter(Boolean),
                        })
                      }
                    />
                  </FieldWithAi>
                )}
                {(type === "DISPLAY" || type === "DEMAND_GEN") && (
                  <FieldWithAi
                    label="Nazwa firmy (business name)"
                    ai={{
                      kind: "businessName",
                      context: aiCtx,
                      existing: google.businessName,
                      maxChars: 25,
                      onFilled: (text) => setGoogle({ businessName: text.split("\n")[0]?.slice(0, 25) || undefined }),
                    }}
                  >
                    <Text
                      value={google.businessName ?? ""}
                      onChange={(v) => setGoogle({ businessName: v.slice(0, 25) || undefined })}
                      placeholder="max 25 znaków"
                    />
                  </FieldWithAi>
                )}
              </>
            )}

            {type === "SHOPPING" && (
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground leading-relaxed">
                Shopping korzysta z feedu produktów w Merchant Center (ID:{" "}
                <strong className="text-foreground">{google.merchantCenterId || "—"}</strong>). Kreacje graficzne bierze
                Google z katalogu produktów.
              </p>
            )}

            {type === "APP" && (
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-xs text-muted-foreground leading-relaxed">
                App Campaign automatycznie dobiera kreacje. Nagłówki/opisy poniżej to sugestie assetów tekstowych.
              </p>
            )}

            {showMedia && (
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold">
                    {googleNeedsImages(type) ? "Zdjęcia (wymagane)" : "Zdjęcia / filmiki"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Biblioteka assetów albo upload z komputera. {mediaSummary}.
                  </p>
                </div>
                <CampaignMediaPicker
                  workspaceId={workspaceId}
                  provider="google"
                  allowMixedMedia
                  maxSelect={15}
                  selectedAssetIds={cr?.assetIds ?? []}
                  format={assetCount > 1 ? "carousel" : "single_image"}
                  onChange={(assetIds) =>
                    applyChange(
                      patchCreative(draft, {
                        assetIds,
                        format: assetIds.length > 1 ? "carousel" : "single_image",
                      }),
                    )
                  }
                />
              </div>
            )}

            {showYoutube && (
              <>
                <Field label="Linki YouTube (jeden na linię)">
                  <Area
                    value={(google.youtubeVideoIds ?? []).join("\n")}
                    onChange={(v) => setGoogle({ youtubeVideoIds: parseYoutubeLines(v) })}
                    placeholder={"https://www.youtube.com/watch?v=XXXX\nhttps://youtu.be/XXXX"}
                  />
                </Field>
                <p className="text-[11px] text-muted-foreground">
                  {googleNeedsYoutube(type)
                    ? "Wymagane — wklej link do filmu na YouTube."
                    : "Opcjonalnie — wklej linki YouTube (system wyciągnie ID)."}
                </p>
              </>
            )}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <SectionTitle>Podgląd kampanii</SectionTitle>
              <div className="mt-2 space-y-1 text-xs">
                <p className="font-semibold">
                  {GOOGLE_CAMPAIGN_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type}
                </p>
                <p className="font-semibold">{draft.structure.campaignName}</p>
                {showTexts && (
                  <>
                    <p className="font-semibold">
                      {google.headlines?.[0] || google.headline || preview?.headline || "Nagłówek"}
                    </p>
                    <p className="text-muted-foreground">
                      {google.descriptions?.[0] || google.description || preview?.body || "Opis"}
                    </p>
                  </>
                )}
                {showUrl && (
                  <p className="truncate text-muted-foreground">{google.finalUrl || cr?.destinationUrl || "—"}</p>
                )}
                {showMedia && <p className="text-muted-foreground">{mediaSummary}</p>}
                {(google.youtubeVideoIds?.length ?? 0) > 0 && (
                  <p className="text-muted-foreground">YouTube: {google.youtubeVideoIds!.length} film(ów)</p>
                )}
                {google.merchantCenterId && (
                  <p className="text-muted-foreground">Merchant Center: {google.merchantCenterId}</p>
                )}
                {google.appId && (
                  <p className="text-muted-foreground">
                    App: {google.appId} ({google.appStore ?? "GOOGLE_APP_STORE"})
                  </p>
                )}
              </div>
            </div>
            <AuditList issues={issues} />
            <LaunchPanel {...props} requireOwnRiskAck />
          </div>
        )}
      </div>
    </div>
  );
}
