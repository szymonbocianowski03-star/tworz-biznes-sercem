import { createFileRoute, redirect } from "@tanstack/react-router";

/** Stary adres — przekierowanie na zasoby (obrazy). */
export const Route = createFileRoute("/assets/generations")({
  beforeLoad: () => {
    throw redirect({ to: "/assets/gallery", replace: true });
  },
  component: () => null,
});
