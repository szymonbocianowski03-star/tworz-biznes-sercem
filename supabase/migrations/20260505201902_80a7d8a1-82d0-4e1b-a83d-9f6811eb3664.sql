
CREATE TABLE public.meta_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meta_user_id TEXT NOT NULL,
  meta_user_name TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  ad_accounts JSONB DEFAULT '[]'::jsonb,
  selected_ad_account_id TEXT,
  pixel_id TEXT,
  pages JSONB DEFAULT '[]'::jsonb,
  selected_page_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, meta_user_id)
);

ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own meta connections"
ON public.meta_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own meta connections"
ON public.meta_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own meta connections"
ON public.meta_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own meta connections"
ON public.meta_connections FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_meta_connections_updated_at
BEFORE UPDATE ON public.meta_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_meta_connections_user_id ON public.meta_connections(user_id);
