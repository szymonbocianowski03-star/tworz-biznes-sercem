CREATE TABLE IF NOT EXISTS public.google_ads_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamp with time zone,
  scope text,
  customer_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_customer_id text,
  login_customer_id text,
  status text NOT NULL DEFAULT 'connected',
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_ads_connections TO authenticated;
GRANT ALL ON public.google_ads_connections TO service_role;

ALTER TABLE public.google_ads_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own google ads connections"
  ON public.google_ads_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own google ads connections"
  ON public.google_ads_connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own google ads connections"
  ON public.google_ads_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own google ads connections"
  ON public.google_ads_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_google_ads_connections_updated_at
  BEFORE UPDATE ON public.google_ads_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cc_campaign_draft DROP CONSTRAINT IF EXISTS cc_campaign_draft_provider_check;
ALTER TABLE public.cc_campaign_draft
  ADD CONSTRAINT cc_campaign_draft_provider_check
  CHECK (provider = ANY (ARRAY['meta'::text, 'linkedin'::text, 'tiktok'::text, 'google'::text]));