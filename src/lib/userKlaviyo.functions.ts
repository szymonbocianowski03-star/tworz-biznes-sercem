import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const KLAVIYO_REVISION = "2024-10-15";

function klaviyoHeaders(key: string) {
  return {
    Authorization: `Klaviyo-API-Key ${key}`,
    revision: KLAVIYO_REVISION,
    "Content-Type": "application/json",
    accept: "application/json",
  };
}

async function loadConnection(userId: string) {
  const { data } = await (supabaseAdmin as any)
    .from("klaviyo_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data as
    | {
        private_api_key: string;
        from_email: string | null;
        default_list_id: string | null;
      }
    | null;
}

/** Status połączenia — bez ujawniania klucza API klientowi. */
export const getUserKlaviyoStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (supabaseAdmin as any)
      .from("klaviyo_connections")
      .select("from_email, default_list_id, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return (data as { from_email: string | null; default_list_id: string | null; created_at: string } | null) ?? null;
  });

const SaveInput = z.object({
  private_api_key: z.string().min(10).max(200),
  from_email: z.string().email().optional().or(z.literal("")),
  default_list_id: z.string().max(50).optional().or(z.literal("")),
});

export const saveKlaviyoConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const key = data.private_api_key.trim();
    if (!key.startsWith("pk_")) {
      throw new Error(
        "To nie wygląda na Private API Key Klaviyo. Skopiuj klucz z Klaviyo → Settings → API Keys → Private API Keys (zaczyna się od „pk_”).",
      );
    }

    // Weryfikacja klucza przez lekki, bezpieczny odczyt kont.
    const res = await fetch("https://a.klaviyo.com/api/accounts/", {
      headers: klaviyoHeaders(key),
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error("Klucz Klaviyo został odrzucony (401/403). Sprawdź, czy to Private API Key z odpowiednimi uprawnieniami.");
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Klaviyo odrzuciło weryfikację [${res.status}]: ${body}`);
    }

    const { error } = await (supabaseAdmin as any).from("klaviyo_connections").upsert(
      {
        user_id: context.userId,
        private_api_key: key,
        from_email: data.from_email ? data.from_email.trim() : null,
        default_list_id: data.default_list_id ? data.default_list_id.trim() : null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectUserKlaviyo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await (supabaseAdmin as any)
      .from("klaviyo_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SubscribeInput = z.object({
  email: z.string().email(),
  first_name: z.string().max(200).optional(),
  last_name: z.string().max(200).optional(),
  list_id: z.string().max(50).optional(),
});

/** Dodaje/aktualizuje kontakt w Klaviyo i (jeśli podano listę) zapisuje na newsletter. */
export const subscribeToKlaviyo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SubscribeInput.parse(input))
  .handler(async ({ data, context }) => {
    const conn = await loadConnection(context.userId);
    if (!conn) throw new Error("Brak połączenia Klaviyo. Najpierw zapisz Private API Key w Integracjach.");
    const key = conn.private_api_key;
    const listId = data.list_id || conn.default_list_id || undefined;

    const attributes: Record<string, unknown> = { email: data.email };
    if (data.first_name) attributes.first_name = data.first_name;
    if (data.last_name) attributes.last_name = data.last_name;

    // 1) Utwórz/uaktualnij profil.
    const upsertRes = await fetch("https://a.klaviyo.com/api/profile-import/", {
      method: "POST",
      headers: klaviyoHeaders(key),
      body: JSON.stringify({ data: { type: "profile", attributes } }),
    });
    if (!upsertRes.ok && upsertRes.status !== 409) {
      const body = await upsertRes.text();
      throw new Error(`Klaviyo profil [${upsertRes.status}]: ${body}`);
    }

    // 2) Jeśli mamy listę — zapisz na newsletter z marketingowym opt-in.
    if (listId) {
      const subRes = await fetch("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/", {
        method: "POST",
        headers: klaviyoHeaders(key),
        body: JSON.stringify({
          data: {
            type: "profile-subscription-bulk-create-job",
            attributes: {
              profiles: {
                data: [
                  {
                    type: "profile",
                    attributes: {
                      email: data.email,
                      subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } },
                    },
                  },
                ],
              },
            },
            relationships: { list: { data: { type: "list", id: listId } } },
          },
        }),
      });
      if (!subRes.ok) {
        const body = await subRes.text();
        throw new Error(`Klaviyo subskrypcja [${subRes.status}]: ${body}`);
      }
    }

    return { ok: true, subscribed: Boolean(listId) };
  });

const EventInput = z.object({
  email: z.string().email(),
  metric: z.string().min(1).max(200),
  properties: z.record(z.string(), z.unknown()).optional(),
});

/** Wysyła zdarzenie do Klaviyo (uruchamia flow/automation skonfigurowany po stronie Klaviyo). */
export const trackKlaviyoEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EventInput.parse(input))
  .handler(async ({ data, context }) => {
    const conn = await loadConnection(context.userId);
    if (!conn) throw new Error("Brak połączenia Klaviyo. Najpierw zapisz Private API Key w Integracjach.");

    const res = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: klaviyoHeaders(conn.private_api_key),
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            properties: data.properties ?? {},
            metric: { data: { type: "metric", attributes: { name: data.metric } } },
            profile: { data: { type: "profile", attributes: { email: data.email } } },
          },
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Klaviyo event [${res.status}]: ${body}`);
    }
    return { ok: true };
  });
