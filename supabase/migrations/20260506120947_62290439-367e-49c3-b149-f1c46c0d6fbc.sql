CREATE TABLE public.linkedin_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  linkedin_user_id TEXT NOT NULL,
  linkedin_user_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  ad_accounts JSONB DEFAULT '[]'::jsonb,
  organizations JSONB DEFAULT '[]'::jsonb,
  selected_ad_account_id TEXT,
  selected_organization_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, linkedin_user_id)
);

ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own linkedin connections"
  ON public.linkedin_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own linkedin connections"
  ON public.linkedin_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own linkedin connections"
  ON public.linkedin_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own linkedin connections"
  ON public.linkedin_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_linkedin_connections_updated_at
  BEFORE UPDATE ON public.linkedin_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();