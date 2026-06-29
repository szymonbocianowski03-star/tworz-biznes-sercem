-- Konkurenci + zapisane raporty (historia).

CREATE TABLE IF NOT EXISTS public.competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competitors_user_created_idx
  ON public.competitors (user_id, created_at DESC);

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own competitors" ON public.competitors;
CREATE POLICY "Users view own competitors"
  ON public.competitors FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own competitors" ON public.competitors;
CREATE POLICY "Users insert own competitors"
  ON public.competitors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own competitors" ON public.competitors;
CREATE POLICY "Users update own competitors"
  ON public.competitors FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own competitors" ON public.competitors;
CREATE POLICY "Users delete own competitors"
  ON public.competitors FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.competitor_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competitor_id uuid REFERENCES public.competitors(id) ON DELETE SET NULL,
  competitor_url text NOT NULL,
  industry text,
  compare_url text,
  focus jsonb,
  manual_text text,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competitor_reports_user_created_idx
  ON public.competitor_reports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS competitor_reports_competitor_created_idx
  ON public.competitor_reports (competitor_id, created_at DESC);

ALTER TABLE public.competitor_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own competitor reports" ON public.competitor_reports;
CREATE POLICY "Users view own competitor reports"
  ON public.competitor_reports FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own competitor reports" ON public.competitor_reports;
CREATE POLICY "Users insert own competitor reports"
  ON public.competitor_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own competitor reports" ON public.competitor_reports;
CREATE POLICY "Users delete own competitor reports"
  ON public.competitor_reports FOR DELETE
  USING (auth.uid() = user_id);

