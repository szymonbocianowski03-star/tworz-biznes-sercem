import { createFileRoute } from "@tanstack/react-router";
import { AppBackLink } from "@/components/AppBackLink";
import { GrowthSalesWheel } from "@/components/GrowthSalesWheel";

export const Route = createFileRoute("/kolo-wzrostu")({
  head: () => ({
    meta: [{ title: "Koło wzrostu sprzedaży — MarketingNow" }],
  }),
  component: KoloWzrostuPage,
});

function KoloWzrostuPage() {
  return (
    <div className="min-h-screen bg-zinc-100 text-neutral-950 antialiased">
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-8 py-8 md:py-12">
        <AppBackLink className="mb-8 text-zinc-600 hover:text-zinc-950" />
        <GrowthSalesWheel ctaTo="/agent" hideWheelCaption />
      </div>
    </div>
  );
}
