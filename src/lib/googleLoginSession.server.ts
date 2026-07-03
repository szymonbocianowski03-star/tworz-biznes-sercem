import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Session } from "@supabase/supabase-js";

export type GoogleProfile = {
  email: string;
  fullName?: string;
  avatarUrl?: string;
  googleSub?: string;
};

/** Tworzy lub odnajduje użytkownika po emailu Google i zwraca sesję Supabase. */
export async function createSupabaseSessionForGoogleUser(
  profile: GoogleProfile,
): Promise<Session> {
  const email = profile.email.trim().toLowerCase();
  if (!email) throw new Error("Google nie zwróciło adresu email.");

  const userMetadata: Record<string, string> = {};
  if (profile.fullName) userMetadata.full_name = profile.fullName;
  if (profile.avatarUrl) userMetadata.avatar_url = profile.avatarUrl;
  if (profile.googleSub) userMetadata.google_sub = profile.googleSub;

  const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (createErr) {
    const msg = createErr.message.toLowerCase();
    const alreadyExists =
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists") ||
      createErr.status === 422;
    if (!alreadyExists) throw createErr;
  }

  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;

  const tokenHash = linkData?.properties?.hashed_token;
  if (!tokenHash) throw new Error("Nie udało się wygenerować sesji logowania.");

  const { data: verifyData, error: verifyErr } = await supabaseAdmin.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (verifyErr) throw verifyErr;
  if (!verifyData.session) throw new Error("Brak sesji po weryfikacji logowania Google.");

  return verifyData.session;
}

/** Przekierowanie na stronę auth z tokenami w hash (detectSessionInUrl w kliencie Supabase). */
export function buildAuthSessionRedirect(origin: string, redirectPath: string, session: Session): string {
  const safePath = redirectPath.startsWith("/") ? redirectPath : "/auth";
  const hash = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token ?? "",
    expires_in: String(session.expires_in ?? 3600),
    token_type: "bearer",
    type: "magiclink",
  });
  return `${origin}${safePath}#${hash.toString()}`;
}
