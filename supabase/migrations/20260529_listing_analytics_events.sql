-- ============================================================
-- Listing Analytics Events — polymorphic, timestamped event log
-- ============================================================
-- One source of truth for view/call/whatsapp/chat activity across ALL listing
-- types (sale cars, rental cars, number plates). Existing counters
-- (cars.call_count, .views, cars_rent.*, number_plates.views) are kept and
-- updated in the SAME transaction so dealer-facing counters and admin-facing
-- time series reconcile by construction.
--
-- WHY: contacts/views were stored as running counters with NO timestamps, so
-- day/week/month breakdowns were impossible. This adds the missing event grain.
-- NO historical backfill is possible — time series begin at apply time.
--
-- SEMANTICS:
--   Views: TOTAL counting (every open increments) — matches deployed Apr-30
--     behaviour. viewed_users array is still maintained for unique-viewer info.
--     Event log receives one row per open, so COUNT(view events) == views counter.
--   Contacts (call/whatsapp): UNIQUE per user — matches existing call_count /
--     whatsapp_count semantics. Event logged only on first contact by that user.
--
-- NOTE: fleet-webapp/db/migrations/fix_analytics_discrepancies.sql (FIX 1-3)
-- switches views to unique counting. Do NOT apply FIX 1-3 from that file —
-- only apply FIX 4 (toggle_car_like) + FIX 5 counter reconciliation.
-- This migration supersedes FIX 1-3 and preserves total view counting.
--
-- Pattern mirrors public.banner_analytics (RLS-locked, writes via SECURITY
-- DEFINER RPCs only).
-- ============================================================

