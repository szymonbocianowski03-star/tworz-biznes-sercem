-- Dodaj kolumny metadanych do generated_images, których oczekuje aplikacja
-- (galeria zasobów oraz zapis z agenta przekazują product_name / campaign_name).
ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS campaign_name text;
