import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { AppBackLink } from "@/components/AppBackLink";
import { MetaIntegrationCard } from "@/components/MetaIntegrationCard";
import { LinkedInIntegrationCard } from "@/components/LinkedInIntegrationCard";
import { TikTokIntegrationCard } from "@/components/TikTokIntegrationCard";
import { AutomatedEmailsCard } from "@/components/AutomatedEmailsCard";
import { UserIntegrationsCard } from "@/components/UserIntegrationsCard";
import { friendlyGoogleOAuthError } from "@/lib/googleOAuthErrors";

export const Route = createFileRoute("/integrations/")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const meta = qs.get("meta");
    const linkedin = qs.get("linkedin");
    const tiktok = qs.get("tiktok");
    const gmail = qs.get("gmail");
    const gcal = qs.get("gcal");
    const outlook = qs.get("outlook");
    const outcal = qs.get("outcal");
    const name = qs.get("name");
    const err = qs.get("error");
    if (meta === "connected") toast.success(`Połączono z Meta${name ? ` jako ${name}` : ""}`);
    else if (meta === "error") toast.error(`Meta: ${err ?? "błąd połączenia"}`);
    if (linkedin === "connected") toast.success(`Połączono z LinkedIn${name ? ` jako ${name}` : ""}`);
    else if (linkedin === "error") toast.error(`LinkedIn: ${err ?? "błąd połączenia"}`);
    if (tiktok === "connected") toast.success(`Połączono z TikTok Ads${name ? ` jako ${name}` : ""}`);
    else if (tiktok === "error") {
      const detail =
        err === "state_mismatch"
          ? "Sesja OAuth wygasła — spróbuj ponownie."
          : err?.startsWith("config_error")
            ? err.replace("config_error: ", "")
            : err?.includes("redirect")
              ? "Niezgodny redirect URI — sprawdź TIKTOK_REDIRECT_URI w Lovable i TikTok Developer Portal."
              : err ??
                "TikTok odrzucił logowanie (api_auth_error_other). Sprawdź TIKTOK_APP_ID (numeryczny), TIKTOK_APP_SECRET i redirect URI w TikTok for Developers.";
      toast.error(`TikTok Ads: ${detail}`, { duration: 12000 });
    }
    if (gmail === "connected") toast.success(`Połączono Gmail${name ? ` (${name})` : ""}`);
    else if (gmail === "error") toast.error(`Gmail: ${friendlyGoogleOAuthError(err)}`, { duration: 8000 });
    if (gcal === "connected") toast.success(`Połączono Google Calendar${name ? ` (${name})` : ""}`);
    else if (gcal === "error") toast.error(`Google Calendar: ${friendlyGoogleOAuthError(err)}`, { duration: 8000 });
    if (outlook === "connected") toast.success(`Połączono Outlook${name ? ` (${name})` : ""}`);
    else if (outlook === "error") toast.error(`Outlook: ${err ?? "błąd"}`);
    if (outcal === "connected") toast.success(`Połączono Outlook Calendar${name ? ` (${name})` : ""}`);
    else if (outcal === "error") toast.error(`Outlook Calendar: ${err ?? "błąd"}`);
    if (meta || linkedin || tiktok || gmail || gcal || outlook || outcal) {
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
    }
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 md:px-6 py-8 space-y-6">
      <AppBackLink className="mb-2" />
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Integracje</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Połącz konta reklamowe, aby agent NOW mógł czytać kampanie i publikować reklamy.
        </p>
      </header>
      <MetaIntegrationCard />
      <LinkedInIntegrationCard />
      <TikTokIntegrationCard />
      <UserIntegrationsCard />
      <AutomatedEmailsCard />
    </div>
  );
}