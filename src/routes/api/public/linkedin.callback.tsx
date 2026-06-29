import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/linkedin/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDesc = url.searchParams.get("error_description");

        if (error || !code || !state) {
          return redirectBack(url.origin, { ok: false, error: errorDesc ?? error ?? "missing_code" });
        }

        const cookieHeader = request.headers.get("cookie") ?? "";
        const cookieState = cookieHeader
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("linkedin_oauth_state="))
          ?.split("=")[1];

        if (!cookieState || cookieState !== state) {
          return redirectBack(url.origin, { ok: false, error: "state_mismatch" });
        }

        const userId = state.split(".")[0];
        const clientId = process.env.LINKEDIN_CLIENT_ID!;
        const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
        const redirectUri = `${url.origin}/api/public/linkedin/callback`;

        try {
          // 1. exchange code for access token
          const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              redirect_uri: redirectUri,
              client_id: clientId,
              client_secret: clientSecret,
            }).toString(),
          });
          const tokenJson = await tokenRes.json();
          if (!tokenRes.ok) throw new Error(JSON.stringify(tokenJson));

          const accessToken: string = tokenJson.access_token;
          const expiresIn: number = tokenJson.expires_in ?? 60 * 24 * 3600;
          const refreshToken: string | null = tokenJson.refresh_token ?? null;
          const refreshExpiresIn: number | null = tokenJson.refresh_token_expires_in ?? null;
          const scope: string | null = tokenJson.scope ?? null;

          const authHeaders = {
            Authorization: `Bearer ${accessToken}`,
            "LinkedIn-Version": "202405",
            "X-Restli-Protocol-Version": "2.0.0",
          };

          // 2. fetch profile (userinfo openid-style endpoint works for basic id/name)
          let linkedinUserId = "unknown";
          let linkedinUserName: string | null = null;
          try {
            const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (meRes.ok) {
              const me = await meRes.json();
              linkedinUserId = me.sub ?? linkedinUserId;
              linkedinUserName = me.name ?? null;
            } else {
              // fallback to /v2/me
              const meRes2 = await fetch("https://api.linkedin.com/v2/me", {
                headers: authHeaders,
              });
              if (meRes2.ok) {
                const me2 = await meRes2.json();
                linkedinUserId = me2.id ?? linkedinUserId;
                const first = me2.localizedFirstName ?? "";
                const last = me2.localizedLastName ?? "";
                linkedinUserName = `${first} ${last}`.trim() || null;
              }
            }
          } catch (e) {
            console.error("[linkedin profile]", e);
          }

          // 3. fetch ad accounts (where current user has access)
          //    Primary method: adAccountUsers?q=authenticatedUser returns the
          //    sponsored-account URNs the signed-in member is attached to. This
          //    is more reliable than adAccounts?q=search, which silently returns
          //    an empty list when the app lacks full search permissions.
          let adAccounts: Array<{ id: string; name?: string; currency?: string; status?: string }> = [];
          try {
            const userRes = await fetch(
              "https://api.linkedin.com/rest/adAccountUsers?q=authenticatedUser",
              { headers: authHeaders },
            );
            if (!userRes.ok) {
              const body = await userRes.text();
              console.error("[linkedin adAccountUsers] non-ok", userRes.status, body.slice(0, 500));
            } else {
              const userJson = await userRes.json();
              // each element: { account: "urn:li:sponsoredAccount:123", role: "..." }
              const accountIds: string[] = (userJson.elements ?? [])
                .map((el: any) => {
                  const acc = String(el.account ?? "");
                  const m = acc.match(/(\d+)$/);
                  return m ? m[1] : "";
                })
                .filter(Boolean);

            // fetch details for each account (id, name, currency, status)
              adAccounts = (
                await Promise.all(
                  accountIds.map(async (id) => {
                    try {
                      const detRes = await fetch(
                        `https://api.linkedin.com/rest/adAccounts/${id}?fields=id,name,currency,status`,
                        { headers: authHeaders },
                      );
                      if (!detRes.ok) {
                        const body = await detRes.text();
                        console.error("[linkedin adAccount detail] non-ok", id, detRes.status, body.slice(0, 300));
                        return { id, name: undefined, currency: undefined, status: undefined };
                      }
                      const det = await detRes.json();
                      return {
                        id: String(det.id ?? id),
                        name: det.name,
                        currency: det.currency,
                        status: det.status,
                      };
                    } catch (e) {
                      console.error("[linkedin adAccount detail]", id, e);
                      return { id, name: undefined, currency: undefined, status: undefined };
                    }
                  }),
                )
              ).filter(Boolean);
            }
          } catch (e) {
            console.error("[linkedin ad accounts]", e);
          }

          // Fallback: legacy search finder if the primary method returned nothing
          if (adAccounts.length === 0) {
            try {
              const adRes = await fetch(
                "https://api.linkedin.com/rest/adAccounts?q=search",
                { headers: authHeaders },
              );
              if (!adRes.ok) {
                const body = await adRes.text();
                console.error("[linkedin adAccounts search] non-ok", adRes.status, body.slice(0, 500));
              } else {
                const adJson = await adRes.json();
                adAccounts = (adJson.elements ?? []).map((a: any) => ({
                  id: String(a.id),
                  name: a.name,
                  currency: a.currency,
                  status: a.status,
                }));
              }
            } catch (e) {
              console.error("[linkedin ad accounts fallback]", e);
            }
          }

          // 4. fetch organizations (company pages the member can administer)
          let organizations: Array<{ id: string; name?: string }> = [];
          try {
            const orgRes = await fetch(
              "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(id,localizedName)))",
              { headers: { Authorization: `Bearer ${accessToken}`, "X-Restli-Protocol-Version": "2.0.0" } },
            );
            if (!orgRes.ok) {
              const body = await orgRes.text();
              console.error("[linkedin orgs] non-ok", orgRes.status, body.slice(0, 500));
            } else {
              const orgJson = await orgRes.json();
              organizations = (orgJson.elements ?? [])
                .map((el: any) => {
                  const org = el["organization~"] ?? {};
                  return { id: String(org.id ?? ""), name: org.localizedName };
                })
                .filter((o: any) => o.id);
            }
          } catch (e) {
            console.error("[linkedin orgs]", e);
          }

          // 5. upsert
          const { error: upsertErr } = await supabaseAdmin
            .from("linkedin_connections")
            .upsert(
              {
                user_id: userId,
                linkedin_user_id: linkedinUserId,
                linkedin_user_name: linkedinUserName,
                access_token: accessToken,
                refresh_token: refreshToken,
                token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
                refresh_token_expires_at: refreshExpiresIn
                  ? new Date(Date.now() + refreshExpiresIn * 1000).toISOString()
                  : null,
                scope,
                ad_accounts: adAccounts,
                organizations,
                selected_ad_account_id: adAccounts[0]?.id ?? null,
                selected_organization_id: organizations[0]?.id ?? null,
              },
              { onConflict: "user_id,linkedin_user_id" },
            );
          if (upsertErr) throw upsertErr;

          return redirectBack(url.origin, { ok: true, name: linkedinUserName ?? undefined });
        } catch (e: any) {
          console.error("[linkedin callback]", e);
          return redirectBack(url.origin, { ok: false, error: String(e?.message ?? e).slice(0, 200) });
        }
      },
    },
  },
});

function redirectBack(origin: string, params: { ok: boolean; name?: string; error?: string }) {
  const qs = new URLSearchParams();
  qs.set("linkedin", params.ok ? "connected" : "error");
  if (params.name) qs.set("name", params.name);
  if (params.error) qs.set("error", params.error);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/integrations?${qs.toString()}`,
      "Set-Cookie": "linkedin_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
    },
  });
}
