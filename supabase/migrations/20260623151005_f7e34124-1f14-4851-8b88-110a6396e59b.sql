-- Tabela na wygenerowane pliki dźwiękowe (ElevenLabs TTS)
CREATE TABLE IF NOT EXISTS public.generated_audios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  audio_url text,
  storage_path text,
  voice text,
  voice_name text,
  status text NOT NULL DEFAULT 'pending',
  error_detail text,
  user_reaction text DEFAULT 'none',
  product_name text,
  campaign_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_audios TO authenticated;
GRANT ALL ON public.generated_audios TO service_role;

ALTER TABLE public.generated_audios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audios"
  ON public.generated_audios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audios"
  ON public.generated_audios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audios"
  ON public.generated_audios FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own audios"
  ON public.generated_audios FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS generated_audios_user_id_created_at_idx
  ON public.generated_audios (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_generated_audios_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generated_audios_updated_at ON public.generated_audios;
CREATE TRIGGER generated_audios_updated_at
  BEFORE UPDATE ON public.generated_audios
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_generated_audios_updated_at();