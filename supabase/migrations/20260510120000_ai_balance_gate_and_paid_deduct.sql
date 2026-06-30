-- Kredyty: blokada przy saldzie 0; plan płatny zużywa balance po każdym wywołaniu AI (szacunek z USD centów).

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

  IF bal <= 0 THEN
    RETURN false;
  END IF;

  IF plan IS NULL OR plan = 'free' THEN
    RETURN spend < 200;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_free_ai_usage_after_call(_user_id uuid, _usd_cents integer)
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
BEGIN
  add_cents := GREATEST(0, LEAST(COALESCE(_usd_cents, 0), 500));

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
    RETURN;
  END IF;

  -- Plan płatny: ~1000 kredytów na 1 USD kosztu => 10 kredytów na 1 cent szacunku USD
  deduct := GREATEST(1, LEAST(bal, CEIL(add_cents::numeric * 10)));

  UPDATE public.user_credits
  SET
    balance = GREATEST(0, balance - deduct),
    updated_at = now()
  WHERE user_id = _user_id;
END;
$$;
