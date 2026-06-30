import { createFileRoute } from "@tanstack/react-router";
import {
  isLocalGoogleAuthConfigured,
  isSupabaseGoogleProviderReady,
} from "@/lib/googleAuthEnv.server";

export const Route = createFileRoute("/api/public/auth/google/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirectTo =
          url.searchParams.get("redirect_to")?.startsWith("/") &&
          !url.searchParams.get("redirect_to")!.startsWith("//")
            ? `${url.origin}${url.searchParams.get("redirect_to")}`
            : `${url.origin}/auth`;

        const localConfigured = isLocalGoogleAuthConfigured();
        const supabaseGoogleReady = localConfigured
          ? false
          : await isSupabaseGoogleProviderReady(redirectTo);

        return Response.json({
          localConfigured,
          supabaseGoogleReady,
          /** Preferowany tryb logowania na tym hoście. */
          mode: localConfigured ? "local" : supabaseGoogleReady ? "supabase" : "none",
          missing: localConfigured
            ? []
            : [
                !process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ? "GOOGLE_OAUTH_CLIENT_ID" : null,
                !process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ? "GOOGLE_OAUTH_CLIENT_SECRET" : null,
                !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? "SUPABASE_SERVICE_ROLE_KEY" : null,
              ].filter(Boolean),
        });
      },
    },
  },
});
