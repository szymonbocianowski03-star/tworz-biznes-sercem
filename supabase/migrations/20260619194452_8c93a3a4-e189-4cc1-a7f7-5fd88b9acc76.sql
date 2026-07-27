CREATE OR REPLACE FUNCTION public.assert_can_use_free_ai(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
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
    RETURN COALESCE(_used, 0) < 100;
  END IF;

  RETURN COALESCE(_balance, 0) > 0;
END;
$function$;