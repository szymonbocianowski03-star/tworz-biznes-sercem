ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS campaign_name text;