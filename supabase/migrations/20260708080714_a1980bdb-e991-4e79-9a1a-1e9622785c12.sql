-- Add marketing/newsletter consent tracking to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz;

-- Update the new-user handler to persist consent captured at signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _consent boolean := COALESCE((NEW.raw_user_meta_data ->> 'marketing_consent')::boolean, false);
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url, marketing_consent, marketing_consent_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url',
    _consent,
    CASE WHEN _consent THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO UPDATE
    SET marketing_consent = EXCLUDED.marketing_consent,
        marketing_consent_at = EXCLUDED.marketing_consent_at;
  RETURN NEW;
END;
$function$;