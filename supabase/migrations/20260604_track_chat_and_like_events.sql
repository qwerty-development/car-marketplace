-- Add chat and like event tracking for sale and rental cars.
-- toggle_car_like is NOT modified — tracking is done via separate RPC calls from the frontend.

-- ============================================================
-- CHAT TRACKING — sale cars
-- ============================================================
CREATE OR REPLACE FUNCTION public.track_car_chat(car_id bigint, user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dealership_id BIGINT;
BEGIN
  SELECT dealership_id INTO v_dealership_id FROM cars WHERE id = car_id;
  PERFORM log_listing_event('sale', car_id, v_dealership_id, user_id, 'chat');
END;
$function$;

REVOKE ALL ON FUNCTION public.track_car_chat(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_car_chat(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_car_chat(bigint, text) TO anon;

-- ============================================================
-- CHAT TRACKING — rental cars
-- ============================================================
CREATE OR REPLACE FUNCTION public.track_rent_chat(car_id bigint, user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dealership_id BIGINT;
BEGIN
  SELECT dealership_id INTO v_dealership_id FROM cars_rent WHERE id = car_id;
  PERFORM log_listing_event('rent', car_id, v_dealership_id, user_id, 'chat');
END;
$function$;

REVOKE ALL ON FUNCTION public.track_rent_chat(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_rent_chat(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_rent_chat(bigint, text) TO anon;

-- ============================================================
-- LIKE TRACKING — sale cars (called from frontend after toggle_car_like succeeds)
-- dealership_id is looked up inside; NULL for user-listed cars (private sellers)
-- ============================================================
CREATE OR REPLACE FUNCTION public.track_car_like(car_id bigint, user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dealership_id BIGINT;
BEGIN
  SELECT dealership_id INTO v_dealership_id FROM cars WHERE id = car_id;
  PERFORM log_listing_event('sale', car_id, v_dealership_id, user_id, 'like');
END;
$function$;

REVOKE ALL ON FUNCTION public.track_car_like(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_car_like(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_car_like(bigint, text) TO anon;
