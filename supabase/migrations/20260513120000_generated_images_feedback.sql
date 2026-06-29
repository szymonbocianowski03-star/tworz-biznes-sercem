-- Opinia użytkownika, zgłoszenie treści oraz edycja briefu przy wygenerowanych kreacjach
ALTER TABLE public.generated_images
  ADD COLUMN IF NOT EXISTS feedback_note TEXT,
  ADD COLUMN IF NOT EXISTS report_reason TEXT,
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ;

CREATE POLICY "Users update own generated images"
  ON public.generated_images FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
