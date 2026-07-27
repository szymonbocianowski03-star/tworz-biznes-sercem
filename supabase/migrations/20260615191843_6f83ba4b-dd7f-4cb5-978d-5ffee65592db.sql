-- Ujednolicenie cennika kredytów AI z resztą aplikacji:
-- 1) Limit planu Free = $1,00 (100 ¢ kosztu API), wcześniej było 200 ¢.
-- 2) Plan płatny: odejmujemy ceil(koszt_API_¢ × 4) kredytów (4 kred. / cent USD),
--    lub stałą kwotę dla obrazu/wideo (_fixed_credits). Wcześniej było × 10.

CREATE OR REPLACE FUNCTION public.assert_can_use_free_ai(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Limit Free = $1,00 = 100 ¢ łącznego kosztu API.
    RETURN COALESCE(_used, 0) < 100;
  END IF;

  RETURN COALESCE(_balance, 0) > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_free_ai_usage_after_call(_user_id uuid, _usd_cents integer, _source text DEFAULT 'unknown'::text, _detail jsonb DEFAULT NULL::jsonb, _fixed_credits integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Plan Free: sumujemy koszt API do limitu $1,00 (100 ¢). Kredyty z salda nie są odejmowane.
    UPDATE public.user_credits
      SET free_ai_usage_usd_cents = LEAST(100, COALESCE(free_ai_usage_usd_cents, 0) + _cents),
          updated_at = now()
      WHERE user_id = _user_id;
    _delta := 0;
  ELSE
    -- Plan płatny: stała kwota dla obrazu/wideo, w innym wypadku koszt API w centach × 4.
    _delta := COALESCE(_fixed_credits, GREATEST(1, CEIL(_cents * 4))::int);
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
$function$;