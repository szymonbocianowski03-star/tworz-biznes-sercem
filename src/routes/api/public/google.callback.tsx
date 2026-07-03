import { createFileRoute } from "@tanstack/react-router";
import { handleGoogleIntegrationOAuthCallback } from "@/lib/googleIntegrationOAuth.server";
import { getGoogleLegacyIntegrationOAuthRedirectUri } from "@/lib/googleOAuthRedirect.server";

/** Legacy callback — zachowany dla kont z osobnym URI w Google Cloud. */
export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const redirectUri = getGoogleLegacyIntegrationOAuthRedirectUri(request);
        return handleGoogleIntegrationOAuthCallback(request, redirectUri);
      },
    },
  },
});
