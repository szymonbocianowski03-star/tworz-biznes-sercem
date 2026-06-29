-- Rozliczenie kredytów od rzeczywistego kosztu API (centy USD × 4).
-- 100 kred. ≈ $0,25 kosztu API (zgodnie z creditEconomy / plans.ts).

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
      free_ai_usage_usd_cents = LEAST(100, COALESCE(free_ai_usage_usd_cents, 0) + add_cents),
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
      detail || jsonb_build_object('credits_charged', deduct)
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'credit_usage_log insert skipped: %', SQLERRM;
  END;
END;
$$;
