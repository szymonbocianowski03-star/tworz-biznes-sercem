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

  -- Uzupełnij saldo do pełnej, reklamowanej puli planu (nie zmniejsza istniejącego większego salda).
  UPDATE public.user_credits
  SET balance = GREATEST(COALESCE(balance, 0), COALESCE(_new_credits, 0)),
      current_plan = COALESCE(_new_plan, current_plan),
      updated_at = now()
  WHERE user_id = _user_id;
END;
$function$