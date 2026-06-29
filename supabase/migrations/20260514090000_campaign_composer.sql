-- Campaign Composer / Launch Center — model domenowy (workspace, drafty, asset, job, audyt)
-- Prefix: cc_

CREATE TABLE public.cc_workspace (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Przestrzeń',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE public.cc_ad_account_binding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.cc_workspace(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'linkedin')),
  meta_connection_id UUID REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  linkedin_connection_id UUID REFERENCES public.linkedin_connections(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  display_label TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cc_ad_account_binding_provider_fk CHECK (
    (provider = 'meta' AND meta_connection_id IS NOT NULL AND linkedin_connection_id IS NULL)
    OR (provider = 'linkedin' AND linkedin_connection_id IS NOT NULL AND meta_connection_id IS NULL)
  )
);

CREATE INDEX idx_cc_ad_account_binding_workspace ON public.cc_ad_account_binding(workspace_id);
CREATE INDEX idx_cc_ad_account_binding_user ON public.cc_ad_account_binding(user_id);

CREATE TABLE public.cc_campaign_collection (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.cc_workspace(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  provider_filter TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_campaign_collection_workspace ON public.cc_campaign_collection(workspace_id);

CREATE TABLE public.cc_campaign_draft (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.cc_workspace(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'linkedin')),
  composer_mode TEXT NOT NULL DEFAULT 'create_new',
  source_draft_id UUID REFERENCES public.cc_campaign_draft(id) ON DELETE SET NULL,
  lifecycle TEXT NOT NULL DEFAULT 'draft',
  sync_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  draft_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_campaign_draft_user ON public.cc_campaign_draft(user_id);
CREATE INDEX idx_cc_campaign_draft_workspace ON public.cc_campaign_draft(workspace_id);
CREATE INDEX idx_cc_campaign_draft_lifecycle ON public.cc_campaign_draft(lifecycle);

CREATE TRIGGER update_cc_campaign_draft_updated_at
  BEFORE UPDATE ON public.cc_campaign_draft
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cc_collection_member (
  collection_id UUID NOT NULL REFERENCES public.cc_campaign_collection(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES public.cc_campaign_draft(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, draft_id)
);

CREATE TABLE public.cc_asset (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.cc_workspace(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('generated_images', 'upload', 'url')),
  source_ref TEXT,
  display_name TEXT,
  public_url TEXT NOT NULL,
  alt_text TEXT,
  channels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  provider_asset_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_asset_workspace ON public.cc_asset(workspace_id);

CREATE TABLE public.cc_asset_variant (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.cc_asset(id) ON DELETE CASCADE,
  ratio_key TEXT NOT NULL,
  public_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cc_launch_job (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.cc_campaign_draft(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  intent TEXT NOT NULL DEFAULT 'go_live' CHECK (intent IN ('draft_only', 'go_live')),
  status TEXT NOT NULL DEFAULT 'queued',
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_run_at TIMESTAMPTZ,
  last_error JSONB,
  cancel_requested BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_launch_job_status_next ON public.cc_launch_job(status, next_run_at);
CREATE INDEX idx_cc_launch_job_draft ON public.cc_launch_job(draft_id);

CREATE TRIGGER update_cc_launch_job_updated_at
  BEFORE UPDATE ON public.cc_launch_job
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cc_launch_job_item (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.cc_launch_job(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT,
  status TEXT NOT NULL,
  provider_message TEXT,
  provider_payload JSONB,
  retry_available BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_launch_job_item_job ON public.cc_launch_job_item(job_id);

CREATE TABLE public.cc_preview_snapshot (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.cc_campaign_draft(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  payload JSONB NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cc_audit_event (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.cc_workspace(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_audit_workspace ON public.cc_audit_event(workspace_id, created_at DESC);

-- RLS
ALTER TABLE public.cc_workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_ad_account_binding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_campaign_collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_campaign_draft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_collection_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_asset_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_launch_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_launch_job_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_preview_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_audit_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY cc_workspace_select ON public.cc_workspace FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY cc_workspace_insert ON public.cc_workspace FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY cc_workspace_update ON public.cc_workspace FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY cc_workspace_delete ON public.cc_workspace FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY cc_ad_account_binding_all ON public.cc_ad_account_binding FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY cc_campaign_collection_all ON public.cc_campaign_collection FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY cc_campaign_draft_all ON public.cc_campaign_draft FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY cc_collection_member_select ON public.cc_collection_member FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cc_campaign_collection c WHERE c.id = collection_id AND c.user_id = auth.uid())
);
CREATE POLICY cc_collection_member_write ON public.cc_collection_member FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.cc_campaign_collection c WHERE c.id = collection_id AND c.user_id = auth.uid())
);
CREATE POLICY cc_collection_member_delete ON public.cc_collection_member FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.cc_campaign_collection c WHERE c.id = collection_id AND c.user_id = auth.uid())
);

CREATE POLICY cc_asset_all ON public.cc_asset FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY cc_asset_variant_select ON public.cc_asset_variant FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cc_asset a WHERE a.id = asset_id AND a.user_id = auth.uid())
);
CREATE POLICY cc_asset_variant_write ON public.cc_asset_variant FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.cc_asset a WHERE a.id = asset_id AND a.user_id = auth.uid())
);
CREATE POLICY cc_asset_variant_delete ON public.cc_asset_variant FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.cc_asset a WHERE a.id = asset_id AND a.user_id = auth.uid())
);

CREATE POLICY cc_launch_job_all ON public.cc_launch_job FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY cc_launch_job_item_select ON public.cc_launch_job_item FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.cc_launch_job j WHERE j.id = job_id AND j.user_id = auth.uid())
);

CREATE POLICY cc_preview_snapshot_all ON public.cc_preview_snapshot FOR ALL USING (
  EXISTS (SELECT 1 FROM public.cc_campaign_draft d WHERE d.id = draft_id AND d.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.cc_campaign_draft d WHERE d.id = draft_id AND d.user_id = auth.uid())
);

CREATE POLICY cc_audit_event_all ON public.cc_audit_event FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role (worker) wstawia job_item; worker używa service role i omija RLS.
-- Użytkownik czyta job_item przez SELECT powyżej.

-- Opcjonalnie: pierwszy workspace na żądanie z aplikacji (aplikacja wywołuje ensureWorkspace).
