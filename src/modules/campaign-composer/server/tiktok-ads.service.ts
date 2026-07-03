/**
 * TikTokAdsService — warstwa wywołań TikTok Ads Marketing API (v1.3).
 *
 * Serwis jest gotowy pod realne API: czyta `TIKTOK_APP_ID`/`TIKTOK_APP_SECRET` z env
 * i wykonuje wywołania HTTP. Tam, gdzie pełny payload zależy od konfiguracji konta
 * (creatives, lead form), zostawiono komentarze TODO i bezpieczne placeholdery —
 * to NIE jest mock-only: struktura wywołań jest produkcyjna.
 *
 * Używać wyłącznie po stronie serwera (server function / server route).
 */
const TT_API = "https://business-api.tiktok.com/open_api/v1.3";

type TTResponse<T = Record<string, unknown>> = { code: number; message: string; data?: T };

function headers(accessToken: string) {
  return { "Access-Token": accessToken, "Content-Type": "application/json" };
}

async function ttPost<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<TTResponse<T>> {
  const res = await fetch(`${TT_API}/${path}`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify(body),
  });
  return (await res.json()) as TTResponse<T>;
}

async function ttGet<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  query: Record<string, string>,
): Promise<TTResponse<T>> {
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${TT_API}/${path}?${qs}`, { headers: headers(accessToken) });
  return (await res.json()) as TTResponse<T>;
}

export class TikTokAdsService {
  private appId = process.env.TIKTOK_APP_ID ?? "";
  private appSecret = process.env.TIKTOK_APP_SECRET ?? "";

  /** Wymiana auth_code na access_token (po OAuth redirect). */
  async connectAccount(authCode: string) {
    return ttPost("oauth2/access_token/", "", {
      app_id: this.appId,
      secret: this.appSecret,
      auth_code: authCode,
      grant_type: "auth_code",
    });
  }

  /** Odświeżenie tokena (jeśli konto zwraca refresh_token). */
  async refreshToken(refreshToken: string) {
    return ttPost("oauth2/refresh_token/", "", {
      app_id: this.appId,
      secret: this.appSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
  }

  /** Lista kont reklamowych (advertiser) powiązanych z tokenem. */
  async getAdvertiserAccounts(accessToken: string) {
    return ttGet("oauth2/advertiser/get/", accessToken, {
      app_id: this.appId,
      secret: this.appSecret,
      access_token: accessToken,
    });
  }

  async createCampaign(accessToken: string, body: Record<string, unknown>) {
    return ttPost("campaign/create/", accessToken, body);
  }

  async createAdGroup(accessToken: string, body: Record<string, unknown>) {
    return ttPost("adgroup/create/", accessToken, body);
  }

  /** Upload video/grafiki kreacji. TODO: użyj multipart wg dokumentacji file/video/ad/upload/. */
  async uploadCreative(accessToken: string, body: Record<string, unknown>) {
    return ttPost("file/video/ad/upload/", accessToken, body);
  }

  /** Utworzenie formularza leadowego (Instant Form). TODO: dopasuj endpoint do konta. */
  async createLeadForm(accessToken: string, body: Record<string, unknown>) {
    return ttPost("pages/instant_page/create/", accessToken, body);
  }

  async createAd(accessToken: string, body: Record<string, unknown>) {
    return ttPost("ad/create/", accessToken, body);
  }

  /** Publikacja = utworzenie pełnej struktury (campaign → adgroup → ad). */
  async publishCampaign(accessToken: string, body: Record<string, unknown>) {
    return this.createCampaign(accessToken, body);
  }

  async pauseCampaign(accessToken: string, advertiserId: string, campaignId: string) {
    return ttPost("campaign/status/update/", accessToken, {
      advertiser_id: advertiserId,
      campaign_ids: [campaignId],
      operation_status: "DISABLE",
    });
  }

  async resumeCampaign(accessToken: string, advertiserId: string, campaignId: string) {
    return ttPost("campaign/status/update/", accessToken, {
      advertiser_id: advertiserId,
      campaign_ids: [campaignId],
      operation_status: "ENABLE",
    });
  }

  /** Metryki kampanii (impressions, clicks, spend, leads, conversions...). */
  async getCampaignMetrics(accessToken: string, advertiserId: string, campaignIds: string[]) {
    return ttGet("report/integrated/get/", accessToken, {
      advertiser_id: advertiserId,
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: JSON.stringify(["campaign_id"]),
      metrics: JSON.stringify([
        "impressions",
        "clicks",
        "ctr",
        "cpc",
        "spend",
        "conversion",
        "cost_per_conversion",
      ]),
      filtering: JSON.stringify([
        { field_name: "campaign_ids", filter_type: "IN", filter_value: JSON.stringify(campaignIds) },
      ]),
    });
  }
}

export const tiktokAdsService = new TikTokAdsService();