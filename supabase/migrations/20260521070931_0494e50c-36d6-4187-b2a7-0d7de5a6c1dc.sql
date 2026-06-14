
-- user_notification_settings
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  webhook_url text,
  notify_welcome boolean NOT NULL DEFAULT true,
  notify_generation_ready boolean NOT NULL DEFAULT true,
  notify_campaign_launched boolean NOT NULL DEFAULT true,
  notify_weekly_report boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notif settings" ON public.user_notification_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notif settings" ON public.user_notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own notif settings" ON public.user_notification_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notif settings" ON public.user_notification_settings FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages notif settings" ON public.user_notification_settings FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER trg_user_notification_settings_updated BEFORE UPDATE ON public.user_notification_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- saved_viral_shorts
CREATE TABLE IF NOT EXISTS public.saved_viral_shorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  url text NOT NULL,
  title text,
  author text,
  thumbnail text,
  views bigint NOT NULL DEFAULT 0,
  likes bigint NOT NULL DEFAULT 0,
  search_query text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, url)
);
ALTER TABLE public.saved_viral_shorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own saved shorts" ON public.saved_viral_shorts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own saved shorts" ON public.saved_viral_shorts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own saved shorts" ON public.saved_viral_shorts FOR DELETE USING (auth.uid() = user_id);

-- generated_videos
CREATE TABLE IF NOT EXISTS public.generated_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  video_url text,
  storage_path text,
  status text NOT NULL DEFAULT 'pending',
  error_detail text,
  user_reaction text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own generated videos" ON public.generated_videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own generated videos" ON public.generated_videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own generated videos" ON public.generated_videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own generated videos" ON public.generated_videos FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages generated videos" ON public.generated_videos FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER trg_generated_videos_updated BEFORE UPDATE ON public.generated_videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ensure_user_credits RPC
CREATE OR REPLACE FUNCTION public.ensure_user_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_credits (user_id, balance, current_plan)
  VALUES (_uid, 20, 'free')
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
