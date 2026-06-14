-- Realtime: powiadomienia o zmianach user_credits (saldo / free_ai_usage_usd_cents),
-- żeby useCredits() odświeżał licznik bez polegania wyłącznie na scheduleCreditsRefresh.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'user_credits'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.user_credits;
    END IF;
  END IF;
END $$;
