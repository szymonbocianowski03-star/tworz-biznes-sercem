-- Plan Growth (399 zł) — kolejność tierów przy apply_plan_credits
CREATE OR REPLACE FUNCTION public.apply_plan_credits(_user_id uuid, _new_plan text, _new_credits integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  plan_rank jsonb := '{"free":0,"starter":500,"pro":2000,"growth":5000,"business":8000,"enterprise":30000}'::jsonb;
  current_plan_credits integer;
BEGIN
  INSERT INTO public.user_credits (user_id, balance, current_plan)
  VALUES (_user_id, 20, 'free') ON CONFLICT (user_id) DO NOTHING;

  SELECT (plan_rank ->> current_plan)::int INTO current_plan_credits
  FROM public.user_credits WHERE user_id = _user_id;

  IF _new_credits > COALESCE(current_plan_credits, 0) THEN
    UPDATE public.user_credits
    SET balance = balance + (_new_credits - COALESCE(current_plan_credits, 0)),
        current_plan = _new_plan, updated_at = now()
    WHERE user_id = _user_id;
  ELSE
    UPDATE public.user_credits
    SET current_plan = _new_plan, updated_at = now()
    WHERE user_id = _user_id;
  END IF;
END; $function$;
