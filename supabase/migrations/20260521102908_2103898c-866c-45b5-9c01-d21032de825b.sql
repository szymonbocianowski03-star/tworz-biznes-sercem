
-- Gmail OAuth per user
CREATE TABLE public.gmail_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own gmail connection" ON public.gmail_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own gmail connection" ON public.gmail_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own gmail connection" ON public.gmail_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own gmail connection" ON public.gmail_connections FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages gmail connections" ON public.gmail_connections FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER trg_gmail_connections_updated BEFORE UPDATE ON public.gmail_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Outlook (Microsoft) mail OAuth per user
CREATE TABLE public.outlook_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  tenant_id text,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.outlook_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own outlook connection" ON public.outlook_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own outlook connection" ON public.outlook_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own outlook connection" ON public.outlook_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own outlook connection" ON public.outlook_connections FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages outlook connections" ON public.outlook_connections FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER trg_outlook_connections_updated BEFORE UPDATE ON public.outlook_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SMTP / Resend per user (no OAuth)
CREATE TABLE public.email_smtp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider IN ('smtp','resend')),
  from_email text NOT NULL,
  from_name text,
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password text,
  smtp_secure boolean DEFAULT true,
  resend_api_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_smtp_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own smtp" ON public.email_smtp_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own smtp" ON public.email_smtp_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own smtp" ON public.email_smtp_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own smtp" ON public.email_smtp_connections FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages smtp" ON public.email_smtp_connections FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER trg_smtp_connections_updated BEFORE UPDATE ON public.email_smtp_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Google Calendar OAuth per user
CREATE TABLE public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  primary_calendar_id text DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own gcal" ON public.google_calendar_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own gcal" ON public.google_calendar_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own gcal" ON public.google_calendar_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own gcal" ON public.google_calendar_connections FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages gcal" ON public.google_calendar_connections FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER trg_gcal_connections_updated BEFORE UPDATE ON public.google_calendar_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Outlook Calendar OAuth per user
CREATE TABLE public.outlook_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  tenant_id text,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.outlook_calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own outcal" ON public.outlook_calendar_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own outcal" ON public.outlook_calendar_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own outcal" ON public.outlook_calendar_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own outcal" ON public.outlook_calendar_connections FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages outcal" ON public.outlook_calendar_connections FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER trg_outcal_connections_updated BEFORE UPDATE ON public.outlook_calendar_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
