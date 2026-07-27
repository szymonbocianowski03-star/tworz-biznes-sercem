CREATE OR REPLACE FUNCTION public.assert_can_use_free_ai(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
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

  SELECT current_plan, COALESCE(balance, 0), COALESCE(free_ai_usage_usd_cents, 0)
    INTO _plan, _balance, _used
  FROM public.user_credits
  WHERE user_id = _user_id;

  IF _plan = 'enterprise' THEN
    RETURN TRUE;
  END IF;

  IF _plan = 'free' OR _plan IS NULL THEN
    RETURN _used < 100 OR _balance > 0;
  END IF;

  RETURN _balance > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_free_ai_usage_after_call(
  _user_id uuid,
  _usd_cents integer,
  _source text DEFAULT 'unknown'::text,
  _detail jsonb DEFAULT NULL::jsonb,
  _fixed_credits integer DEFAULT NULL::integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _plan text;
  _balance integer;
  _used integer;
  _cents integer := GREATEST(0, COALESCE(_usd_cents, 0));
  _delta integer := 0;
  _src text := COALESCE(NULLIF(btrim(COALESCE(_source, '')), ''), 'unknown');
  _detail_safe jsonb := COALESCE(_detail, '{}'::jsonb);
BEGIN
  INSERT INTO public.user_credits (user_id, balance, current_plan)
  VALUES (_user_id, 20, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT current_plan, COALESCE(balance, 0), COALESCE(free_ai_usage_usd_cents, 0)
    INTO _plan, _balance, _used
  FROM public.user_credits
  WHERE user_id = _user_id;

  IF _plan = 'free' OR _plan IS NULL THEN
    IF _used < 100 THEN
      UPDATE public.user_credits
        SET free_ai_usage_usd_cents = LEAST(100, COALESCE(free_ai_usage_usd_cents, 0) + _cents),
            updated_at = now()
        WHERE user_id = _user_id;
      _delta := 0;
    ELSE
      _delta := COALESCE(_fixed_credits, GREATEST(1, CEIL(_cents * 4))::int);
      _delta := GREATEST(0, LEAST(_balance, _delta));
      UPDATE public.user_credits
        SET balance = GREATEST(0, balance - _delta),
            updated_at = now()
        WHERE user_id = _user_id;
      _delta := -_delta;
    END IF;
  ELSE
    _delta := COALESCE(_fixed_credits, GREATEST(1, CEIL(_cents * 4))::int);
    _delta := GREATEST(0, LEAST(_balance, _delta));
    UPDATE public.user_credits
      SET balance = GREATEST(0, balance - _delta),
          updated_at = now()
      WHERE user_id = _user_id;
    _delta := -_delta;
  END IF;

  INSERT INTO public.credit_usage_log (user_id, source, usd_cents, credits_delta, detail)
  VALUES (_user_id, _src, _cents, _delta, _detail_safe);
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_plan_credits(_user_id uuid, _new_plan text, _new_credits integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, current_plan)
  VALUES (_user_id, 20, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_credits
  SET balance = GREATEST(COALESCE(balance, 0), COALESCE(_new_credits, 0)),
      current_plan = COALESCE(_new_plan, current_plan),
      updated_at = now()
  WHERE user_id = _user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_free_ai_usage_after_call(_user_id uuid, _usd_cents integer, _fixed_credits integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.apply_free_ai_usage_after_call(_user_id, _usd_cents, 'unknown', NULL::jsonb, _fixed_credits);
END;
$function$;