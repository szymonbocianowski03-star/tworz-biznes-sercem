CREATE TABLE public.generated_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  size TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own generated images"
  ON public.generated_images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own generated images"
  ON public.generated_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own generated images"
  ON public.generated_images FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_generated_images_user_created ON public.generated_images (user_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('generations', 'generations', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read generations"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'generations');

CREATE POLICY "Users upload to own generations folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'generations'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own generations"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'generations'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );