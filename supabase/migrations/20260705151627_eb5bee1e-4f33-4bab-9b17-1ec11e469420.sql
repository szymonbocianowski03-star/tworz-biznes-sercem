REVOKE ALL ON FUNCTION public.assert_can_use_free_ai(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_free_ai_usage_after_call(uuid, integer, text, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_free_ai_usage_after_call(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_plan_credits(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_credits(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_user_credits() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assert_can_use_free_ai(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_free_ai_usage_after_call(uuid, integer, text, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_free_ai_usage_after_call(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_plan_credits(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_credits() TO authenticated, service_role;