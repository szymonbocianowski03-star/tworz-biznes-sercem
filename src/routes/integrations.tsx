import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [{ title: "Integracje — MarketingNow" }] }),
  component: () => <AppShell />,
});