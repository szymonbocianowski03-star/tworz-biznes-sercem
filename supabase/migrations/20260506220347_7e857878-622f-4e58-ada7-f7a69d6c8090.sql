
-- Subscriptions table (Stripe)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages subscriptions" ON public.subscriptions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- User credits balance
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 50,
  current_plan text not null default 'free',
  updated_at timestamptz default now()
);
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages credits" ON public.user_credits FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Initialize credits on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, current_plan)
  VALUES (NEW.id, 50, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

-- Apply plan upgrade: add diff in credits
CREATE OR REPLACE FUNCTION public.apply_plan_credits(_user_id uuid, _new_plan text, _new_credits integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_credits integer;
  plan_rank jsonb := '{"free":0,"starter":500,"pro":2000,"business":8000}'::jsonb;
  current_plan_credits integer;
BEGIN
  INSERT INTO public.user_credits (user_id, balance, current_plan)
  VALUES (_user_id, 50, 'free') ON CONFLICT (user_id) DO NOTHING;

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
END; $$;
