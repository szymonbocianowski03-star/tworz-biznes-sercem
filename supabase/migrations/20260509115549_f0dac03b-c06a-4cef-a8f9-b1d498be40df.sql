
-- Lower default free credits to 20
ALTER TABLE public.user_credits ALTER COLUMN balance SET DEFAULT 20;

-- Update apply_plan_credits to include enterprise plan and use 20 free
CREATE OR REPLACE FUNCTION public.apply_plan_credits(_user_id uuid, _new_plan text, _new_credits integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  plan_rank jsonb := '{"free":0,"starter":500,"pro":2000,"business":8000,"enterprise":30000}'::jsonb;
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

-- Update new-user trigger to grant 20 not 50
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, current_plan)
  VALUES (NEW.id, 20, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $function$;

-- Track one-time credit pack purchases
CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_session_id text UNIQUE,
  price_id text NOT NULL,
  credits_added integer NOT NULL,
  amount_pln integer NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credit purchases" ON public.credit_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role manages credit purchases" ON public.credit_purchases
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Helper to credit balance for one-time pack
CREATE OR REPLACE FUNCTION public.add_credits(_user_id uuid, _amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, current_plan)
  VALUES (_user_id, 20, 'free') ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.user_credits
    SET balance = balance + _amount, updated_at = now()
    WHERE user_id = _user_id;
END; $function$;
