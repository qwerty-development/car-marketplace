-- Add seller_user_id to listing_analytics_events so we can track analytics
-- for user-listed (private seller) cars and plates.
-- log_listing_event looks it up internally — no changes needed to any tracking function.

ALTER TABLE public.listing_analytics_events
  ADD COLUMN IF NOT EXISTS seller_user_id text;

-- Update log_listing_event to populate seller_user_id automatically.
-- Signature is unchanged so all existing tracking function calls are unaffected.
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
AS $function$
DECLARE
  v_seller_user_id text;
BEGIN
  -- Look up the private seller's user_id from the listing.
  -- cars_rent is always dealership-owned so it has no user_id.
  IF p_listing_type = 'sale' THEN
    SELECT user_id INTO v_seller_user_id FROM cars WHERE id = p_listing_id;
  ELSIF p_listing_type = 'plate' THEN
    SELECT user_id INTO v_seller_user_id FROM number_plates WHERE id = p_listing_id;
  END IF;

  INSERT INTO public.listing_analytics_events
    (listing_type, listing_id, dealership_id, seller_user_id, viewer_id, event_type, metadata)
  VALUES
    (p_listing_type, p_listing_id, p_dealership_id,
     NULLIF(trim(COALESCE(v_seller_user_id, '')), ''),
     NULLIF(trim(COALESCE(p_viewer_id, '')), ''),
     p_event_type,
     COALESCE(p_metadata, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_listing_event failed: %', SQLERRM;
END;
$function$;

REVOKE ALL ON FUNCTION public.log_listing_event(text, bigint, bigint, text, text, jsonb) FROM PUBLIC;
