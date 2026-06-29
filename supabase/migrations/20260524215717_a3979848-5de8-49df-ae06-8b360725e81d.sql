
-- 1) cc_launch_job: restrict client UPDATE to cancel_requested only
DROP POLICY IF EXISTS cc_launch_job_all ON public.cc_launch_job;

CREATE POLICY cc_launch_job_select ON public.cc_launch_job
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY cc_launch_job_insert ON public.cc_launch_job
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY cc_launch_job_delete ON public.cc_launch_job
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY cc_launch_job_update_owner ON public.cc_launch_job
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY cc_launch_job_service_all ON public.cc_launch_job
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Trigger: block non-service-role from changing anything except cancel_requested
CREATE OR REPLACE FUNCTION public.cc_launch_job_guard_client_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.attempt IS DISTINCT FROM OLD.attempt
     OR NEW.max_attempts IS DISTINCT FROM OLD.max_attempts
     OR NEW.next_run_at IS DISTINCT FROM OLD.next_run_at
     OR NEW.last_error IS DISTINCT FROM OLD.last_error
     OR NEW.draft_id IS DISTINCT FROM OLD.draft_id
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.intent IS DISTINCT FROM OLD.intent
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Only cancel_requested may be modified by clients on cc_launch_job';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cc_launch_job_guard_client_updates ON public.cc_launch_job;
CREATE TRIGGER cc_launch_job_guard_client_updates
  BEFORE UPDATE ON public.cc_launch_job
  FOR EACH ROW EXECUTE FUNCTION public.cc_launch_job_guard_client_updates();

-- 2) suppressed_emails: explicit restrictive deny for UPDATE/DELETE by anon/authenticated
CREATE POLICY suppressed_emails_no_user_update ON public.suppressed_emails
  AS RESTRICTIVE
  FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY suppressed_emails_no_user_delete ON public.suppressed_emails
  AS RESTRICTIVE
  FOR DELETE TO anon, authenticated
  USING (false);
