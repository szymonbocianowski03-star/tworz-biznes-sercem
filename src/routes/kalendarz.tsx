import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/kalendarz")({
  head: () => ({ meta: [{ title: "Kalendarz — MarketingNow" }] }),
  component: () => <AppShell />,
});