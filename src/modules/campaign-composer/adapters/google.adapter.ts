import type { AdsPlatformAdapter, AdapterContext, ProviderResult, ProviderStepKind } from "./types";
import type { CampaignComposerDraftPayload } from "../domain/draft-schema";
import { normalizeDestinationUrl } from "../validation/preflight";
import { GOOGLE_ADS_API_BASE } from "@/lib/googleAdsApi";

const GOOGLE_ADS_API = GOOGLE_ADS_API_BASE;

/** Google zwraca HTML (404/502) dla wycofanych wersji API — nie parsuj tego jako JSON. */
async function readJsonSafe(res: Response): Promise<{ parsed: unknown; text: string }> {
  const text = await res.text();
  try {
    return { parsed: JSON.parse(text), text };
  } catch {
    return { parsed: null, text };
  }
}

function customerIdDigits(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

function temporaryId(n: number): string {
  return `-${n}`;
}

type MutateResponse = {
  results?: Array<{ resourceName?: string }>;
  error?: { message?: string; status?: string; details?: unknown };
  message?: string;
};

/**
 * Google Ads API zwraca ogólny komunikat „Request contains an invalid argument.”,
 * a prawdziwą przyczynę (nazwa pola, limit, powód odrzucenia) chowa w
 * error.details[].errors[].message + errorCode. Ta funkcja wyciąga czytelny opis,
 * żeby użytkownik wiedział CO dokładnie poprawić, zamiast widzieć suchy komunikat.
 */
function extractGoogleAdsError(json: MutateResponse): string | undefined {
  const err = json.error;
  if (!err) return json.message;

  const baseMessage = err.message ?? json.message;
  if (/invalid authentication credentials|expected oauth 2 access token|unauthenticated/i.test(baseMessage ?? "")) {
    return "Token Google Ads jest nieważny albo wygasł. Połącz Google Ads ponownie w Integracjach i spróbuj uruchomić kampanię jeszcze raz.";
  }

  const details = Array.isArray(err.details) ? (err.details as unknown[]) : [];
  const parts: string[] = [];
  for (const d of details) {
    const errors = (d as { errors?: unknown[] })?.errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      const item = e as {
        message?: string;
        errorCode?: Record<string, unknown>;
        trigger?: { stringValue?: string };
        location?: { fieldPathElements?: Array<{ fieldName?: string; index?: number }> };
      };
      const msg = item?.message?.trim();
      if (!msg) continue;
      const code = item.errorCode ? Object.values(item.errorCode)[0] : undefined;
      // Ścieżka pola (np. "operations[0].create.campaign.bidding_strategy") mówi DOKŁADNIE,
      // którego pola brakuje — kluczowe przy błędach REQUIRED / FIELD_ERROR.
      const fieldPath = (item.location?.fieldPathElements ?? [])
        .map((p) => p?.fieldName)
        .filter(Boolean)
        .join(".");
      const codeStr = code ? String(code) : "";
      const suffix = [codeStr, fieldPath ? `pole: ${fieldPath}` : ""].filter(Boolean).join(", ");
      parts.push(suffix ? `${msg} (${suffix})` : msg);
    }
  }

  if (parts.length) {
    // Deduplikacja + skrócenie, żeby toast/UI się nie rozjechały.
    return [...new Set(parts)].join(" • ").slice(0, 600);
  }
  return baseMessage;
}

