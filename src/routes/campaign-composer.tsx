import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/campaign-composer")({
  head: () => ({ meta: [{ title: "Panel kampanii — MarketingNow" }] }),
  component: () => <AppShell />,
});
