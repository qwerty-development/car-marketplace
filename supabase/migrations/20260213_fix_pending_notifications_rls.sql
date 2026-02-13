-- ============================================================
-- MIGRATION: Make trigger functions SECURITY DEFINER
-- Purpose: Fix RLS error 42501 on pending_notifications table
-- Date: 2026-02-13
--
-- Problem: Trigger functions that INSERT into pending_notifications
-- run as the calling user (dealer/user), but the only RLS policy
-- on that table requires is_admin(). This blocks all notification
-- inserts from triggers.
--
-- Fix: SECURITY DEFINER makes these functions run as the DB owner,
-- bypassing RLS. SET search_path = public prevents search-path attacks.
-- ============================================================

-- 1. handle_car_sold
-- Trigger: fires when cars.status changes to 'sold'
-- Action: notifies users who favorited the car + archives autoclips
CREATE OR REPLACE FUNCTION public.handle_car_sold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'sold' AND OLD.status != 'sold' THEN
    -- Send notification to users who favorited the car
    INSERT INTO pending_notifications (user_id, type, data)
    SELECT u.id, 'car_sold', json_build_object(
      'carId', NEW.id,
      'soldCarIds', array[NEW.id],
      'screen', '/(home)/(user)/Favorite',
      'title', '💫 Car Sold Update',
      'message', 'The ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model || ' you liked has been sold!'
    )
    FROM users u
    WHERE NEW.id = ANY(u.favorite);

    -- Update the status of related autoclips to 'archived'
    UPDATE auto_clips
    SET status = 'archived'
    WHERE car_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;


-- 2. handle_car_price_change
-- Trigger: fires when cars.price changes
-- Action: notifies users who favorited the car about price change
CREATE OR REPLACE FUNCTION public.handle_car_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  price_difference NUMERIC;
BEGIN
  RAISE NOTICE 'handle_car_price_change triggered. carId: %, old price: %, new price: %', NEW.id, OLD.price, NEW.price;
  IF NEW.price != OLD.price THEN
    price_difference := NEW.price - OLD.price;
    INSERT INTO pending_notifications (user_id, type, data)
    SELECT u.id, 'price_drop', json_build_object(
      'carId', NEW.id,
      'screen', '/(home)/(user)/Favorite',
      'title', '💲 Price Change Alert',
      'message', 'The price of the ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model ||
        ' you liked has ' || CASE WHEN price_difference < 0 THEN 'dropped' ELSE 'increased' END ||
        ' by $' || ABS(price_difference) || '!'
    )
    FROM users u
    WHERE NEW.id = ANY(u.favorite);
  END IF;
  RETURN NEW;
END;
$function$;


-- 3. handle_view_milestone
-- Trigger: fires when cars.views crosses 50/100/500/1000
-- Action: notifies users who favorited the car about popularity
CREATE OR REPLACE FUNCTION public.handle_view_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.views >= 50 AND OLD.views < 50 THEN
    INSERT INTO pending_notifications (user_id, type, data)
    SELECT u.id, 'view_milestone', json_build_object('carId', NEW.id, 'milestone', 50, 'screen', '/(home)/(user)/Favorite', 'title', '🎯 Popular Car Alert!', 'message', 'Your favorite ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model || ' has reached 50+ views!')
    FROM users u
    WHERE NEW.id = ANY(u.favorite);
  ELSIF NEW.views >= 100 AND OLD.views < 100 THEN
    INSERT INTO pending_notifications (user_id, type, data)
    SELECT u.id, 'view_milestone', json_build_object('carId', NEW.id, 'milestone', 100, 'screen', '/(home)/(user)/Favorite', 'title', '🎯 Popular Car Alert!', 'message', 'Your favorite ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model || ' has reached 100+ views!')
    FROM users u
    WHERE NEW.id = ANY(u.favorite);
  ELSIF NEW.views >= 500 AND OLD.views < 500 THEN
    INSERT INTO pending_notifications (user_id, type, data)
    SELECT u.id, 'view_milestone', json_build_object('carId', NEW.id, 'milestone', 500, 'screen', '/(home)/(user)/Favorite', 'title', '🎯 Popular Car Alert!', 'message', 'Your favorite ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model || ' has reached 500+ views!')
    FROM users u
    WHERE NEW.id = ANY(u.favorite);
  ELSIF NEW.views >= 1000 AND OLD.views < 1000 THEN
    INSERT INTO pending_notifications (user_id, type, data)
    SELECT u.id, 'view_milestone', json_build_object('carId', NEW.id, 'milestone', 1000, 'screen', '/(home)/(user)/Favorite', 'title', '🎯 Popular Car Alert!', 'message', 'Your favorite ' || NEW.year || ' ' || NEW.make || ' ' || NEW.model || ' has reached 1000+ views!')
    FROM users u
    WHERE NEW.id = ANY(u.favorite);
  END IF;

  RETURN NEW;
END;
$function$;


-- 4. handle_notification_state_change
-- Trigger: fires on pending_notifications INSERT
-- Action: calls process-notifications edge function + deduplicates
CREATE OR REPLACE FUNCTION public.handle_notification_state_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  response http_response;
  duplicate_exists boolean;
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbWhkeGxtd3pkaWt4bXdpdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMwMzM5MDUsImV4cCI6MjAzODYwOTkwNX0.ONVTIDh-5yG7XcZk_UL2KMVYwHQQ3OyIhsXXOMJfoK8';
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pending_notifications
    WHERE user_id = NEW.user_id
    AND type = NEW.type
    AND data->>'message' = NEW.data->>'message'
    AND created_at >= (NEW.created_at - interval '5 seconds')
    AND id != NEW.id
  ) INTO duplicate_exists;

  IF NOT duplicate_exists AND TG_OP = 'INSERT' THEN
    SELECT * INTO response FROM http((
      'POST',
      'https://momhdxlmwzdikxmwittx.supabase.co/functions/v1/process-notifications',
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer ' || v_anon_key)
      ],
      'application/json',
      jsonb_build_object('record', row_to_json(NEW))
    )::http_request);

    IF response.status >= 400 THEN
      INSERT INTO notification_errors (error_details, record)
      VALUES (
        jsonb_build_object('status', response.status, 'response', response.content),
        row_to_json(NEW)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