async function googleAdsMutate(
  customerId: string,
  path: string,
  accessToken: string,
  body: unknown,
  loginCustomerId?: string,
): Promise<{ ok: boolean; json: MutateResponse; status: number }> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!developerToken) {
    return {
      ok: false,
      status: 500,
      json: { message: "Brak GOOGLE_ADS_DEVELOPER_TOKEN w konfiguracji serwera." },
    };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  const login = loginCustomerId?.replace(/[^0-9]/g, "");
  if (login) headers["login-customer-id"] = login;

  const res = await fetch(`${GOOGLE_ADS_API}/customers/${customerId}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const { parsed, text } = await readJsonSafe(res);
  if (parsed === null) {
    console.error("[google ads] odpowiedź nie-JSON", { status: res.status, body: text.slice(0, 300) });
    return {
      ok: false,
      status: res.status,
      json: {
        message: `Google Ads API zwróciło odpowiedź nie-JSON (HTTP ${res.status}). Sprawdź wersję API, dostęp do konta i developer token.`,
      },
    };
  }
  const json = parsed as MutateResponse;
  return { ok: res.ok && !json.error, json, status: res.status };
}

/** Wykrywa błąd zduplikowanej nazwy kampanii (Google zwraca go jako INVALID_ARGUMENT). */
function isDuplicateNameError(json: MutateResponse): boolean {
  const details = Array.isArray(json.error?.details) ? (json.error!.details as unknown[]) : [];
  for (const d of details) {
    const errors = (d as { errors?: unknown[] })?.errors;
    if (!Array.isArray(errors)) continue;
    for (const e of errors) {
      const item = e as { message?: string; errorCode?: Record<string, unknown> };
      const codeVal = item.errorCode ? String(Object.values(item.errorCode)[0] ?? "") : "";
      if (/DUPLICATE_NAME|DUPLICATE_CAMPAIGN_NAME/i.test(codeVal)) return true;
      if (/duplicate.*name|nazwa.*istnieje|already exists/i.test(item.message ?? "")) return true;
    }
  }
  return /duplicate.*name|already exists/i.test(json.error?.message ?? "");
}

function resourceId(resourceName: string | undefined): string | null {
  if (!resourceName) return null;
  const parts = resourceName.split("/");
  return parts[parts.length - 1] ?? null;
}

async function uploadImageAsset(
  ctx: AdapterContext,
  customerId: string,
  imageUrl: string,
  loginCustomerId?: string,
): Promise<ProviderResult> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    return { ok: false, message: `Nie udało się pobrać grafiki: ${imageUrl}`, retryable: true };
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const data = buf.toString("base64");
  const { ok, json, status } = await googleAdsMutate(
    customerId,
    "assets:mutate",
    ctx.accessToken,
    {
      operations: [
        {
          create: {
            name: `img_${Date.now()}`,
            type: "IMAGE",
            imageAsset: { data },
          },
        },
      ],
    },
    loginCustomerId,
  );
  if (!ok) {
    return {
      ok: false,
      message: extractGoogleAdsError(json) ?? "Upload obrazu do Google Ads nie powiódł się",
      code: String(status),
      retryable: status === 429 || status >= 500,
      raw: json,
    };
  }
  const rn = json.results?.[0]?.resourceName;
  const id = resourceId(rn);
  if (!id || !rn) return { ok: false, message: "Brak resourceName po uploadzie obrazu", raw: json };
  return { ok: true, externalId: rn, raw: json };
}

export class GoogleAdsAdapter implements AdsPlatformAdapter {
  readonly provider = "google" as const;

  buildLaunchPlan(draft: CampaignComposerDraftPayload) {
    const type = draft.google?.campaignType ?? "SEARCH";
    const budget = { order: 1, kind: "google_budget" as const, label: "Budżet kampanii" };
    const campaign = { order: 2, kind: "google_campaign" as const, label: `Kampania ${type}` };

    switch (type) {
      case "PERFORMANCE_MAX":
        return [
          budget,
          campaign,
          { order: 3, kind: "google_assets" as const, label: "Assety (zdjęcia / YouTube)" },
          { order: 4, kind: "google_asset_group" as const, label: "Asset group" },
        ];
      case "DISPLAY":
        return [
          budget,
          campaign,
          { order: 3, kind: "google_ad_group" as const, label: "Grupa reklam Display" },
          { order: 4, kind: "google_display_ad" as const, label: "Reklama Display (RDA)" },
        ];
      case "VIDEO":
        return [
          budget,
          campaign,
          { order: 3, kind: "google_ad_group" as const, label: "Grupa reklam Video" },
          { order: 4, kind: "google_video_ad" as const, label: "Reklama YouTube" },
        ];
      case "DEMAND_GEN":
        return [
          budget,
          campaign,
          { order: 3, kind: "google_ad_group" as const, label: "Grupa reklam Demand Gen" },
          { order: 4, kind: "google_demand_gen_ad" as const, label: "Reklama Demand Gen" },
        ];
      case "SHOPPING":
        return [
          budget,
          campaign,
          { order: 3, kind: "google_shopping_adgroup" as const, label: "Grupa produktowa Shopping" },
        ];
      case "APP":
        return [budget, campaign, { order: 3, kind: "google_app_campaign" as const, label: "Konfiguracja App" }];
      case "LOCAL":
      case "SMART":
        return [
          budget,
          campaign,
          { order: 3, kind: "google_ad_group" as const, label: "Grupa reklam" },
          { order: 4, kind: "google_display_ad" as const, label: "Kreacja (assety)" },
        ];
      case "SEARCH":
      default:
        return [
          budget,
          campaign,
          { order: 3, kind: "google_ad_group" as const, label: "Grupa reklam Search" },
          { order: 4, kind: "google_rsa" as const, label: "Reklama RSA + słowa kluczowe" },
        ];
    }
  }

  async executeStep(
    ctx: AdapterContext,
    draft: CampaignComposerDraftPayload,
    kind: ProviderStepKind,
    priorIds: Record<string, string>,
  ): Promise<ProviderResult> {
    if (ctx.dryRun) {
      return { ok: true, externalId: `dry_google_${kind}_${Date.now()}`, raw: { dryRun: true } };
    }

    const customerId = customerIdDigits(ctx.adAccountId);
    if (!customerId) {
      return { ok: false, message: "Brak Customer ID Google Ads (konto reklamowe).", retryable: false };
    }
    const loginCustomerId = draft.channel.googleLoginCustomerId;
    const g = draft.google;
    const status = ctx.publishLive ? "ENABLED" : "PAUSED";
    const dailyMinor = g?.dailyBudgetMinor ?? draft.structure.adSets[0]?.budget?.dailyBudgetMinorUnits ?? 5000;
    const finalUrl =
      normalizeDestinationUrl(g?.finalUrl) ||
      normalizeDestinationUrl(draft.structure.adSets[0]?.creatives[0]?.destinationUrl) ||
      "";

    try {
      if (kind === "google_budget") {
        const { ok, json, status: http } = await googleAdsMutate(
          customerId,
          "campaignBudgets:mutate",
          ctx.accessToken,
          {
            operations: [
              {
                create: {
                  name: `Budget ${draft.structure.campaignName}`.slice(0, 255),
                  amountMicros: Math.max(dailyMinor, 100) * 10_000,
                  deliveryMethod: "STANDARD",
                  explicitlyShared: false,
                },
              },
            ],
          },
          loginCustomerId,
        );
        if (!ok) {
          return {
            ok: false,
            message: extractGoogleAdsError(json) ?? "Nie utworzono budżetu Google Ads",
            code: String(http),
            retryable: http === 429 || http >= 500,
            raw: json,
          };
        }
        const rn = json.results?.[0]?.resourceName;
        if (!rn) return { ok: false, message: "Brak resourceName budżetu", raw: json };
        return { ok: true, externalId: rn, raw: json };
      }

      if (kind === "google_campaign") {
        const budgetRn = priorIds.google_budget;
        if (!budgetRn) return { ok: false, message: "Brak budżetu (krok poprzedni).", retryable: false };
        const campaignType = g?.campaignType ?? "SEARCH";
        const create: Record<string, unknown> = {
          name: draft.structure.campaignName,
          status,
          campaignBudget: budgetRn,
          // WYMAGANE od Google Ads API v19.2+ (dot. v25): brak tego pola => FieldError.REQUIRED
          // („The required field was not present."). Zwykłe kampanie marketingowe nie zawierają
          // reklamy politycznej w UE.
          containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
        };

        switch (campaignType) {
          case "PERFORMANCE_MAX":
            create.advertisingChannelType = "PERFORMANCE_MAX";
            create.maximizeConversions = {};
            if (finalUrl) create.urlExpansionOptOut = false;
            break;
          case "DISPLAY":
            create.advertisingChannelType = "DISPLAY";
            create.manualCpc = {};
            break;
          case "VIDEO":
            create.advertisingChannelType = "VIDEO";
            create.manualCpv = {};
            break;
          case "DEMAND_GEN":
            create.advertisingChannelType = "DEMAND_GEN";
            create.maximizeConversions = {};
            break;
          case "SHOPPING": {
            create.advertisingChannelType = "SHOPPING";
            const merchantId = g?.merchantCenterId?.replace(/[^0-9]/g, "");
            if (!merchantId) {
              return { ok: false, message: "Shopping wymaga ID Merchant Center.", retryable: false };
            }
            create.shoppingSetting = {
              merchantId,
              salesCountry: (g?.geoTargets?.[0] || "PL").slice(0, 2),
              enableLocal: true,
            };
            create.manualCpc = {};
            break;
          }
          case "APP": {
            create.advertisingChannelType = "MULTI_CHANNEL";
            create.advertisingChannelSubType = "APP_CAMPAIGN";
            if (!g?.appId?.trim()) {
              return { ok: false, message: "Kampania App wymaga ID aplikacji.", retryable: false };
            }
            create.appCampaignSetting = {
              appId: g.appId.trim(),
              appStore: g.appStore ?? "GOOGLE_APP_STORE",
              biddingStrategyGoalType: "OPTIMIZE_INSTALLS_TARGET_INSTALL_COST",
            };
            create.maximizeConversions = {};
            break;
          }
          case "LOCAL":
            create.advertisingChannelType = "LOCAL";
            create.maximizeConversions = {};
            break;
          case "SMART":
            create.advertisingChannelType = "SMART";
            create.maximizeConversions = {};
            break;
          case "SEARCH":
          default:
            create.advertisingChannelType = "SEARCH";
            create.networkSettings = {
              targetGoogleSearch: true,
              targetSearchNetwork: Boolean(g?.includeSearchPartners),
              targetContentNetwork: false,
            };
            create.manualCpc = {};
            break;
        }

        let { ok, json, status: http } = await googleAdsMutate(
          customerId,
          "campaigns:mutate",
          ctx.accessToken,
          { operations: [{ create }] },
          loginCustomerId,
        );

        // Nazwa kampanii musi być unikalna na koncie. Przy ponownej publikacji tego samego
        // szkicu Google zwraca DUPLICATE_CAMPAIGN_NAME jako INVALID_ARGUMENT ("Request contains an
        // invalid argument."). Wtedy ponawiamy raz z krótkim sufiksem, żeby kampania się utworzyła.
        if (!ok && isDuplicateNameError(json)) {
          const suffix = new Date().toLocaleString("pl-PL", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          create.name = `${String(create.name).slice(0, 240)} (${suffix})`;
          ({ ok, json, status: http } = await googleAdsMutate(
            customerId,
            "campaigns:mutate",
            ctx.accessToken,
            { operations: [{ create }] },
            loginCustomerId,
          ));
        }

        if (!ok) {
          return {
            ok: false,
            message: extractGoogleAdsError(json) ?? "Nie utworzono kampanii Google Ads",
            code: String(http),
            retryable: http === 429 || http >= 500,
            raw: json,
          };
        }
        const rn = json.results?.[0]?.resourceName;
        if (!rn) return { ok: false, message: "Brak resourceName kampanii", raw: json };
        return { ok: true, externalId: rn, raw: json };
      }

      if (kind === "google_ad_group") {
        const campaignRn = priorIds.google_campaign;
        if (!campaignRn) return { ok: false, message: "Brak kampanii Google Ads.", retryable: false };
        const campaignType = g?.campaignType ?? "SEARCH";
        const adGroupType =
          campaignType === "DISPLAY" || campaignType === "LOCAL" || campaignType === "SMART"
            ? "DISPLAY_STANDARD"
            : campaignType === "VIDEO"
              ? "VIDEO_TRUE_VIEW_IN_STREAM"
              : campaignType === "DEMAND_GEN"
                ? "DEMAND_GEN_PRODUCT"
                : "SEARCH_STANDARD";
        const createAg: Record<string, unknown> = {
          name: g?.adGroupName || draft.structure.adSets[0]?.name || "Grupa reklam 1",
          campaign: campaignRn,
          status,
          type: adGroupType,
        };
        if (campaignType === "SEARCH" || campaignType === "DISPLAY") {
          createAg.cpcBidMicros = 100_000;
        }
        const { ok, json, status: http } = await googleAdsMutate(
          customerId,
          "adGroups:mutate",
          ctx.accessToken,
          { operations: [{ create: createAg }] },
          loginCustomerId,
        );
        if (!ok) {
          return {
            ok: false,
            message: extractGoogleAdsError(json) ?? "Nie utworzono grupy reklam",
            code: String(http),
            retryable: http === 429 || http >= 500,
            raw: json,
          };
        }
        const rn = json.results?.[0]?.resourceName;
        if (!rn) return { ok: false, message: "Brak resourceName grupy reklam", raw: json };
        return { ok: true, externalId: rn, raw: json };
      }

      if (kind === "google_rsa") {
        const adGroupRn = priorIds.google_ad_group;
        if (!adGroupRn) return { ok: false, message: "Brak grupy reklam.", retryable: false };
        if (!finalUrl) return { ok: false, message: "Brak final URL (adres docelowy).", retryable: false };

        const headlines = (g?.headlines?.length ? g.headlines : [g?.headline || "Oferta", "Sprawdź szczegóły", "Dowiedz się więcej"])
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 15);
        const descriptions = (g?.descriptions?.length ? g.descriptions : [g?.description || "Sprawdź naszą ofertę."])
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 4);

        while (headlines.length < 3) headlines.push(`Nagłówek ${headlines.length + 1}`);
        while (descriptions.length < 2) descriptions.push("Opis oferty.");

        const keywords = (g?.keywords ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 20);
        if (keywords.length) {
          const kwOps = keywords.map((text) => ({
            create: {
              adGroup: adGroupRn,
              status: "ENABLED",
              keyword: { text, matchType: "BROAD" },
            },
          }));
          const kwRes = await googleAdsMutate(
            customerId,
            "adGroupCriteria:mutate",
            ctx.accessToken,
            { operations: kwOps },
            loginCustomerId,
          );
          if (!kwRes.ok) {
            console.warn("[google ads] keywords", kwRes.json);
          }
        }

        const { ok, json, status: http } = await googleAdsMutate(
          customerId,
          "adGroupAds:mutate",
          ctx.accessToken,
          {
            operations: [
              {
                create: {
                  adGroup: adGroupRn,
                  status,
                  ad: {
                    finalUrls: [finalUrl],
                    responsiveSearchAd: {
                      headlines: headlines.map((text) => ({ text: text.slice(0, 30) })),
                      descriptions: descriptions.map((text) => ({ text: text.slice(0, 90) })),
                    },
                  },
                },
              },
            ],
          },
          loginCustomerId,
        );
        if (!ok) {
          return {
            ok: false,
            message: extractGoogleAdsError(json) ?? "Nie utworzono reklamy RSA",
            code: String(http),
            retryable: http === 429 || http >= 500,
            raw: json,
          };
        }
        const rn = json.results?.[0]?.resourceName;
        if (!rn) return { ok: false, message: "Brak resourceName RSA", raw: json };
        return { ok: true, externalId: rn, raw: json };
      }

      if (kind === "google_assets") {
        const creative = draft.structure.adSets[0]?.creatives[0];
        const assetIds = creative?.assetIds ?? [];
        const imageRns: string[] = [];
        const youtubeRns: string[] = [];
        let skippedLocalVideos = 0;

        for (const id of assetIds.slice(0, 20)) {
          const asset = ctx.resolvedAssets?.[id];
          if (!asset?.publicUrl) continue;
          const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(asset.publicUrl) || asset.source.includes("video");
          if (isVideo) {
            skippedLocalVideos++;
            continue;
          }
          const r = await uploadImageAsset(ctx, customerId, asset.publicUrl, loginCustomerId);
          if (!r.ok) return r;
          imageRns.push(r.externalId);
        }

        for (const ytId of (g?.youtubeVideoIds ?? []).slice(0, 5)) {
          const { ok, json, status: http } = await googleAdsMutate(
            customerId,
            "assets:mutate",
            ctx.accessToken,
            {
              operations: [
                {
                  create: {
                    name: `yt_${ytId}`.slice(0, 100),
                    type: "YOUTUBE_VIDEO",
                    youtubeVideoAsset: { youtubeVideoId: ytId },
                  },
                },
              ],
            },
            loginCustomerId,
          );
          if (!ok) {
            return {
              ok: false,
              message: extractGoogleAdsError(json) ?? `Nie dodano YouTube ${ytId}`,
              code: String(http),
              retryable: http === 429 || http >= 500,
              raw: json,
            };
          }
          const rn = json.results?.[0]?.resourceName;
          if (rn) youtubeRns.push(rn);
        }

        if (!imageRns.length && (g?.campaignType ?? "SEARCH") === "PERFORMANCE_MAX") {
          return {
            ok: false,
            message:
              skippedLocalVideos > 0
                ? "Performance Max wymaga zdjęć. Lokalne MP4 nie publikują się bezpośrednio — dodaj JPG/PNG lub ID YouTube."
                : "Performance Max wymaga co najmniej jednego zdjęcia — dodaj grafikę (z assetów lub z dysku).",
            retryable: false,
          };
        }

        const packed = [...imageRns.map((r) => `img:${r}`), ...youtubeRns.map((r) => `yt:${r}`)].join("|");
        return {
          ok: true,
          externalId: packed || `text_only_${Date.now()}`,
          raw: { imageAssetResourceNames: imageRns, youtubeAssetResourceNames: youtubeRns, skippedLocalVideos },
        };
      }

      if (kind === "google_asset_group") {
        const campaignRn = priorIds.google_campaign;
        const packed = priorIds.google_assets || "";
        const imageRns = packed
          .split("|")
          .filter((s) => s.startsWith("img:"))
          .map((s) => s.slice(4))
          .filter((s) => s.startsWith("customers/"));
        const youtubeRns = packed
          .split("|")
          .filter((s) => s.startsWith("yt:"))
          .map((s) => s.slice(3))
          .filter((s) => s.startsWith("customers/"));
        // kompatybilność ze starym formatem (same resource names)
        if (!imageRns.length && packed.includes("customers/") && !packed.includes("|") && !packed.includes(":")) {
          imageRns.push(
            ...packed
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.startsWith("customers/")),
          );
        }
        if (!campaignRn) return { ok: false, message: "Brak kampanii Performance Max.", retryable: false };
        if (!finalUrl) return { ok: false, message: "Brak final URL.", retryable: false };
        if (!imageRns.length) {
          return { ok: false, message: "Brak wgranych assetów obrazów.", retryable: false };
        }

        const headlines = (g?.headlines?.length ? g.headlines : [g?.headline || "Oferta", "Sprawdź teraz", "Zamów online"])
          .map((t) => t.trim().slice(0, 30))
          .filter(Boolean);
        const descriptions = (g?.descriptions?.length ? g.descriptions : [g?.description || "Sprawdź ofertę."])
          .map((t) => t.trim().slice(0, 90))
          .filter(Boolean);
        while (headlines.length < 3) headlines.push(`Nagłówek ${headlines.length + 1}`);
        while (descriptions.length < 2) descriptions.push("Opis oferty.");

        const assetGroupTemp = temporaryId(1);
        const operations: unknown[] = [
          {
            assetGroupOperation: {
              create: {
                resourceName: `customers/${customerId}/assetGroups/${assetGroupTemp}`,
                name: g?.adGroupName || "Asset group 1",
                campaign: campaignRn,
                status,
                finalUrls: [finalUrl],
              },
            },
          },
        ];

        let tempAsset = 2;
        for (const text of headlines.slice(0, 5)) {
          const rn = `customers/${customerId}/assets/${temporaryId(tempAsset++)}`;
          operations.push({
            assetOperation: {
              create: {
                resourceName: rn,
                name: `headline_${text}`.slice(0, 100),
                type: "TEXT",
                textAsset: { text },
              },
            },
          });
          operations.push({
            assetGroupAssetOperation: {
              create: {
                assetGroup: `customers/${customerId}/assetGroups/${assetGroupTemp}`,
                asset: rn,
                fieldType: "HEADLINE",
              },
            },
          });
        }
        for (const text of descriptions.slice(0, 5)) {
          const rn = `customers/${customerId}/assets/${temporaryId(tempAsset++)}`;
          operations.push({
            assetOperation: {
              create: {
                resourceName: rn,
                name: `desc_${text}`.slice(0, 100),
                type: "TEXT",
                textAsset: { text },
              },
            },
          });
          operations.push({
            assetGroupAssetOperation: {
              create: {
                assetGroup: `customers/${customerId}/assetGroups/${assetGroupTemp}`,
                asset: rn,
                fieldType: "DESCRIPTION",
              },
            },
          });
        }
        for (const [idx, imgRn] of imageRns.slice(0, 15).entries()) {
          operations.push({
            assetGroupAssetOperation: {
              create: {
                assetGroup: `customers/${customerId}/assetGroups/${assetGroupTemp}`,
                asset: imgRn,
                fieldType: idx === 0 ? "MARKETING_IMAGE" : idx % 2 === 0 ? "MARKETING_IMAGE" : "SQUARE_MARKETING_IMAGE",
              },
            },
          });
        }
        for (const ytRn of youtubeRns.slice(0, 5)) {
          operations.push({
            assetGroupAssetOperation: {
              create: {
                assetGroup: `customers/${customerId}/assetGroups/${assetGroupTemp}`,
                asset: ytRn,
                fieldType: "YOUTUBE_VIDEO",
              },
            },
          });
        }

        const { ok, json, status: http } = await googleAdsMutate(
          customerId,
          "googleAds:mutate",
          ctx.accessToken,
          { mutateOperations: operations },
          loginCustomerId,
        );
        if (!ok) {
          return {
            ok: false,
            message: extractGoogleAdsError(json) ?? "Nie utworzono asset group (PMax)",
            code: String(http),
            retryable: http === 429 || http >= 500,
            raw: json,
          };
        }
        const rn =
          json.results?.find((r) => r.resourceName?.includes("/assetGroups/"))?.resourceName ??
          json.results?.[0]?.resourceName;
        if (!rn) return { ok: false, message: "Brak resourceName asset group", raw: json };
        return { ok: true, externalId: rn, raw: json };
      }

      if (kind === "google_display_ad") {
        const adGroupRn = priorIds.google_ad_group;
        if (!adGroupRn) return { ok: false, message: "Brak grupy reklam Display.", retryable: false };
        if (!finalUrl) return { ok: false, message: "Brak final URL.", retryable: false };

        const headlines = (g?.headlines?.length ? g.headlines : ["Oferta", "Sprawdź teraz", "Zamów"]).map((t) =>
          t.trim().slice(0, 30),
        );
        const longHeadlines = (g?.longHeadlines?.length ? g.longHeadlines : [headlines[0] || "Oferta specjalna"]).map(
          (t) => t.trim().slice(0, 90),
        );
        const descriptions = (g?.descriptions?.length ? g.descriptions : ["Sprawdź naszą ofertę."]).map((t) =>
          t.trim().slice(0, 90),
        );
        while (headlines.length < 1) headlines.push("Oferta");
        while (longHeadlines.length < 1) longHeadlines.push("Oferta specjalna");
        while (descriptions.length < 1) descriptions.push("Sprawdź ofertę.");

        // Upload first image if present
        let marketingImageRn: string | undefined;
        const firstAssetId = draft.structure.adSets[0]?.creatives[0]?.assetIds?.[0];
        if (firstAssetId && ctx.resolvedAssets?.[firstAssetId]?.publicUrl) {
          const up = await uploadImageAsset(ctx, customerId, ctx.resolvedAssets[firstAssetId].publicUrl, loginCustomerId);
          if (up.ok) marketingImageRn = up.externalId;
        }

        const rda: Record<string, unknown> = {
          headlines: headlines.slice(0, 5).map((text) => ({ text })),
          longHeadline: { text: longHeadlines[0] },
          descriptions: descriptions.slice(0, 5).map((text) => ({ text })),
          businessName: g?.businessName || draft.structure.campaignName.slice(0, 25),
        };
        if (marketingImageRn) {
          rda.marketingImages = [{ asset: marketingImageRn }];
          rda.squareMarketingImages = [{ asset: marketingImageRn }];
        }

        const { ok, json, status: http } = await googleAdsMutate(
          customerId,
          "adGroupAds:mutate",
          ctx.accessToken,
          {
            operations: [
              {
                create: {
                  adGroup: adGroupRn,
                  status,
                  ad: {
                    finalUrls: [finalUrl],
                    responsiveDisplayAd: rda,
                  },
                },
              },
            ],
          },
          loginCustomerId,
        );
        if (!ok) {
          return {
            ok: false,
            message: extractGoogleAdsError(json) ?? "Nie utworzono reklamy Display",
            code: String(http),
            retryable: http === 429 || http >= 500,
            raw: json,
          };
        }
        const rn = json.results?.[0]?.resourceName;
        if (!rn) return { ok: false, message: "Brak resourceName Display ad", raw: json };
        return { ok: true, externalId: rn, raw: json };
      }

      if (kind === "google_video_ad") {
        const adGroupRn = priorIds.google_ad_group;
        if (!adGroupRn) return { ok: false, message: "Brak grupy reklam Video.", retryable: false };
        const ytId = g?.youtubeVideoIds?.[0];
        if (!ytId) return { ok: false, message: "Kampania Video wymaga linku YouTube.", retryable: false };
        if (!finalUrl) return { ok: false, message: "Brak final URL.", retryable: false };

        const ytAsset = await googleAdsMutate(
          customerId,
          "assets:mutate",
          ctx.accessToken,
          {
            operations: [
              {
                create: {
                  name: `yt_${ytId}`.slice(0, 100),
                  type: "YOUTUBE_VIDEO",
                  youtubeVideoAsset: { youtubeVideoId: ytId },
                },
              },
            ],
          },
          loginCustomerId,
        );
        if (!ytAsset.ok) {
          return {
            ok: false,
            message: extractGoogleAdsError(ytAsset.json) ?? "Nie utworzono assetu YouTube",
            retryable: ytAsset.status >= 500,
            raw: ytAsset.json,
          };
        }
        const ytRn = ytAsset.json.results?.[0]?.resourceName;
        if (!ytRn) return { ok: false, message: "Brak resourceName YouTube asset", raw: ytAsset.json };

        const { ok, json, status: http } = await googleAdsMutate(
          customerId,
          "adGroupAds:mutate",
          ctx.accessToken,
          {
            operations: [
              {
                create: {
                  adGroup: adGroupRn,
                  status,
                  ad: {
                    finalUrls: [finalUrl],
                    videoAd: {
                      video: { asset: ytRn },
                      inStream: {
                        actionButtonLabel: "Dowiedz się więcej",
                        actionHeadline: (g?.headlines?.[0] || g?.headline || "Sprawdź ofertę").slice(0, 15),
                      },
                    },
                  },
                },
              },
            ],
          },
          loginCustomerId,
        );
        if (!ok) {
          return {
            ok: false,
            message: extractGoogleAdsError(json) ?? "Nie utworzono reklamy Video",
            code: String(http),
            retryable: http === 429 || http >= 500,
            raw: json,
          };
        }
        const rn = json.results?.[0]?.resourceName;
        if (!rn) return { ok: false, message: "Brak resourceName Video ad", raw: json };
        return { ok: true, externalId: rn, raw: json };
      }

      if (kind === "google_demand_gen_ad") {
        // Demand Gen: utwórz assety + prostą reklamę multi-asset (best-effort API shape)
        const adGroupRn = priorIds.google_ad_group;
        if (!adGroupRn) return { ok: false, message: "Brak grupy reklam Demand Gen.", retryable: false };
        if (!finalUrl) return { ok: false, message: "Brak final URL.", retryable: false };

        const imageRns: string[] = [];
        for (const id of (draft.structure.adSets[0]?.creatives[0]?.assetIds ?? []).slice(0, 5)) {
          const asset = ctx.resolvedAssets?.[id];
          if (!asset?.publicUrl || /\.(mp4|webm|mov)(\?|$)/i.test(asset.publicUrl)) continue;
          const up = await uploadImageAsset(ctx, customerId, asset.publicUrl, loginCustomerId);
          if (up.ok) imageRns.push(up.externalId);
        }
        if (!imageRns.length && !(g?.youtubeVideoIds?.length)) {
          return {
            ok: false,
            message: "Demand Gen wymaga zdjęcia lub linku YouTube.",
            retryable: false,
          };
        }

        const headlines = (g?.headlines?.length ? g.headlines : ["Oferta", "Sprawdź", "Zamów"]).map((t) =>
          t.trim().slice(0, 40),
        );
        const descriptions = (g?.descriptions?.length ? g.descriptions : ["Sprawdź ofertę."]).map((t) =>
          t.trim().slice(0, 90),
        );

        const { ok, json, status: http } = await googleAdsMutate(
          customerId,
          "adGroupAds:mutate",
          ctx.accessToken,
          {
            operations: [
              {
                create: {
                  adGroup: adGroupRn,
                  status,
                  ad: {
                    finalUrls: [finalUrl],
                    demandGenMultiAssetAd: {
                      headlines: headlines.slice(0, 5).map((text) => ({ text })),
                      descriptions: descriptions.slice(0, 5).map((text) => ({ text })),
                      businessName: g?.businessName || draft.structure.campaignName.slice(0, 25),
                      marketingImages: imageRns.slice(0, 5).map((asset) => ({ asset })),
                      squareMarketingImages: imageRns.slice(0, 5).map((asset) => ({ asset })),
                    },
                  },
                },
              },
            ],
          },
          loginCustomerId,
        );
        if (!ok) {
          return {
            ok: false,
            message: extractGoogleAdsError(json) ?? "Nie utworzono reklamy Demand Gen",
            code: String(http),
            retryable: http === 429 || http >= 500,
            raw: json,
          };
        }
        const rn = json.results?.[0]?.resourceName;
        if (!rn) return { ok: false, message: "Brak resourceName Demand Gen", raw: json };
        return { ok: true, externalId: rn, raw: json };
      }

      if (kind === "google_shopping_adgroup") {
        const campaignRn = priorIds.google_campaign;
        if (!campaignRn) return { ok: false, message: "Brak kampanii Shopping.", retryable: false };
        const { ok, json, status: http } = await googleAdsMutate(
          customerId,
          "adGroups:mutate",
          ctx.accessToken,
          {
            operations: [
              {
                create: {
                  name: g?.adGroupName || "Grupa produktowa",
                  campaign: campaignRn,
                  status,
                  type: "SHOPPING_PRODUCT_ADS",
                  cpcBidMicros: 100_000,
                },
              },
            ],
          },
          loginCustomerId,
        );
        if (!ok) {
          return {
            ok: false,
            message: extractGoogleAdsError(json) ?? "Nie utworzono grupy Shopping",
            code: String(http),
            retryable: http === 429 || http >= 500,
            raw: json,
          };
        }
        const rn = json.results?.[0]?.resourceName;
        if (!rn) return { ok: false, message: "Brak resourceName grupy Shopping", raw: json };
        // Product partition „wszystkie produkty” — best effort
        await googleAdsMutate(
          customerId,
          "adGroupCriteria:mutate",
          ctx.accessToken,
          {
            operations: [
              {
                create: {
                  adGroup: rn,
                  status: "ENABLED",
                  listingGroup: { type: "UNIT" },
                  cpcBidMicros: 100_000,
                },
              },
            ],
          },
          loginCustomerId,
        ).catch(() => null);
        return { ok: true, externalId: rn, raw: json };
      }

      if (kind === "google_app_campaign") {
        // App campaigns są prawie w pełni skonfigurowane na poziomie kampanii.
        const campaignRn = priorIds.google_campaign;
        if (!campaignRn) return { ok: false, message: "Brak kampanii App.", retryable: false };
        return {
          ok: true,
          externalId: campaignRn,
          raw: {
            note: "Kampania App utworzona. Assety tekstowe/obrazy możesz dopiąć w Google Ads UI.",
            headlines: g?.headlines,
            descriptions: g?.descriptions,
          },
        };
      }

      return { ok: false, message: `Nieznany krok Google Ads: ${kind}`, retryable: false };
    } catch (e: unknown) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
        retryable: true,
      };
    }
  }
}

export const googleAdsAdapter = new GoogleAdsAdapter();
