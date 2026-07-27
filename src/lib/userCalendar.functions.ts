import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EventInput = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(8000).optional(),
  location: z.string().max(500).optional(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  providers: z.array(z.enum(["google", "outlook"])).min(1),
});

async function refreshGoogleToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`google_refresh: ${JSON.stringify(j)}`);
  return { accessToken: j.access_token as string, expiresIn: (j.expires_in as number) ?? 3600 };
}

async function refreshMicrosoftToken(refreshToken: string, scope: string) {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_OAUTH_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope,
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`microsoft_refresh: ${JSON.stringify(j)}`);
  return {
    accessToken: j.access_token as string,
    refreshToken: (j.refresh_token as string | undefined) ?? refreshToken,
    expiresIn: (j.expires_in as number) ?? 3600,
  };
}

export const scheduleUserCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EventInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const results: Array<{ provider: "google" | "outlook"; ok: boolean; link?: string; error?: string }> = [];

    if (data.providers.includes("google")) {
      const { data: gcal } = await supabaseAdmin
        .from("google_calendar_connections")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (!gcal) {
        results.push({ provider: "google", ok: false, error: "Brak połączenia z Google Calendar" });
      } else {
        try {
          let accessToken = gcal.access_token;
          const exp = gcal.token_expires_at ? new Date(gcal.token_expires_at).getTime() : 0;
          if (Date.now() > exp - 60_000 && gcal.refresh_token) {
            const r = await refreshGoogleToken(gcal.refresh_token);
            accessToken = r.accessToken;
            await supabaseAdmin
              .from("google_calendar_connections")
              .update({
                access_token: accessToken,
                token_expires_at: new Date(Date.now() + r.expiresIn * 1000).toISOString(),
              })
              .eq("user_id", userId);
          }
          const calId = gcal.primary_calendar_id ?? "primary";
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                summary: data.title,
                description: data.description,
                location: data.location,
                start: { dateTime: data.start },
                end: { dateTime: data.end },
              }),
            },
          );
          const j = await res.json();
          if (!res.ok) throw new Error(JSON.stringify(j));
          results.push({ provider: "google", ok: true, link: j.htmlLink });
        } catch (e: any) {
          results.push({ provider: "google", ok: false, error: String(e?.message ?? e).slice(0, 300) });
        }
      }
    }

    if (data.providers.includes("outlook")) {
      const { data: outcal } = await supabaseAdmin
        .from("outlook_calendar_connections")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (!outcal) {
        results.push({ provider: "outlook", ok: false, error: "Brak połączenia z Outlook Calendar" });
      } else {
        try {
          let accessToken = outcal.access_token;
          const exp = outcal.token_expires_at ? new Date(outcal.token_expires_at).getTime() : 0;
          if (Date.now() > exp - 60_000 && outcal.refresh_token) {
            const r = await refreshMicrosoftToken(
              outcal.refresh_token,
              outcal.scope ?? "Calendars.ReadWrite offline_access User.Read",
            );
            accessToken = r.accessToken;
            await supabaseAdmin
              .from("outlook_calendar_connections")
              .update({
                access_token: accessToken,
                refresh_token: r.refreshToken,
                token_expires_at: new Date(Date.now() + r.expiresIn * 1000).toISOString(),
              })
              .eq("user_id", userId);
          }
          const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              subject: data.title,
              body: { contentType: "HTML", content: data.description ?? "" },
              start: { dateTime: data.start, timeZone: "UTC" },
              end: { dateTime: data.end, timeZone: "UTC" },
              location: data.location ? { displayName: data.location } : undefined,
            }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(JSON.stringify(j));
          results.push({ provider: "outlook", ok: true, link: j.webLink });
        } catch (e: any) {
          results.push({ provider: "outlook", ok: false, error: String(e?.message ?? e).slice(0, 300) });
        }
      }
    }

    return { results };
  });

export const getUserCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const [google, outlook] = await Promise.all([
      supabaseAdmin
        .from("google_calendar_connections")
        .select("email, created_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("outlook_calendar_connections")
        .select("email, created_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    return {
      google: google.data ?? null,
      outlook: outlook.data ?? null,
    };
  });

export const disconnectUserCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ provider: z.enum(["google", "outlook"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const table =
      data.provider === "google"
        ? "google_calendar_connections"
        : "outlook_calendar_connections";
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });