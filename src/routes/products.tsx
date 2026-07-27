import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "Marki — MarketingNow" }] }),
  beforeLoad: ({ location }) => {
    if (location.pathname === "/products") {
      throw redirect({ to: "/products/brands" });
    }
  },
  component: () => <AppShell />,
});
