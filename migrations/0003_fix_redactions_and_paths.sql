-- Fix redactions schema mismatches and ensure path compatibility
ALTER TABLE public.redactions
ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.redactions r
SET user_id = f.user_id
FROM public.files f
WHERE r.file_id = f.id
  AND r.user_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'redactions'
      AND policyname = 'redactions_own'
  ) THEN
    EXECUTE $$
      CREATE POLICY redactions_own ON public.redactions
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
    $$;
  END IF;
END $$;

ALTER TABLE public.files
ADD COLUMN IF NOT EXISTS storage_path text;

UPDATE public.files
SET storage_path = COALESCE(storage_path, s3_key_original);
