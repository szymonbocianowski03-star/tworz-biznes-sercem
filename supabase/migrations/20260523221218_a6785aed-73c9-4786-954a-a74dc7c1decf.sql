
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY cc_asset_variant_update
  ON public.cc_asset_variant FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.cc_asset a WHERE a.id = cc_asset_variant.asset_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cc_asset a WHERE a.id = cc_asset_variant.asset_id AND a.user_id = auth.uid()));

CREATE POLICY cc_launch_job_item_insert ON public.cc_launch_job_item FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.cc_launch_job j WHERE j.id = cc_launch_job_item.job_id AND j.user_id = auth.uid()));
CREATE POLICY cc_launch_job_item_update ON public.cc_launch_job_item FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.cc_launch_job j WHERE j.id = cc_launch_job_item.job_id AND j.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cc_launch_job j WHERE j.id = cc_launch_job_item.job_id AND j.user_id = auth.uid()));
CREATE POLICY cc_launch_job_item_delete ON public.cc_launch_job_item FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.cc_launch_job j WHERE j.id = cc_launch_job_item.job_id AND j.user_id = auth.uid()));

CREATE POLICY "Users update own generated images" ON public.generated_images FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.assert_can_use_free_ai(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_free_ai_usage_after_call(uuid, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_free_ai_usage_after_call(uuid, integer, text, jsonb, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_plan_credits(uuid, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_user_credits() FROM anon;

DROP POLICY IF EXISTS "Public read generations" ON storage.objects;
CREATE POLICY "Owners list own generations" ON storage.objects FOR SELECT
  USING (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);
