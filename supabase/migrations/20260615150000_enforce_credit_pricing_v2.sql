-- Wymuszenie cennika v2 na produkcji (Lovable / Supabase).
-- Uruchom w SQL Editor, jeśli zużycie AI nadal liczy stare kredyty (×10, limit $2).
-- Model: 1 cent USD kosztu API = 4 kredyty; obraz = 25¢ = 100 kred.; Free max $1 (100¢).

CREATE OR REPLACE FUNCTION public.assert_can_use_free_ai(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _plan text;
  _balance integer;
  _used integer;
  free_cap constant integer := 100;
BEGIN
  INSERT INTO public.user_credits (user_id, balance, current_plan, free_ai_usage_usd_cents)
  VALUES (_user_id, 20, 'free', 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT current_plan, balance, free_ai_usage_usd_cents
    INTO _plan, _balance, _used
  FROM public.user_credits
  WHERE user_id = _user_id;

  IF _plan = 'enterprise' THEN
    RETURN TRUE;
  END IF;

  IF _plan = 'free' OR _plan IS NULL THEN
    RETURN COALESCE(_used, 0) < free_cap;
  END IF;

  RETURN COALESCE(_balance, 0) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_free_ai_usage_after_call(
  _user_id uuid,
  _usd_cents integer,
  _source text DEFAULT 'ai',
  _detail jsonb DEFAULT NULL::jsonb,
  _fixed_credits integer DEFAULT NULL
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
  free_cap constant integer := 100;
BEGIN
  add_cents := GREATEST(1, LEAST(COALESCE(_usd_cents, 0), 500));
  src := NULLIF(btrim(COALESCE(_source, '')), '');
  IF src IS NULL THEN
    src := 'ai';
  END IF;
  detail := COALESCE(_detail, '{}'::jsonb);

  INSERT INTO public.user_credits (user_id, balance, current_plan, free_ai_usage_usd_cents)
  VALUES (_user_id, 20, 'free', 0)
  ON CONFLICT (user_id) DO NOTHING;

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
      free_ai_usage_usd_cents = LEAST(free_cap, COALESCE(free_ai_usage_usd_cents, 0) + add_cents),
      updated_at = now()
    WHERE user_id = _user_id;

    BEGIN
      INSERT INTO public.credit_usage_log (user_id, source, credits_delta, usd_cents, detail)
      VALUES (_user_id, src, 0, add_cents, detail);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'credit_usage_log insert skipped: %', SQLERRM;
    END;
    RETURN;
  END IF;

  IF _fixed_credits IS NOT NULL AND _fixed_credits > 0 THEN
    deduct := GREATEST(1, LEAST(bal, _fixed_credits));
  ELSE
    deduct := GREATEST(1, LEAST(bal, CEIL(add_cents::numeric * 4)));
  END IF;

  UPDATE public.user_credits
  SET
    balance = GREATEST(0, balance - deduct),
    updated_at = now()
  WHERE user_id = _user_id;

  BEGIN
    INSERT INTO public.credit_usage_log (user_id, source, credits_delta, usd_cents, detail)
    VALUES (
      _user_id,
      src,
      -deduct,
      add_cents,
      detail || jsonb_build_object('credits_charged', deduct, 'pricing_version', 2)
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'credit_usage_log insert skipped: %', SQLERRM;
  END;
END;
$$;

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