-- 1. The event table -----------------------------------------
CREATE TABLE IF NOT EXISTS public.listing_analytics_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_type  text NOT NULL CHECK (listing_type IN ('sale', 'rent', 'plate')),
  listing_id    bigint NOT NULL,
  dealership_id bigint,                                   -- nullable: user-owned plates have none
  viewer_id     text,                                     -- user uuid OR guest id; null = anonymous
  viewer_type   text CHECK (viewer_type IN ('user', 'guest')),
  event_type    text NOT NULL CHECK (event_type IN ('view', 'call', 'whatsapp', 'chat', 'like')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lae_dealership_event_time
  ON public.listing_analytics_events (dealership_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_lae_listing
  ON public.listing_analytics_events (listing_type, listing_id, created_at);
CREATE INDEX IF NOT EXISTS idx_lae_created_at
  ON public.listing_analytics_events (created_at);

ALTER TABLE public.listing_analytics_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_analytics_events FROM anon, authenticated;

-- 2. Internal logging helper (not exposed to clients) --------
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
  -- Analytics logging must never break the user-facing action.
  RAISE WARNING 'log_listing_event failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.log_listing_event(text, bigint, bigint, text, text, jsonb) FROM PUBLIC;

-- ============================================================
-- 3. SALE CARS — TOTAL view counting (every open) + UNIQUE contact counting
--    Views: every open increments (matches deployed Apr-30 behaviour).
--    Contacts: unique per user (matches existing call_count / whatsapp_count).
-- ============================================================

CREATE OR REPLACE FUNCTION public.track_car_view(car_id integer, user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  updated_views INT;
  is_new_unique BOOLEAN := FALSE;
  v_dealership_id BIGINT;
BEGIN
  IF track_car_view.user_id IS NOT NULL AND track_car_view.user_id <> '' THEN
    SELECT NOT (track_car_view.user_id = ANY(COALESCE(c.viewed_users, ARRAY[]::text[])))
    INTO is_new_unique
    FROM cars c
    WHERE c.id = track_car_view.car_id;
  END IF;

  UPDATE cars
  SET views = COALESCE(views, 0) + 1,
      viewed_users = CASE
        WHEN COALESCE(is_new_unique, FALSE) THEN
          CASE
            WHEN viewed_users IS NULL THEN ARRAY[track_car_view.user_id]::text[]
            ELSE array_append(viewed_users, track_car_view.user_id)
          END
        ELSE viewed_users
      END
  WHERE id = track_car_view.car_id
  RETURNING views, dealership_id INTO updated_views, v_dealership_id;

  PERFORM log_listing_event('sale', track_car_view.car_id::bigint, v_dealership_id,
                            track_car_view.user_id, 'view');

  RETURN COALESCE(updated_views, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_car_call(car_id bigint, user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  updated_calls INT;
  already_called BOOLEAN;
  v_dealership_id BIGINT;
BEGIN
  SELECT track_car_call.user_id = ANY(COALESCE(c.call_users::text[], ARRAY[]::text[])), c.dealership_id
  INTO already_called, v_dealership_id
  FROM cars c
  WHERE c.id = track_car_call.car_id;

  IF NOT COALESCE(already_called, FALSE) THEN
    UPDATE cars
    SET call_users = array_append(COALESCE(cars.call_users::text[], ARRAY[]::text[]), track_car_call.user_id),
        call_count = COALESCE(cars.call_count, 0) + 1
    WHERE cars.id = track_car_call.car_id;

    PERFORM log_listing_event('sale', track_car_call.car_id, v_dealership_id,
                              track_car_call.user_id, 'call');
  END IF;

  SELECT call_count INTO updated_calls FROM cars WHERE id = track_car_call.car_id;
  RETURN COALESCE(updated_calls, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_car_whatsapp(car_id bigint, user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  updated_whatsapp INT;
  already_messaged BOOLEAN;
  v_dealership_id BIGINT;
BEGIN
  SELECT track_car_whatsapp.user_id = ANY(COALESCE(c.whatsapp_users::text[], ARRAY[]::text[])), c.dealership_id
  INTO already_messaged, v_dealership_id
  FROM cars c
  WHERE c.id = track_car_whatsapp.car_id;

  IF NOT COALESCE(already_messaged, FALSE) THEN
    UPDATE cars
    SET whatsapp_users = array_append(COALESCE(cars.whatsapp_users::text[], ARRAY[]::text[]), track_car_whatsapp.user_id),
        whatsapp_count = COALESCE(cars.whatsapp_count, 0) + 1
    WHERE cars.id = track_car_whatsapp.car_id;

    PERFORM log_listing_event('sale', track_car_whatsapp.car_id, v_dealership_id,
                              track_car_whatsapp.user_id, 'whatsapp');
  END IF;

  SELECT whatsapp_count INTO updated_whatsapp FROM cars WHERE id = track_car_whatsapp.car_id;
  RETURN COALESCE(updated_whatsapp, 0);
END;
$function$;

-- ============================================================
-- 4. RENTAL CARS — TOTAL view counting + UNIQUE contact counting + event logging
--    (rentals previously (mis)used track_car_call/whatsapp, which write to `cars`)
-- ============================================================

CREATE OR REPLACE FUNCTION public.track_cars_view_rent(car_id integer, user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_views INT;
  is_new_unique BOOLEAN := FALSE;
  v_dealership_id BIGINT;
BEGIN
  IF track_cars_view_rent.user_id IS NOT NULL AND track_cars_view_rent.user_id <> '' THEN
    SELECT NOT (track_cars_view_rent.user_id = ANY(COALESCE(cr.viewed_users, ARRAY[]::text[])))
    INTO is_new_unique
    FROM cars_rent cr
    WHERE cr.id = track_cars_view_rent.car_id;
  END IF;

  UPDATE cars_rent
  SET views = COALESCE(views, 0) + 1,
      viewed_users = CASE
        WHEN COALESCE(is_new_unique, FALSE) THEN
          CASE
            WHEN viewed_users IS NULL THEN ARRAY[track_cars_view_rent.user_id]::text[]
            ELSE array_append(viewed_users, track_cars_view_rent.user_id)
          END
        ELSE viewed_users
      END
  WHERE id = track_cars_view_rent.car_id
  RETURNING views, dealership_id INTO updated_views, v_dealership_id;

  PERFORM log_listing_event('rent', track_cars_view_rent.car_id::bigint, v_dealership_id,
                            track_cars_view_rent.user_id, 'view');

  RETURN COALESCE(updated_views, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_car_view_rent(car_id integer, user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_views INT;
  is_new_unique BOOLEAN := FALSE;
  v_dealership_id BIGINT;
BEGIN
  IF track_car_view_rent.user_id IS NOT NULL AND track_car_view_rent.user_id <> '' THEN
    SELECT NOT (track_car_view_rent.user_id = ANY(COALESCE(cr.viewed_users, ARRAY[]::text[])))
    INTO is_new_unique
    FROM cars_rent cr
    WHERE cr.id = track_car_view_rent.car_id;
  END IF;

  UPDATE cars_rent
  SET views = COALESCE(views, 0) + 1,
      viewed_users = CASE
        WHEN COALESCE(is_new_unique, FALSE) THEN
          CASE
            WHEN viewed_users IS NULL THEN ARRAY[track_car_view_rent.user_id]::text[]
            ELSE array_append(viewed_users, track_car_view_rent.user_id)
          END
        ELSE viewed_users
      END
  WHERE id = track_car_view_rent.car_id
  RETURNING views, dealership_id INTO updated_views, v_dealership_id;

  PERFORM log_listing_event('rent', track_car_view_rent.car_id::bigint, v_dealership_id,
                            track_car_view_rent.user_id, 'view');

  RETURN COALESCE(updated_views, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_rent_call(car_id bigint, user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  updated_calls INT;
  already_called BOOLEAN;
  v_dealership_id BIGINT;
BEGIN
  SELECT track_rent_call.user_id = ANY(COALESCE(cr.call_users::text[], ARRAY[]::text[])), cr.dealership_id
  INTO already_called, v_dealership_id
  FROM cars_rent cr
  WHERE cr.id = track_rent_call.car_id;

  IF NOT COALESCE(already_called, FALSE) THEN
    UPDATE cars_rent
    SET call_users = array_append(COALESCE(cars_rent.call_users::text[], ARRAY[]::text[]), track_rent_call.user_id),
        call_count = COALESCE(cars_rent.call_count, 0) + 1
    WHERE cars_rent.id = track_rent_call.car_id;

    PERFORM log_listing_event('rent', track_rent_call.car_id, v_dealership_id,
                              track_rent_call.user_id, 'call');
  END IF;

  SELECT call_count INTO updated_calls FROM cars_rent WHERE id = track_rent_call.car_id;
  RETURN COALESCE(updated_calls, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_rent_whatsapp(car_id bigint, user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  updated_whatsapp INT;
  already_messaged BOOLEAN;
  v_dealership_id BIGINT;
BEGIN
  SELECT track_rent_whatsapp.user_id = ANY(COALESCE(cr.whatsapp_users::text[], ARRAY[]::text[])), cr.dealership_id
  INTO already_messaged, v_dealership_id
  FROM cars_rent cr
  WHERE cr.id = track_rent_whatsapp.car_id;

  IF NOT COALESCE(already_messaged, FALSE) THEN
    UPDATE cars_rent
    SET whatsapp_users = array_append(COALESCE(cars_rent.whatsapp_users::text[], ARRAY[]::text[]), track_rent_whatsapp.user_id),
        whatsapp_count = COALESCE(cars_rent.whatsapp_count, 0) + 1
    WHERE cars_rent.id = track_rent_whatsapp.car_id;

    PERFORM log_listing_event('rent', track_rent_whatsapp.car_id, v_dealership_id,
                              track_rent_whatsapp.user_id, 'whatsapp');
  END IF;

  SELECT whatsapp_count INTO updated_whatsapp FROM cars_rent WHERE id = track_rent_whatsapp.car_id;
  RETURN COALESCE(updated_whatsapp, 0);
END;
$function$;

-- ============================================================
-- 5. NUMBER PLATES — TOTAL view counting (unchanged) + logging,
--    plus event-only contact RPCs (no contact counter columns)
-- ============================================================

CREATE OR REPLACE FUNCTION public.track_number_plate_view(plate_id integer, user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_variable
DECLARE
  updated_views INT;
  v_dealership_id BIGINT;
BEGIN
  UPDATE number_plates np
  SET viewed_users = CASE
        WHEN np.viewed_users IS NULL THEN ARRAY[user_id]::text[]
        WHEN NOT (user_id = ANY(np.viewed_users)) THEN array_append(np.viewed_users, user_id)
        ELSE np.viewed_users
      END
  WHERE np.id = plate_id;

  UPDATE number_plates np
  SET views = COALESCE(np.views, 0) + 1
  WHERE np.id = plate_id
  RETURNING np.views, np.dealership_id INTO updated_views, v_dealership_id;

  PERFORM log_listing_event('plate', plate_id::bigint, v_dealership_id, user_id, 'view');

  RETURN updated_views;
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_plate_call(plate_id integer, user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dealership_id BIGINT;
BEGIN
  SELECT dealership_id INTO v_dealership_id FROM number_plates WHERE id = plate_id;
  PERFORM log_listing_event('plate', plate_id::bigint, v_dealership_id, user_id, 'call');
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_plate_whatsapp(plate_id integer, user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dealership_id BIGINT;
BEGIN
  SELECT dealership_id INTO v_dealership_id FROM number_plates WHERE id = plate_id;
  PERFORM log_listing_event('plate', plate_id::bigint, v_dealership_id, user_id, 'whatsapp');
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_plate_chat(plate_id integer, user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dealership_id BIGINT;
BEGIN
  SELECT dealership_id INTO v_dealership_id FROM number_plates WHERE id = plate_id;
  PERFORM log_listing_event('plate', plate_id::bigint, v_dealership_id, user_id, 'chat');
END;
$function$;

-- Client roles must be able to call the tracking RPCs
GRANT EXECUTE ON FUNCTION public.track_car_view(integer, text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_car_call(bigint, text)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_car_whatsapp(bigint, text)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_cars_view_rent(integer, text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_car_view_rent(integer, text)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_rent_call(bigint, text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_rent_whatsapp(bigint, text)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_number_plate_view(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_plate_call(integer, text)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_plate_whatsapp(integer, text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_plate_chat(integer, text)       TO anon, authenticated;
