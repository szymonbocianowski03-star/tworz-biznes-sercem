-- Metadane biblioteki zasobów (nazwa produktu / kampanii przy zapisie z czatu)
ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS campaign_name TEXT;

ALTER TABLE public.generated_videos
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS campaign_name TEXT;
