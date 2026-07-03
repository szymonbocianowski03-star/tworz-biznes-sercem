import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Webhook } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Domyślne flagi w bazie — UI ich nie pokazuje; backend nadal je respektuje. */
const NOTIFY_DEFAULTS = {
  notify_welcome: true,
  notify_generation_ready: true,
  notify_campaign_launched: true,
  notify_weekly_report: false,
} as const;

export function AutomatedEmailsCard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookDirty, setWebhookDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: row, error } = await supabase
      .from("user_notification_settings")
      .select("webhook_url")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) {
      console.error(error);
      toast.error("Nie udało się wczytać ustawień powiadomień.");
    }

    setWebhookUrl(row?.webhook_url ?? "");
    setWebhookDirty(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persistWebhook = useCallback(async (url: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast.message("Zaloguj się, aby zapisać webhook w chmurze.");
      return;
    }
    setSaving(true);
    const trimmed = url.trim() || null;
    const { error } = await supabase.from("user_notification_settings").upsert(
      {
        user_id: uid,
        ...NOTIFY_DEFAULTS,
        webhook_url: trimmed,
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) {
      console.error(error);
      toast.error("Nie udało się zapisać ustawień.");
      return;
    }
    toast.success("Zapisano webhook.");
  }, []);

  const saveWebhook = async () => {
    if (!webhookUrl.trim()) {
      setWebhookDirty(false);
      await persistWebhook("");
      return;
    }
    if (!/^https:\/\//i.test(webhookUrl.trim())) {
      toast.error("Webhook musi zaczynać się od https:// (np. Catch Hook z Zapier).");
      return;
    }
    setWebhookDirty(false);
    await persistWebhook(webhookUrl.trim());
  };

  const runWebhookTest = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      toast.error("Zaloguj się, aby wysłać test.");
      return;
    }
    if (!webhookUrl.trim() || !/^https:\/\//i.test(webhookUrl.trim())) {
      toast.error("Wklej najpierw poprawny URL https://… i zapisz.");
      return;
    }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("dispatch-notification", {
      body: { event: "integration_test" },
    });
    setTesting(false);
    if (error) {
      toast.error(error.message ?? "Błąd wywołania funkcji.");
      return;
    }
    const j = data as { ok?: boolean; error?: string; detail?: string };
    if (!j?.ok) {
      toast.error(j?.detail ?? j?.error ?? "Webhook zwrócił błąd.");
      return;
    }
    toast.success("Test wysłany — sprawdź Zapier / Make.");
  };

  return (
    <section className="rounded-xl border border-foreground/10 bg-card p-5">
      <header className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Mail className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg font-bold tracking-tight">Powiadomienia i e-mail (integracje)</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Transakcyjne maile wymagają osobnej konfiguracji projektu. Tutaj ustawiasz{" "}
            <strong className="text-foreground">webhook HTTPS</strong> (np. Zapier „Catch Hook” → akcja „Send Email”) —
            aplikacja wyśle JSON po zdarzeniach z agenta i z panelu kampanii.
          </p>
        </div>
      </header>

      {!userId && !loading && (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-400/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          Zaloguj się, żeby powiązać webhook z kontem.
        </p>
      )}

      <div className="mt-5 rounded-lg border border-foreground/10 bg-muted/20 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Webhook className="h-4 w-4" />
          Webhook (Zapier / Make / n8n)
        </div>
        {loading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://hooks.zapier.com/hooks/catch/…"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                setWebhookDirty(true);
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving || !webhookDirty}
                onClick={() => void saveWebhook()}
                className="inline-flex items-center rounded-lg bg-foreground text-background px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Zapisz URL
              </button>
              <button
                type="button"
                disabled={testing}
                onClick={() => void runWebhookTest()}
                className="inline-flex items-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Test webhooka
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Payload JSON: pola <code className="text-xs">event</code>, <code className="text-xs">source</code>,{" "}
              <code className="text-xs">occurred_at</code>, <code className="text-xs">user_id</code>,{" "}
              <code className="text-xs">user_email</code> (tylko z edge), <code className="text-xs">data</code>. Dla
              testu: <code className="text-xs">integration_test</code>.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
