-- Limit zużycia AI na planie darmowym (~2 USD) + historia zdarzeń (ślad)
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS free_ai_usage_usd_cents integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.credit_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  credits_delta integer NOT NULL DEFAULT 0,
  usd_cents integer NOT NULL DEFAULT 0,
  detail jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_usage_log_user_created_idx
  ON public.credit_usage_log (user_id, created_at DESC);

ALTER TABLE public.credit_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credit usage log"
  ON public.credit_usage_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages credit usage log"
  ON public.credit_usage_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Czy konto free może jeszcze wywołać AI (wykorzystanie < 2 USD w centach)
CREATE OR REPLACE FUNCTION public.assert_can_use_free_ai(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  plan text;
  spend integer;
BEGIN
  SELECT current_plan, COALESCE(free_ai_usage_usd_cents, 0)
  INTO plan, spend
  FROM public.user_credits
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF plan IS NOT NULL AND plan <> 'free' THEN
    RETURN true;
  END IF;

  RETURN spend < 200;
END;
$$;

-- Po wywołaniu: dolicz szacunek (tylko plan free), max 200 łącznie
CREATE OR REPLACE FUNCTION public.apply_free_ai_usage_after_call(_user_id uuid, _usd_cents integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  plan text;
  add_cents integer;
BEGIN
  add_cents := GREATEST(0, LEAST(COALESCE(_usd_cents, 0), 500));

  SELECT current_plan INTO plan
  FROM public.user_credits
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF plan IS NOT NULL AND plan <> 'free' THEN
    RETURN;
  END IF;

  UPDATE public.user_credits
  SET
    free_ai_usage_usd_cents = LEAST(200, COALESCE(free_ai_usage_usd_cents, 0) + add_cents),
    updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_credit_usage_event(
  _user_id uuid,
  _source text,
  _credits_delta integer,
  _usd_cents integer,
  _detail jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.credit_usage_log (user_id, source, credits_delta, usd_cents, detail)
  VALUES (_user_id, _source, COALESCE(_credits_delta, 0), GREATEST(0, COALESCE(_usd_cents, 0)), _detail);
END;
$$;
