-- Naprawa RLS: UPDATE wymaga WITH CHECK, inaczej zapis parametrów integracji może się nie utrwalać.

DROP POLICY IF EXISTS "Users update own meta connections" ON public.meta_connections;
CREATE POLICY "Users update own meta connections"
  ON public.meta_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own linkedin connections" ON public.linkedin_connections;
CREATE POLICY "Users update own linkedin connections"
  ON public.linkedin_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own gcal" ON public.google_calendar_connections;
CREATE POLICY "Users update own gcal"
  ON public.google_calendar_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own outcal" ON public.outlook_calendar_connections;
CREATE POLICY "Users update own outcal"
  ON public.outlook_calendar_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own gmail connection" ON public.gmail_connections;
CREATE POLICY "Users update own gmail connection"
  ON public.gmail_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own outlook connection" ON public.outlook_connections;
CREATE POLICY "Users update own outlook connection"
  ON public.outlook_connections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
