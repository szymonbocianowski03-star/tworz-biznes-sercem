-- Galeria Zasoby: domyślna reakcja + polityka INSERT wideo (idempotentne)

ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS user_reaction TEXT NOT NULL DEFAULT 'none';

ALTER TABLE public.generated_videos
  ADD COLUMN IF NOT EXISTS user_reaction TEXT NOT NULL DEFAULT 'none';

UPDATE public.generated_images SET user_reaction = 'none' WHERE user_reaction IS NULL;
UPDATE public.generated_videos SET user_reaction = 'none' WHERE user_reaction IS NULL;

DROP POLICY IF EXISTS "Users insert own generated videos" ON public.generated_videos;
CREATE POLICY "Users insert own generated videos"
  ON public.generated_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('generations', 'generations', true)
ON CONFLICT (id) DO NOTHING;
