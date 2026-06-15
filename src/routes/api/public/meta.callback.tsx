import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorReason = url.searchParams.get("error_reason");
        const errorDescription = url.searchParams.get("error_description");
        const redirectUri = `${url.origin}/api/public/meta/callback`;

        // Diagnostyka: pełny callback URL i obecność kluczowych parametrów.
        console.log("[meta callback]", {
          fullUrl: url.toString(),
          hasCode: Boolean(code),
          hasError: Boolean(error),
          error,
          errorReason,
          errorDescription,
          redirectUri,
        });

        // Meta zwróciło błąd autoryzacji (np. odmowa zgód) — pokaż konkretny komunikat.
        if (error) {
          const detail =
            errorDescription ?? errorReason ?? error ?? "Autoryzacja Meta nie powiodła się";
          return redirectBack(url.origin, { ok: false, error: detail.slice(0, 200) });
        }

        if (!code) {
          return redirectBack(url.origin, {
            ok: false,
            error: "missing_code: Meta nie zwróciło parametru code. Sprawdź redirect_uri w aplikacji Meta.",
          });
        }
        if (!state) {
          return redirectBack(url.origin, { ok: false, error: "missing_state" });
        }

        // verify state cookie
        const cookieHeader = request.headers.get("cookie") ?? "";
        const cookieState = cookieHeader
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("meta_oauth_state="))
          ?.split("=")[1];

        if (!cookieState || cookieState !== state) {
          return redirectBack(url.origin, { ok: false, error: "state_mismatch" });
        }

        const userId = state.split(".")[0];
        const appId = process.env.META_APP_ID!;
        const appSecret = process.env.META_APP_SECRET!;

        try {
          // 1. exchange code for short-lived token
          const tokenRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?` +
              new URLSearchParams({
                client_id: appId,
                client_secret: appSecret,
                redirect_uri: redirectUri,
                code,
              }),
          );
          const tokenJson = await tokenRes.json();
          if (!tokenRes.ok) throw new Error(JSON.stringify(tokenJson));

          // 2. exchange for long-lived (60d) token
          const longRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?` +
              new URLSearchParams({
                grant_type: "fb_exchange_token",
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: tokenJson.access_token,
              }),
          );
          const longJson = await longRes.json();
          if (!longRes.ok) throw new Error(JSON.stringify(longJson));
          const accessToken: string = longJson.access_token;
          const expiresIn: number = longJson.expires_in ?? 60 * 24 * 3600;

          // 3. fetch profile
          const meRes = await fetch(
            `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`,
          );
          const me = await meRes.json();

          // 4. fetch ad accounts
          const adRes = await fetch(
            `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,account_id,name,currency,account_status&access_token=${accessToken}`,
          );
          const adJson = await adRes.json();
          // Brak uprawnień / brak Advanced Access — Meta zwraca błąd zamiast listy kont.
          if (adJson.error) {
            const code = adJson.error.code;
            const msg: string = adJson.error.message ?? "";
            if (code === 200 || /permission|advanced access|app review/i.test(msg)) {
              throw new Error(
                "Brak wymaganych uprawnień do Meta Ads. Upewnij się, że zaakceptowałeś wszystkie zgody, a aplikacja ma Advanced Access (App Review) dla ads_read / ads_management.",
              );
            }
            throw new Error(`Meta Ads API: ${msg}`);
          }
          const adAccounts = adJson.data ?? [];
          // Użytkownik nie ma dostępu do żadnego konta reklamowego.
          if (adAccounts.length === 0) {
            throw new Error(
              "Twoje konto Meta nie ma dostępu do żadnego konta reklamowego (Ad Account). Dodaj konto reklamowe w Meta Business i spróbuj ponownie.",
            );
          }

          // 5. fetch pages
          const pagesRes = await fetch(
            `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`,
          );
          const pagesJson = await pagesRes.json();
          const pages = (pagesJson.data ?? []).map((p: any) => ({
            id: p.id,
            name: p.name,
          }));

          const { data: existing } = await supabaseAdmin
            .from("meta_connections")
            .select("selected_ad_account_id, selected_page_id, pixel_id")
            .eq("user_id", userId)
            .eq("meta_user_id", me.id)
            .maybeSingle();

          const pickAd =
            existing?.selected_ad_account_id &&
            adAccounts.some((a: { id?: string }) => a.id === existing.selected_ad_account_id)
              ? existing.selected_ad_account_id
              : (adAccounts[0]?.id ?? null);
          const pickPage =
            existing?.selected_page_id && pages.some((p: { id: string }) => p.id === existing.selected_page_id)
              ? existing.selected_page_id
              : (pages[0]?.id ?? null);

          // 6. upsert
          const { error: upsertErr } = await supabaseAdmin
            .from("meta_connections")
            .upsert(
              {
                user_id: userId,
                meta_user_id: me.id,
                meta_user_name: me.name,
                access_token: accessToken,
                token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
                ad_accounts: adAccounts,
                pages,
                selected_ad_account_id: pickAd,
                selected_page_id: pickPage,
                pixel_id: existing?.pixel_id ?? null,
              },
              { onConflict: "user_id,meta_user_id" },
            );
          if (upsertErr) throw upsertErr;

          return redirectBack(url.origin, { ok: true, name: me.name });
        } catch (e: any) {
          console.error("[meta callback]", e);
          return redirectBack(url.origin, { ok: false, error: String(e?.message ?? e).slice(0, 200) });
        }
      },
    },
  },
});

function redirectBack(origin: string, params: { ok: boolean; name?: string; error?: string }) {
  const qs = new URLSearchParams();
  qs.set("meta", params.ok ? "connected" : "error");
  if (params.name) qs.set("name", params.name);
  if (params.error) qs.set("error", params.error);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/integrations?${qs.toString()}`,
      "Set-Cookie": "meta_oauth_state=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
    },
  });
}
