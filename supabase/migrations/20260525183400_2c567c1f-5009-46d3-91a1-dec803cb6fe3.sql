-- Helper: zmiana planu po e-mailu (do użycia z panelu bazy danych)
CREATE OR REPLACE FUNCTION public.admin_set_plan_by_email(
  _email text,
  _plan text,
  _credits integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika o e-mailu %', _email;
  END IF;

  PERFORM public.apply_plan_credits(_uid, _plan, _credits);
  RETURN format('OK: plan=%s, credits>=%s dla %s (%s)', _plan, _credits, _email, _uid);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_plan_by_email(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_plan_by_email(text, text, integer) TO service_role;