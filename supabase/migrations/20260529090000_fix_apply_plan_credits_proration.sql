-- Fix proracji kredytów przy zmianie planu.
-- Wcześniej `plan_rank` zawierał przypadkowe „rangi” (starter:500, pro:2000, growth:5000...),
-- a nie realne kredyty planów, więc przy upgrade naliczała się zła liczba kredytów.
-- Teraz mapa trzyma faktyczne miesięczne kredyty (cennik: 100 kredytów / 1 zł, zgodnie z plans.ts).
CREATE OR REPLACE FUNCTION public.apply_plan_credits(_user_id uuid, _new_plan text, _new_credits integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- Faktyczne miesięczne kredyty każdego planu (PLN * 100). Free traktujemy jako 0 (pula startowa nie jest płatnym przydziałem).
  plan_credits jsonb := '{"free":0,"starter":4900,"pro":14900,"growth":39900,"business":49900,"enterprise":149900}'::jsonb;
  current_plan_credits integer;
BEGIN
  INSERT INTO public.user_credits (user_id, balance, current_plan)
  VALUES (_user_id, 20, 'free') ON CONFLICT (user_id) DO NOTHING;

  SELECT (plan_credits ->> current_plan)::int INTO current_plan_credits
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
