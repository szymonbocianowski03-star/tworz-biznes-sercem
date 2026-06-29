GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_images TO authenticated;
GRANT ALL ON public.generated_images TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_videos TO authenticated;
GRANT ALL ON public.generated_videos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cc_asset TO authenticated;
GRANT ALL ON public.cc_asset TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cc_asset_variant TO authenticated;
GRANT ALL ON public.cc_asset_variant TO service_role;