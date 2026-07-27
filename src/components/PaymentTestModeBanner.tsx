import { useEffect, useState } from "react";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (!clientToken) {
    return (
      <div className="w-full bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-center text-sm text-destructive">
        Płatności produkcyjne nie są jeszcze skonfigurowane. Dokończ konfigurację Stripe, aby przyjmować realne płatności.
      </div>
    );
  }

  if (!clientToken?.startsWith("pk_test_")) return null;

  return (
    <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
      Wszystkie płatności w podglądzie są w trybie testowym — użyj testowych kart, aby sprawdzić checkout bez obciążenia konta.
    </div>
  );
}