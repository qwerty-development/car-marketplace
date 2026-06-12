-- ============================================================================
-- Migration: Listing Lifecycle (expiry + featured columns)
-- Date: 2026-06-11
-- Description:
--   - Listings expire 2 months (app_config.listing_duration_days) after posting
--     (US-06, US-18): stored expire_at column on cars + cars_rent, set on insert,
--     hourly cron flips status to 'expired' and notifies the owner.
--   - 24h-before warnings for BOTH listing expiry and feature expiry, idempotent
--     via *_warning_sent_at stamp columns (client PDF: "1 day left or same day").
--   - number_plates gains the same boost columns as cars/cars_rent so featured
--     ads cover plates (US-04: cars for sale, rentals, number plates).
--   - feature expiry cron clears boost on all 3 tables + "renew?" notification
--     (replaces the empty expire-boosts edge function).
--   Depends on: 20260611_wallet_system.sql (app_config helpers).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Columns
-- ----------------------------------------------------------------------------
-- featured_wallet_item_id is an audit pointer: SET NULL so wallet rows (and
-- their owner's account) can always be deleted without listings blocking it.
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expiry_warning_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boost_expiry_warning_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS featured_wallet_item_id BIGINT REFERENCES public.wallet_items(id) ON DELETE SET NULL;

ALTER TABLE public.cars_rent
  ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expiry_warning_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boost_expiry_warning_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS featured_wallet_item_id BIGINT REFERENCES public.wallet_items(id) ON DELETE SET NULL;

-- Plates: boost columns (same names as cars/cars_rent so one expiry pass covers
-- all three tables; boost_priority stays populated for old production builds).
ALTER TABLE public.number_plates
  ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_priority INTEGER,
  ADD COLUMN IF NOT EXISTS boost_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boost_expiry_warning_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS featured_wallet_item_id BIGINT REFERENCES public.wallet_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cars.expire_at IS 'Listing removal date (~2 months from posting; app_config.listing_duration_days). Cron flips status to expired.';

-- Partial indexes for the cron scans
CREATE INDEX IF NOT EXISTS idx_cars_expire_at ON public.cars(expire_at) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_cars_rent_expire_at ON public.cars_rent(expire_at) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_cars_boosted ON public.cars(boost_end_date) WHERE is_boosted;
CREATE INDEX IF NOT EXISTS idx_cars_rent_boosted ON public.cars_rent(boost_end_date) WHERE is_boosted;
CREATE INDEX IF NOT EXISTS idx_plates_boosted ON public.number_plates(boost_end_date) WHERE is_boosted;

-- ----------------------------------------------------------------------------
-- 2. Backfill: GRANDFATHER existing live listings with a fresh window.
--    Deliberately NOT listed_at + 60d — that would instantly mass-expire
--    thousands of older live listings the moment the cron first runs.
--    STAGGERED 45–75 days (avg = the 60-day rule): a single shared date would
--    expire the entire current inventory in the same hour two months from now
--    and blast every seller with notifications at once.
-- ----------------------------------------------------------------------------
UPDATE public.cars
   SET expire_at = now() + interval '45 days' + (random() * interval '30 days')
 WHERE status = 'available' AND expire_at IS NULL;

UPDATE public.cars_rent
   SET expire_at = now() + interval '45 days' + (random() * interval '30 days')
 WHERE status = 'available' AND expire_at IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Set expire_at on insert (trigger, so client inserts keep working as-is)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_listing_expire_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expire_at IS NULL THEN
    NEW.expire_at := now() + (public.app_config_numeric('listing_duration_days', 60) || ' days')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cars_set_expire_at ON public.cars;
CREATE TRIGGER trg_cars_set_expire_at
  BEFORE INSERT ON public.cars
  FOR EACH ROW EXECUTE FUNCTION public.set_listing_expire_at();

DROP TRIGGER IF EXISTS trg_cars_rent_set_expire_at ON public.cars_rent;
CREATE TRIGGER trg_cars_rent_set_expire_at
  BEFORE INSERT ON public.cars_rent
  FOR EACH ROW EXECUTE FUNCTION public.set_listing_expire_at();

-- ----------------------------------------------------------------------------
-- 4. Notification helper — rides the existing pending_notifications →
--    handle_notification_state_change → process-notifications pipeline.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._queue_listing_notification(
  p_user_id      TEXT,
  p_type         TEXT,
  p_title        TEXT,
  p_message      TEXT,
  p_screen       TEXT,
  p_listing_type TEXT,
  p_listing_id   BIGINT
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO pending_notifications (user_id, type, data)
  VALUES (
    p_user_id,
    p_type,
    json_build_object(
      'title', p_title,
      'message', p_message,
      'screen', p_screen,
      'listingType', p_listing_type,
      'listingId', p_listing_id
    )
  );
$$;

REVOKE ALL ON FUNCTION public._queue_listing_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. expire_featured_listings — hourly. Clears expired boosts on all 3 tables,
--    notifies the owner with a renew prompt. Replaces the expire-boosts
--    edge function (retire that deployment after applying this migration).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_featured_listings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec     RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR rec IN
    WITH expired AS (
      UPDATE cars
         SET is_boosted = false, boost_priority = NULL, boost_expiry_warning_sent_at = NULL
       WHERE is_boosted AND boost_end_date <= now()
      RETURNING id, make, model, user_id, dealership_id
    )
    SELECT e.id, e.make || ' ' || e.model AS label,
           COALESCE(e.user_id, d.user_id) AS owner_id,
           (e.dealership_id IS NOT NULL) AS is_dealer
      FROM expired e
      LEFT JOIN dealerships d ON d.id = e.dealership_id
  LOOP
    IF rec.owner_id IS NOT NULL THEN
      PERFORM _queue_listing_notification(
        rec.owner_id, 'feature_expired',
        'Featured ad expired',
        'Your featured ad for ' || rec.label || ' has ended. Renew it to stay at the top.',
        CASE WHEN rec.is_dealer THEN '/(home)/(dealer)/(tabs)/' ELSE '/(home)/(user)/(tabs)/MyListings' END,
        'sale', rec.id
      );
    END IF;
    v_count := v_count + 1;
  END LOOP;

  FOR rec IN
    WITH expired AS (
      UPDATE cars_rent
         SET is_boosted = false, boost_priority = NULL, boost_expiry_warning_sent_at = NULL
       WHERE is_boosted AND boost_end_date <= now()
      RETURNING id, make, model, dealership_id
    )
    SELECT e.id, e.make || ' ' || e.model AS label, d.user_id AS owner_id
      FROM expired e
      LEFT JOIN dealerships d ON d.id = e.dealership_id
  LOOP
    IF rec.owner_id IS NOT NULL THEN
      PERFORM _queue_listing_notification(
        rec.owner_id, 'feature_expired',
        'Featured ad expired',
        'Your featured ad for ' || rec.label || ' (rental) has ended. Renew it to stay at the top.',
        '/(home)/(dealer)/(tabs)/', 'rent', rec.id
      );
    END IF;
    v_count := v_count + 1;
  END LOOP;

  FOR rec IN
    WITH expired AS (
      UPDATE number_plates
         SET is_boosted = false, boost_priority = NULL, boost_expiry_warning_sent_at = NULL
       WHERE is_boosted AND boost_end_date <= now()
      RETURNING id, letter, digits, user_id, dealership_id
    )
    SELECT e.id, COALESCE(e.letter, '') || ' ' || COALESCE(e.digits, '') AS label,
           COALESCE(e.user_id, d.user_id) AS owner_id,
           (e.dealership_id IS NOT NULL) AS is_dealer
      FROM expired e
      LEFT JOIN dealerships d ON d.id = e.dealership_id
  LOOP
    IF rec.owner_id IS NOT NULL THEN
      PERFORM _queue_listing_notification(
        rec.owner_id, 'feature_expired',
        'Featured ad expired',
        'Your featured ad for plate ' || rec.label || ' has ended. Renew it to stay at the top.',
        CASE WHEN rec.is_dealer THEN '/(home)/(dealer)/(tabs)/' ELSE '/(home)/(user)/(tabs)/MyListings' END,
        'plate', rec.id
      );
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RAISE LOG 'expire_featured_listings: cleared % boosts', v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_featured_listings() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. expire_listings — hourly. available → expired after expire_at; notify.
--    Expired listings vanish from feeds/search automatically (everything
--    filters status = 'available').
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_listings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec     RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR rec IN
    WITH expired AS (
      UPDATE cars
         SET status = 'expired', date_modified = now()
       WHERE status = 'available' AND expire_at <= now()
      RETURNING id, make, model, user_id, dealership_id
    )
    SELECT e.id, e.make || ' ' || e.model AS label,
           COALESCE(e.user_id, d.user_id) AS owner_id,
           (e.dealership_id IS NOT NULL) AS is_dealer
      FROM expired e
      LEFT JOIN dealerships d ON d.id = e.dealership_id
  LOOP
    IF rec.owner_id IS NOT NULL THEN
      PERFORM _queue_listing_notification(
        rec.owner_id, 'listing_expired',
        'Listing expired',
        'Your listing for ' || rec.label || ' has expired and is no longer visible on Fleet.',
        CASE WHEN rec.is_dealer THEN '/(home)/(dealer)/(tabs)/' ELSE '/(home)/(user)/(tabs)/MyListings' END,
        'sale', rec.id
      );
    END IF;
    v_count := v_count + 1;
  END LOOP;

  FOR rec IN
    WITH expired AS (
      UPDATE cars_rent
         SET status = 'expired', date_modified = now()
       WHERE status = 'available' AND expire_at <= now()
      RETURNING id, make, model, dealership_id
    )
    SELECT e.id, e.make || ' ' || e.model AS label, d.user_id AS owner_id
      FROM expired e
      LEFT JOIN dealerships d ON d.id = e.dealership_id
  LOOP
    IF rec.owner_id IS NOT NULL THEN
      PERFORM _queue_listing_notification(
        rec.owner_id, 'listing_expired',
        'Listing expired',
        'Your rental listing for ' || rec.label || ' has expired and is no longer visible on Fleet.',
        '/(home)/(dealer)/(tabs)/', 'rent', rec.id
      );
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RAISE LOG 'expire_listings: expired % listings', v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_listings() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. send_expiry_warnings — hourly. "1 day left" pushes for listing expiry and
--    feature expiry. Idempotent via *_warning_sent_at stamps.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_expiry_warnings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec     RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Listing expiry warnings (cars + cars_rent)
  FOR rec IN
    WITH w_sale AS (
      UPDATE cars
         SET expiry_warning_sent_at = now()
       WHERE status = 'available'
         AND expire_at > now() AND expire_at <= now() + interval '24 hours'
         AND expiry_warning_sent_at IS NULL
      RETURNING id, make || ' ' || model AS label, user_id, dealership_id
    ), w_rent AS (
      UPDATE cars_rent
         SET expiry_warning_sent_at = now()
       WHERE status = 'available'
         AND expire_at > now() AND expire_at <= now() + interval '24 hours'
         AND expiry_warning_sent_at IS NULL
      RETURNING id, make || ' ' || model AS label, NULL::text AS user_id, dealership_id
    ), all_w AS (
      SELECT id, label, user_id, dealership_id, 'sale'::text AS ltype FROM w_sale
      UNION ALL
      SELECT id, label, user_id, dealership_id, 'rent' FROM w_rent
    )
    SELECT a.id, a.label, COALESCE(a.user_id, d.user_id) AS owner_id,
           (a.dealership_id IS NOT NULL) AS is_dealer, a.ltype
      FROM all_w a
      LEFT JOIN dealerships d ON d.id = a.dealership_id
  LOOP
    IF rec.owner_id IS NOT NULL THEN
      PERFORM _queue_listing_notification(
        rec.owner_id, 'listing_expiring',
        'Listing expires tomorrow',
        'Your listing for ' || rec.label || ' expires within 24 hours.',
        CASE WHEN rec.is_dealer THEN '/(home)/(dealer)/(tabs)/' ELSE '/(home)/(user)/(tabs)/MyListings' END,
        rec.ltype, rec.id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Feature expiry warnings (cars + cars_rent + plates)
  FOR rec IN
    WITH w_cars AS (
      UPDATE cars
         SET boost_expiry_warning_sent_at = now()
       WHERE is_boosted
         AND boost_end_date > now() AND boost_end_date <= now() + interval '24 hours'
         AND boost_expiry_warning_sent_at IS NULL
      RETURNING id, make || ' ' || model AS label, user_id, dealership_id
    ), w_rent AS (
      UPDATE cars_rent
         SET boost_expiry_warning_sent_at = now()
       WHERE is_boosted
         AND boost_end_date > now() AND boost_end_date <= now() + interval '24 hours'
         AND boost_expiry_warning_sent_at IS NULL
      RETURNING id, make || ' ' || model AS label, NULL::text AS user_id, dealership_id
    ), w_plates AS (
      UPDATE number_plates
         SET boost_expiry_warning_sent_at = now()
       WHERE is_boosted
         AND boost_end_date > now() AND boost_end_date <= now() + interval '24 hours'
         AND boost_expiry_warning_sent_at IS NULL
      RETURNING id, 'plate ' || COALESCE(letter, '') || ' ' || COALESCE(digits, '') AS label, user_id, dealership_id
    ), all_w AS (
      SELECT id, label, user_id, dealership_id, 'sale'::text AS ltype FROM w_cars
      UNION ALL
      SELECT id, label, user_id, dealership_id, 'rent' FROM w_rent
      UNION ALL
      SELECT id, label, user_id, dealership_id, 'plate' FROM w_plates
    )
    SELECT a.id, a.label, COALESCE(a.user_id, d.user_id) AS owner_id,
           (a.dealership_id IS NOT NULL) AS is_dealer, a.ltype
      FROM all_w a
      LEFT JOIN dealerships d ON d.id = a.dealership_id
  LOOP
    IF rec.owner_id IS NOT NULL THEN
      PERFORM _queue_listing_notification(
        rec.owner_id, 'feature_expiring',
        'Featured ad ends tomorrow',
        'Your featured ad for ' || rec.label || ' ends within 24 hours. Renew to stay at the top.',
        CASE WHEN rec.is_dealer THEN '/(home)/(dealer)/(tabs)/' ELSE '/(home)/(user)/(tabs)/MyListings' END,
        rec.ltype, rec.id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE LOG 'send_expiry_warnings: queued % warnings', v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.send_expiry_warnings() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. One-time cleanup BEFORE scheduling: silently clear boosts left over from
--    the old credit system that are already past their end date (or have no
--    end date at all). Without this, the first expire_featured_listings run
--    would push "featured ad expired — renew!" notifications to live users for
--    boosts that were never bought under the new wallet.
-- ----------------------------------------------------------------------------
UPDATE public.cars
   SET is_boosted = false, boost_priority = NULL
 WHERE is_boosted AND (boost_end_date IS NULL OR boost_end_date <= now());

UPDATE public.cars_rent
   SET is_boosted = false, boost_priority = NULL
 WHERE is_boosted AND (boost_end_date IS NULL OR boost_end_date <= now());

UPDATE public.number_plates
   SET is_boosted = false, boost_priority = NULL
 WHERE is_boosted AND (boost_end_date IS NULL OR boost_end_date <= now());

-- ----------------------------------------------------------------------------
-- 9. Cron schedules (hourly, staggered)
-- ----------------------------------------------------------------------------
SELECT cron.schedule('expire-featured-listings', '5 * * * *',  'SELECT public.expire_featured_listings()');
SELECT cron.schedule('expire-listings',          '10 * * * *', 'SELECT public.expire_listings()');
SELECT cron.schedule('send-expiry-warnings',     '15 * * * *', 'SELECT public.send_expiry_warnings()');
