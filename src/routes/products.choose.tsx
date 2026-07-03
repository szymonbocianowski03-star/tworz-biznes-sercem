import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, ArrowRight, Palette, Building2 } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/products/choose")({
  head: () => ({ meta: [{ title: "Panel marek — MarketingNow" }] }),
  component: ProductsChoose,
});

function ProductsChoose() {
  return (
    <div className="px-6 md:px-10 py-10 max-w-5xl">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Panel</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">Marki i zespół</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Marka to centrum workspace — w skład marki wchodzą produkty i usługi. AI zapamiętuje kontekst ze
          strony WWW.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="rounded-3xl border border-border bg-surface-elevated p-6 shadow-soft hover:shadow-elevated transition-all md:col-span-1"
        >
          <div className="h-11 w-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Marki</h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Strona WWW, kontekst AI, skład marki — produkty i usługi przypisane do marki.
          </p>
          <Link
            to="/products/brands"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition shadow-elevated"
          >
            Zarządzaj markami <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
          className="rounded-3xl border border-border bg-surface-elevated p-6 shadow-soft hover:shadow-elevated transition-all"
        >
          <div className="h-11 w-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Zespół</h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Zaproszenia do workspace — wspólny dostęp do marek, produktów i usług. Kredyty AI — osobiste.
          </p>
          <Link
            to="/products/team"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
          >
            Wejdź w zespół <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
          className="rounded-3xl border border-border bg-surface-elevated p-6 shadow-soft hover:shadow-elevated transition-all"
        >
          <div className="h-11 w-11 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
            <Palette className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Tożsamość wizualna</h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Reguły marki, obrazy referencyjne — agent stosuje je przy kreacjach i grafikach.
          </p>
          <Link
            to="/products/brand-visual"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
          >
            Otwórz brand kit <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
