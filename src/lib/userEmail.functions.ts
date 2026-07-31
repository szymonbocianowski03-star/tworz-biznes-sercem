import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SendInput = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(998),
  html: z.string().min(1).max(200_000),
  text: z.string().max(200_000).optional(),
  /** Wymagane — użytkownik musi świadomie zaakceptować wysyłkę na własne ryzyko. */
  acceptedAtOwnRisk: z.literal(true),
});

const GMAIL_RECONNECT_MSG =
  "Połączenie z Gmail wygasło lub zostało unieważnione (zmiana konfiguracji Google). " +
  "Wejdź w Integracje → Gmail i kliknij „Połącz ponownie”.";

async function refreshGoogleToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Brak konfiguracji Google OAuth po stronie serwera. Skontaktuj się z administratorem.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    console.error("[gmail] refresh failed", { status: res.status, body: j });
    throw new Error(GMAIL_RECONNECT_MSG);
  }
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

function buildRfc2822(from: string, to: string, subject: string, html: string) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    "",
    html,
  ];
  return lines.join("\r\n");
}

function base64Url(s: string) {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const sendUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { to, subject, html } = data;

    // Priority: Gmail → Outlook → SMTP/Resend
    const { data: gmail } = await supabaseAdmin
      .from("gmail_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (gmail) {
      if (gmail.scope && !gmail.scope.includes("gmail.send")) {
        throw new Error(
          "Połączenie Gmail nie ma zgody na wysyłkę (gmail.send). Połącz Gmail ponownie i zaznacz zgodę na wysyłanie wiadomości.",
        );
      }
      if (!gmail.refresh_token) {
        await supabaseAdmin.from("gmail_connections").delete().eq("user_id", userId);
        throw new Error(GMAIL_RECONNECT_MSG);
      }

      let accessToken = gmail.access_token;
      const exp = gmail.token_expires_at ? new Date(gmail.token_expires_at).getTime() : 0;
      // Odświeżamy z 5-minutowym zapasem — Gmail odrzuca token, który wygaśnie w trakcie żądania.
      if (Date.now() > exp - 5 * 60_000) {
        try {
          const r = await refreshGoogleToken(gmail.refresh_token);
          accessToken = r.accessToken;
          await supabaseAdmin
            .from("gmail_connections")
            .update({
              access_token: accessToken,
              token_expires_at: new Date(Date.now() + r.expiresIn * 1000).toISOString(),
            })
            .eq("user_id", userId);
        } catch (e) {
          // Refresh token unieważniony (np. po zmianie Client ID) — usuwamy martwe połączenie,
          // żeby UI pokazało „Połącz” zamiast udawać, że integracja działa.
          await supabaseAdmin.from("gmail_connections").delete().eq("user_id", userId);
          throw e instanceof Error ? e : new Error(GMAIL_RECONNECT_MSG);
        }
      }

      const raw = buildRfc2822(gmail.email, to, subject, html);
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: base64Url(raw) }),
      });
      const bodyText = await res.text();
      let j: { id?: string; error?: { message?: string; status?: string } } = {};
      try {
        j = JSON.parse(bodyText);
      } catch {
        /* Gmail zwrócił nie-JSON */
      }
      if (!res.ok) {
        console.error("[gmail] send failed", { status: res.status, body: bodyText.slice(0, 500) });
        if (res.status === 401) {
          await supabaseAdmin.from("gmail_connections").delete().eq("user_id", userId);
          throw new Error(GMAIL_RECONNECT_MSG);
        }
        if (res.status === 403) {
          throw new Error(
            "Google odmówił wysyłki (brak zgody gmail.send albo konto nie ma uprawnień). Połącz Gmail ponownie i zaznacz zgodę na wysyłanie.",
          );
        }
        throw new Error(j.error?.message ?? `Gmail: błąd wysyłki (${res.status}).`);
      }
      return { provider: "gmail" as const, messageId: (j.id ?? "") as string };
    }

    const { data: outlook } = await supabaseAdmin
      .from("outlook_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (outlook) {
      let accessToken = outlook.access_token;
      const exp = outlook.token_expires_at ? new Date(outlook.token_expires_at).getTime() : 0;
      if (Date.now() > exp - 60_000 && outlook.refresh_token) {
        const r = await refreshMicrosoftToken(
          outlook.refresh_token,
          outlook.scope ?? "Mail.Send offline_access User.Read",
        );
        accessToken = r.accessToken;
        await supabaseAdmin
          .from("outlook_connections")
          .update({
            access_token: accessToken,
            refresh_token: r.refreshToken,
            token_expires_at: new Date(Date.now() + r.expiresIn * 1000).toISOString(),
          })
          .eq("user_id", userId);
      }
      const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: "HTML", content: html },
            toRecipients: [{ emailAddress: { address: to } }],
          },
          saveToSentItems: true,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`outlook_send: ${err}`);
      }
      return { provider: "outlook" as const, messageId: null as string | null };
    }

    const { data: smtp } = await supabaseAdmin
      .from("email_smtp_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (smtp?.provider === "resend" && smtp.resend_api_key) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${smtp.resend_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: smtp.from_name
            ? `${smtp.from_name} <${smtp.from_email}>`
            : smtp.from_email,
          to: [to],
          subject,
          html,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(`resend_send: ${JSON.stringify(j)}`);
      return { provider: "resend" as const, messageId: j.id as string };
    }

    if (smtp?.provider === "smtp") {
      throw new Error(
        "Klasyczny SMTP nie jest wspierany w tym runtime. Użyj Gmaila, Outlooka albo klucza Resend.",
      );
    }

    throw new Error(
      "Brak skonfigurowanej metody wysyłki. Połącz Gmail / Outlook lub wklej klucz Resend w Integracjach.",
    );
  });

export const getUserEmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const [gmail, outlook, smtp] = await Promise.all([
      supabaseAdmin
        .from("gmail_connections")
        .select("email, created_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("outlook_connections")
        .select("email, created_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("email_smtp_connections")
        .select("provider, from_email, from_name")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    return {
      gmail: gmail.data ?? null,
      outlook: outlook.data ?? null,
      smtp: smtp.data ?? null,
    };
  });

export const disconnectUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ provider: z.enum(["gmail", "outlook", "smtp"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const table =
      data.provider === "gmail"
        ? "gmail_connections"
        : data.provider === "outlook"
          ? "outlook_connections"
          : "email_smtp_connections";
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SmtpInput = z.object({
  provider: z.enum(["smtp", "resend"]),
  from_email: z.string().email(),
  from_name: z.string().max(200).optional(),
  resend_api_key: z.string().max(500).optional(),
  smtp_host: z.string().max(255).optional(),
  smtp_port: z.number().int().min(1).max(65535).optional(),
  smtp_username: z.string().max(255).optional(),
  smtp_password: z.string().max(500).optional(),
  smtp_secure: z.boolean().optional(),
});

export const saveSmtpConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SmtpInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("email_smtp_connections")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });