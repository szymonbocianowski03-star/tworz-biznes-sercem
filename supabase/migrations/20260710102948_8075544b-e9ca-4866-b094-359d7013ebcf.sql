CREATE TABLE public.klaviyo_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  private_api_key TEXT NOT NULL,
  from_email TEXT,
  default_list_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.klaviyo_connections TO authenticated;
GRANT ALL ON public.klaviyo_connections TO service_role;

ALTER TABLE public.klaviyo_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own klaviyo connection"
  ON public.klaviyo_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own klaviyo connection"
  ON public.klaviyo_connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own klaviyo connection"
  ON public.klaviyo_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own klaviyo connection"
  ON public.klaviyo_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_klaviyo_connections_updated_at
  BEFORE UPDATE ON public.klaviyo_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();