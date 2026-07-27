import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignComposerDraftPayload } from "./domain/draft-schema";

type IntegrationDefaults = {
  metaPageId?: string;
  adAccountId?: string;
  metaPixelId?: string;
  linkedinOrganizationUrn?: string;
  tiktokConnectionId?: string;
  googleConnectionId?: string;
  googleLoginCustomerId?: string;
};

/** Uzupełnia szkic wartościami wybranymi w Integracjach (Page, konto reklamowe). */
export async function loadIntegrationDefaults(
  supabase: SupabaseClient,
  userId: string,
  payload: CampaignComposerDraftPayload,
): Promise<IntegrationDefaults> {
  const out: IntegrationDefaults = {};
  if (payload.channel.provider === "meta") {
    const q = supabase
      .from("meta_connections")
      .select("selected_page_id,selected_ad_account_id,pixel_id,pages,ad_accounts")
      .eq("user_id", userId);
    const { data } = await (payload.channel.metaConnectionId ? q.eq("id", payload.channel.metaConnectionId) : q).maybeSingle();
    if (!data) return out;
    const pages = Array.isArray(data.pages) ? (data.pages as { id?: string }[]) : [];
    const accounts = Array.isArray(data.ad_accounts) ? (data.ad_accounts as { id?: string; account_id?: string }[]) : [];
    out.metaPageId = data.selected_page_id ?? pages.find((p) => p.id)?.id;
    out.adAccountId = data.selected_ad_account_id ?? accounts.find((a) => a.id ?? a.account_id)?.id ?? accounts.find((a) => a.account_id)?.account_id;
    if (data.pixel_id) out.metaPixelId = String(data.pixel_id);
  } else if (payload.channel.provider === "linkedin") {
    const { data } = await supabase
      .from("linkedin_connections")
      .select("selected_ad_account_id,ad_accounts,organizations")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return out;
    const accounts = Array.isArray(data.ad_accounts) ? (data.ad_accounts as { id?: string; account_id?: string }[]) : [];
    out.adAccountId = data.selected_ad_account_id ?? accounts.find((a) => a.id ?? a.account_id)?.id;
    const orgs = Array.isArray(data.organizations) ? (data.organizations as { urn?: string }[]) : [];
    out.linkedinOrganizationUrn = orgs.find((o) => o.urn)?.urn;
  } else if (payload.channel.provider === "tiktok") {
    const q = supabase
      .from("tiktok_connections")
      .select("id,selected_advertiser_id,tiktok_advertiser_id,advertiser_accounts")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1);
    const { data } = await (payload.channel.tiktokConnectionId ? q.eq("id", payload.channel.tiktokConnectionId) : q).maybeSingle();
    if (!data) return out;
    out.tiktokConnectionId = data.id;
    const accounts = Array.isArray(data.advertiser_accounts) ? (data.advertiser_accounts as { advertiser_id?: string; id?: string }[]) : [];
    out.adAccountId =
      data.selected_advertiser_id ??
      data.tiktok_advertiser_id ??
      accounts.find((a) => a.advertiser_id ?? a.id)?.advertiser_id ??
      accounts.find((a) => a.id)?.id;
  } else if (payload.channel.provider === "google") {
    const q = (supabase as any)
      .from("google_ads_connections")
      .select("id,selected_customer_id,login_customer_id,customer_accounts")
      .eq("user_id", userId)
      .limit(1);
    const { data } = await (payload.channel.googleConnectionId ? q.eq("id", payload.channel.googleConnectionId) : q).maybeSingle();
    if (!data) return out;
    out.googleConnectionId = data.id;
    out.googleLoginCustomerId = data.login_customer_id ?? undefined;
    const accounts = Array.isArray(data.customer_accounts) ? (data.customer_accounts as { id?: string }[]) : [];
    out.adAccountId = data.selected_customer_id ?? accounts.find((a) => a.id)?.id;
  }
  return out;
}

export function mergeIntegrationDefaults(
  payload: CampaignComposerDraftPayload,
  defaults: IntegrationDefaults,
): CampaignComposerDraftPayload {
  const channel = { ...payload.channel };
  let changed = false;
  if (!channel.metaPageId && defaults.metaPageId) {
    channel.metaPageId = defaults.metaPageId;
    changed = true;
  }
  if (!channel.adAccountId && defaults.adAccountId) {
    channel.adAccountId = defaults.adAccountId;
    changed = true;
  }
  if (!channel.metaPixelId && defaults.metaPixelId) {
    channel.metaPixelId = defaults.metaPixelId;
    changed = true;
  }
  if (!channel.linkedinOrganizationUrn && defaults.linkedinOrganizationUrn) {
    channel.linkedinOrganizationUrn = defaults.linkedinOrganizationUrn;
    changed = true;
  }
  if (!channel.tiktokConnectionId && defaults.tiktokConnectionId) {
    channel.tiktokConnectionId = defaults.tiktokConnectionId;
    changed = true;
  }
  if (!channel.googleConnectionId && defaults.googleConnectionId) {
    channel.googleConnectionId = defaults.googleConnectionId;
    changed = true;
  }
  if (!channel.googleLoginCustomerId && defaults.googleLoginCustomerId) {
    channel.googleLoginCustomerId = defaults.googleLoginCustomerId;
    changed = true;
  }
  return changed ? { ...payload, channel } : payload;
}

export function preflightContext(payload: CampaignComposerDraftPayload) {
  return {
    hasMetaPixelWhenRequired:
      payload.meta?.objective === "OUTCOME_SALES" ? Boolean(payload.channel.metaPixelId) : true,
    hasLinkedInOrg: Boolean(payload.channel.linkedinOrganizationUrn),
  };
}
