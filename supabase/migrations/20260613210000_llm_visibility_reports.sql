-- Raporty widoczności marki w AI — trwały zapis na koncie (jak competitor_reports).

CREATE TABLE IF NOT EXISTS public.llm_visibility_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain text NOT NULL,
  brand_name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'saved',
  report jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS llm_visibility_reports_user_created_idx
  ON public.llm_visibility_reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS llm_visibility_reports_user_domain_idx
  ON public.llm_visibility_reports (user_id, domain);

ALTER TABLE public.llm_visibility_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own llm visibility reports" ON public.llm_visibility_reports;
CREATE POLICY "Users view own llm visibility reports"
  ON public.llm_visibility_reports FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own llm visibility reports" ON public.llm_visibility_reports;
CREATE POLICY "Users insert own llm visibility reports"
  ON public.llm_visibility_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own llm visibility reports" ON public.llm_visibility_reports;
CREATE POLICY "Users update own llm visibility reports"
  ON public.llm_visibility_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own llm visibility reports" ON public.llm_visibility_reports;
CREATE POLICY "Users delete own llm visibility reports"
  ON public.llm_visibility_reports FOR DELETE
  USING (auth.uid() = user_id);
