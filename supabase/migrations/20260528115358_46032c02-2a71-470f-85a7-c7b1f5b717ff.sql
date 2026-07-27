-- Restrict profiles SELECT to owner only
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add UPDATE policy on generations bucket scoped to owner folder
CREATE POLICY "Users update own files in generations"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'generations' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'generations' AND (auth.uid())::text = (storage.foldername(name))[1]);
