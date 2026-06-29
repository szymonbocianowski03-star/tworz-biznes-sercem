ALTER TABLE public.generated_videos
  ADD COLUMN IF NOT EXISTS runway_task_id TEXT;