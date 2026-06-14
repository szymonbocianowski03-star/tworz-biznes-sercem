import { createFileRoute, redirect } from "@tanstack/react-router";

/** Stara ścieżka deweloperska — przekierowanie na listę szkiców. */
export const Route = createFileRoute("/campaign-composer/errors")({
  beforeLoad: () => {
    throw redirect({ to: "/campaign-composer", replace: true });
  },
});
