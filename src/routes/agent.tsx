import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/agent")({
  head: () => ({ meta: [{ title: "Agent — MarketingNow" }] }),
  component: () => <AppShell />,
});
