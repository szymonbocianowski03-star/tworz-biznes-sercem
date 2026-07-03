
-- 1. Kolumna licznika zużycia dla planu Free (w centach USD szacowanego kosztu)
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS free_ai_usage_usd_cents integer NOT NULL DEFAULT 0;

-- 2. Tabela historii zużycia
CREATE TABLE IF NOT EXISTS public.credit_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  usd_cents integer NOT NULL DEFAULT 0,
  credits_delta integer NOT NULL DEFAULT 0,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_log_user_created
  ON public.credit_usage_log (user_id, created_at DESC);

ALTER TABLE public.credit_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own usage log" ON public.credit_usage_log;
CREATE POLICY "Users view own usage log"
  ON public.credit_usage_log FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages usage log" ON public.credit_usage_log;
CREATE POLICY "Service role manages usage log"
  ON public.credit_usage_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Sprawdzenie czy użytkownik może użyć AI
CREATE OR REPLACE FUNCTION public.assert_can_use_free_ai(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text;
  _balance integer;
  _used integer;
BEGIN
  INSERT INTO public.user_credits (user_id, balance, current_plan)
  VALUES (_user_id, 20, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT current_plan, balance, free_ai_usage_usd_cents
    INTO _plan, _balance, _used
  FROM public.user_credits
  WHERE user_id = _user_id;

  IF _plan = 'free' OR _plan IS NULL THEN
    RETURN COALESCE(_used, 0) < 200;
  END IF;

  RETURN COALESCE(_balance, 0) > 0;
END;
$$;

-- 4. Zapis zużycia po wywołaniu AI — realnie odejmuje kredyty
CREATE OR REPLACE FUNCTION public.apply_free_ai_usage_after_call(
  _user_id uuid,
  _usd_cents integer,
  _source text DEFAULT 'unknown',
  _detail jsonb DEFAULT NULL,
  _fixed_credits integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan text;
  _delta integer := 0;
  _cents integer := GREATEST(0, COALESCE(_usd_cents, 0));
BEGIN
  INSERT INTO public.user_credits (user_id, balance, current_plan)
  VALUES (_user_id, 20, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT current_plan INTO _plan
  FROM public.user_credits
  WHERE user_id = _user_id;

  IF _plan = 'free' OR _plan IS NULL THEN
    UPDATE public.user_credits
      SET free_ai_usage_usd_cents = LEAST(200, COALESCE(free_ai_usage_usd_cents, 0) + _cents),
          updated_at = now()
      WHERE user_id = _user_id;
    _delta := 0;
  ELSE
    -- Płatny plan: odejmujemy realne kredyty (1 obraz = 100 kredytów lub ~10 kred. / cent USD)
    _delta := COALESCE(_fixed_credits, _cents * 10);
    IF _delta < 0 THEN _delta := 0; END IF;
    UPDATE public.user_credits
      SET balance = GREATEST(0, balance - _delta),
          updated_at = now()
      WHERE user_id = _user_id;
    _delta := -_delta;
  END IF;

  INSERT INTO public.credit_usage_log (user_id, source, usd_cents, credits_delta, detail)
  VALUES (_user_id, COALESCE(_source, 'unknown'), _cents, _delta, _detail);
END;
$$;

-- Wariant 2-argumentowy (fallback ze starego kodu)
CREATE OR REPLACE FUNCTION public.apply_free_ai_usage_after_call(
  _user_id uuid,
  _usd_cents integer,
  _fixed_credits integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_free_ai_usage_after_call(_user_id, _usd_cents, 'unknown', NULL::jsonb, _fixed_credits);
END;
$$;
