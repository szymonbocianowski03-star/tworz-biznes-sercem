import { createFileRoute } from "@tanstack/react-router";
import {
  getGoogleIntegrationOAuthRedirectUri,
  getRequestOrigin,
  maskGoogleClientId,
  validateGoogleClientId,
} from "@/lib/googleOAuthRedirect.server";

/** Diagnostyka OAuth integracji Gmail/Kalendarz — bez wpływu na logowanie. */
export const Route = createFileRoute("/api/public/google/debug-env")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
        const adsDeveloperToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
        const redirectUri = getGoogleIntegrationOAuthRedirectUri(request);
        const clientIdError = validateGoogleClientId(clientId);

        return Response.json(
          {
            integrationEndpoint: "/api/public/google/start",
            loginEndpointUntouched: "/api/public/auth/google/start",
            clientId: {
              exists: Boolean(clientId),
              endsWithAppsGoogleusercontent: Boolean(clientId?.endsWith(".apps.googleusercontent.com")),
              masked: clientId ? maskGoogleClientId(clientId) : null,
              validationError: clientIdError,
            },
            clientSecret: {
              exists: Boolean(clientSecret),
              startsWithGocspx: Boolean(clientSecret?.startsWith("GOCSPX")),
            },
            googleAds: {
              developerTokenExists: Boolean(adsDeveloperToken),
              developerTokenLength: adsDeveloperToken ? adsDeveloperToken.length : 0,
            },
            redirectUri: {
              resolved: redirectUri,
              envOverride: process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || null,
            },
            runtime: {
              requestOrigin: getRequestOrigin(request),
              nodeEnv: process.env.NODE_ENV,
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
