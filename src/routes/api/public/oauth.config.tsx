import { createFileRoute } from "@tanstack/react-router";

/** Informuje klienta, czy OAuth da się uruchomić (bez ujawniania sekretów). */
export const Route = createFileRoute("/api/public/oauth/config")({
  server: {
    handlers: {
      GET: async () => {
        const metaAppId = Boolean(process.env.META_APP_ID?.trim());
        const metaSecret = Boolean(process.env.META_APP_SECRET?.trim());
        const linkedinId = Boolean(process.env.LINKEDIN_CLIENT_ID?.trim());
        const linkedinSecret = Boolean(process.env.LINKEDIN_CLIENT_SECRET?.trim());

        const metaAppIdValue = process.env.META_APP_ID?.trim() ?? "";
        const metaLoginConfigId = process.env.META_FB_LOGIN_CONFIG_ID?.trim() ?? "";

        const googleId = Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID?.trim());
        const googleSecret = Boolean(process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim());

        return Response.json({
          meta: {
            canStart: metaAppId,
            canComplete: metaAppId && metaSecret,
            /** Publiczny identyfikator aplikacji Meta (wymagany przez Facebook JS SDK). */
            appId: metaAppId ? metaAppIdValue : null,
            /** Opcjonalny config_id z Meta Login Button (Facebook Login for Business). */
            loginConfigId: metaLoginConfigId || null,
          },
          linkedin: {
            canStart: linkedinId,
            canComplete: linkedinId && linkedinSecret,
          },
          google: {
            canStart: googleId,
            canComplete: googleId && googleSecret,
          },
        });
      },
    },
  },
});
