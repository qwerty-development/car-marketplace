-- track_car_view + track_cars_view_rent / track_car_view_rent
-- Switch the `views` column to a TOTAL view counter (every call increments)
-- while still tracking unique viewer ids in the `viewed_users` array.
-- Listing-level "views" now reflect how many times the listing was opened,
-- not how many distinct accounts opened it. Unique viewer count can still be
-- derived from `array_length(viewed_users, 1)`.

CREATE OR REPLACE FUNCTION public.track_car_view(car_id integer, user_id text)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  updated_views INT;
  is_new_unique BOOLEAN := FALSE;
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
  RETURNING views INTO updated_views;

  RETURN COALESCE(updated_views, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.track_cars_view_rent(car_id integer, user_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_views INT;
  is_new_unique BOOLEAN := FALSE;
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
  RETURNING views INTO updated_views;

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
  RETURNING views INTO updated_views;

  RETURN COALESCE(updated_views, 0);
END;
$function$;
