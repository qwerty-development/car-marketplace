-- Internal helper called by all tracking RPCs to insert into listing_analytics_events.
-- Must be applied after 20260529_listing_analytics_events.sql.

CREATE OR REPLACE FUNCTION public.log_listing_event(
  p_listing_type  text,
  p_listing_id    bigint,
  p_dealership_id bigint,
  p_viewer_id     text,
  p_event_type    text,
  p_metadata      jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.listing_analytics_events
    (listing_type, listing_id, dealership_id, viewer_id, event_type, metadata)
  VALUES
    (p_listing_type, p_listing_id, p_dealership_id,
     NULLIF(trim(COALESCE(p_viewer_id, '')), ''), p_event_type,
     COALESCE(p_metadata, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_listing_event failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.log_listing_event(text, bigint, bigint, text, text, jsonb) FROM PUBLIC;
