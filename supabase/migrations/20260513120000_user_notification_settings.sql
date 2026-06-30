-- Ustawienia powiadomień użytkownika (webhook Zapier / Make + flagi zdarzeń).
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  notify_welcome BOOLEAN NOT NULL DEFAULT true,
  notify_generation_ready BOOLEAN NOT NULL DEFAULT true,
  notify_campaign_launched BOOLEAN NOT NULL DEFAULT true,
  notify_weekly_report BOOLEAN NOT NULL DEFAULT false,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_notification_settings_webhook_len CHECK (
    webhook_url IS NULL OR char_length(webhook_url) <= 2048
  )
);

CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user ON public.user_notification_settings (user_id);

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users read own notification settings"
    ON public.user_notification_settings FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own notification settings"
    ON public.user_notification_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own notification settings"
    ON public.user_notification_settings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_user_notification_settings_updated_at
    BEFORE UPDATE ON public.user_notification_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column ();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.user_notification_settings IS
  'Preferencje powiadomień i opcjonalny URL webhooka (np. Zapier Catch Hook) dla zdarzeń z aplikacji.';
