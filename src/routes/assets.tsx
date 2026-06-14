import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/assets")({
  head: () => ({ meta: [{ title: "Zasoby — MarketingNow" }] }),
  beforeLoad: ({ location }) => {
    if (location.pathname === "/assets") {
      throw redirect({ to: "/assets/gallery" });
    }
  },
  component: AssetsLayout,
});

function AssetsLayout() {
  return <AppShell />;
}
