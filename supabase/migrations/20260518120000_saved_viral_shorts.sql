-- Zapisane wyniki wyszukiwania shortów (TikTok / Instagram / YouTube) na użytkownika

CREATE TABLE IF NOT EXISTS public.saved_viral_shorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube')),
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT '',
  thumbnail text NOT NULL DEFAULT '',
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  search_query text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS saved_viral_shorts_user_url_idx
  ON public.saved_viral_shorts (user_id, url);

CREATE INDEX IF NOT EXISTS saved_viral_shorts_user_created_idx
  ON public.saved_viral_shorts (user_id, created_at DESC);

ALTER TABLE public.saved_viral_shorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own saved viral shorts"
  ON public.saved_viral_shorts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own saved viral shorts"
  ON public.saved_viral_shorts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own saved viral shorts"
  ON public.saved_viral_shorts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own saved viral shorts"
  ON public.saved_viral_shorts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
