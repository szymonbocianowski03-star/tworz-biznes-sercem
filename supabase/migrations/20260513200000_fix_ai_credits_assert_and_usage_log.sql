-- Naprawa bramki kredytów: plan Free ma być liczony wyłącznie po free_ai_usage_usd_cents (< 200),
-- a nie po saldzie kredytów (balance). Wcześniejsza wersja błędnie blokowała Free przy balance = 0.
-- Dodatkowo: jeden zapis do credit_usage_log z prawdziwym credits_delta dla planów płatnych.

CREATE OR REPLACE FUNCTION public.assert_can_use_free_ai(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  plan text;
  spend integer;
  bal integer;
BEGIN
  SELECT current_plan, COALESCE(free_ai_usage_usd_cents, 0), COALESCE(balance, 0)
  INTO plan, spend, bal
  FROM public.user_credits
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF plan IS NULL OR plan = 'free' THEN
    RETURN spend < 200;
  END IF;

  RETURN bal > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_free_ai_usage_after_call(
  _user_id uuid,
  _usd_cents integer,
  _source text DEFAULT 'ai',
  _detail jsonb DEFAULT NULL::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  plan text;
  bal integer;
  add_cents integer;
  deduct integer;
  src text;
  detail jsonb;
BEGIN
  add_cents := GREATEST(0, LEAST(COALESCE(_usd_cents, 0), 500));
  src := NULLIF(btrim(COALESCE(_source, '')), '');
  IF src IS NULL THEN
    src := 'ai';
  END IF;
  detail := COALESCE(_detail, '{}'::jsonb);

  SELECT current_plan, COALESCE(balance, 0)
  INTO plan, bal
  FROM public.user_credits
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF plan IS NULL OR plan = 'free' THEN
    UPDATE public.user_credits
    SET
      free_ai_usage_usd_cents = LEAST(200, COALESCE(free_ai_usage_usd_cents, 0) + add_cents),
      updated_at = now()
    WHERE user_id = _user_id;

    INSERT INTO public.credit_usage_log (user_id, source, credits_delta, usd_cents, detail)
    VALUES (_user_id, src, 0, add_cents, detail);
    RETURN;
  END IF;

  deduct := GREATEST(1, LEAST(bal, CEIL(add_cents::numeric * 10)));

  UPDATE public.user_credits
  SET
    balance = GREATEST(0, balance - deduct),
    updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.credit_usage_log (user_id, source, credits_delta, usd_cents, detail)
  VALUES (
    _user_id,
    src,
    -deduct,
    add_cents,
    detail || jsonb_build_object('credits_charged', deduct)
  );
END;
$$;
