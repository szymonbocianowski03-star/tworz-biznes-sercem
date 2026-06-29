import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Ustaw nowe hasło — MarketingNow" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Hasło zostało zmienione. Zalogowano.");
      navigate({ to: "/agent" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się zmienić hasła.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-md border border-foreground/10 bg-background p-8 shadow-soft">
        <h1 className="font-display text-2xl font-extrabold tracking-tighter">Ustaw nowe hasło</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ready
            ? "Wpisz nowe hasło do swojego konta."
            : "Otwórz link resetujący z wiadomości email — następnie wrócisz tutaj automatycznie."}
        </p>
        {ready && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Nowe hasło</span>
              <div className="mt-1.5 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="min. 8 znaków"
                  autoComplete="new-password"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Zapisz nowe hasło"}
            </button>
          </form>
        )}
        <div className="mt-6 text-center text-sm">
          <Link to="/auth" className="text-muted-foreground hover:text-foreground">← Wróć do logowania</Link>
        </div>
      </div>
    </div>
  );
}