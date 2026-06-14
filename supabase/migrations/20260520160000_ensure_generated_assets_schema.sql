-- Naprawa: brak tabeli generated_videos i kolumny user_reaction (idempotentne — bezpieczne wielokrotne uruchomienie).

CREATE TABLE IF NOT EXISTS public.generated_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  video_url TEXT,
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
  runway_task_id TEXT,
  error_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_videos_user_created ON public.generated_videos (user_id, created_at DESC);

ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own generated videos" ON public.generated_videos;
CREATE POLICY "Users view own generated videos"
  ON public.generated_videos FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own generated videos" ON public.generated_videos;
CREATE POLICY "Users delete own generated videos"
  ON public.generated_videos FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own generated videos" ON public.generated_videos;
CREATE POLICY "Users update own generated videos"
  ON public.generated_videos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.generated_videos
  ADD COLUMN IF NOT EXISTS user_reaction TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.generated_videos DROP CONSTRAINT IF EXISTS generated_videos_user_reaction_check;
ALTER TABLE public.generated_videos
  ADD CONSTRAINT generated_videos_user_reaction_check CHECK (user_reaction IN ('none', 'like', 'dislike'));

ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS user_reaction TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.generated_images DROP CONSTRAINT IF EXISTS generated_images_user_reaction_check;
ALTER TABLE public.generated_images
  ADD CONSTRAINT generated_images_user_reaction_check CHECK (user_reaction IN ('none', 'like', 'dislike'));
