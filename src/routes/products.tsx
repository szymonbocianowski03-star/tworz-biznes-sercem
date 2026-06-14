import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "Produkty — MarketingNow" }] }),
  beforeLoad: ({ location }) => {
    if (location.pathname === "/products") {
      throw redirect({ to: "/products/choose" });
    }
  },
  component: () => <AppShell />,
});
