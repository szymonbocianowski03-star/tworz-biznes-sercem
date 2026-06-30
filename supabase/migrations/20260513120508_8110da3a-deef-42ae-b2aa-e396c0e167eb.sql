ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS feedback_note text,
  ADD COLUMN IF NOT EXISTS report_reason text,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz;