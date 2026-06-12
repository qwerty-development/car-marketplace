-- ============================================================================
-- Migration: Production hardening patch (post-review fixes)
-- Date: 2026-06-12
-- Description: Fixes from the full-stack review of the v3.0 credit-system
--   release. Everything here patches objects that are ALREADY APPLIED.
--   1. Expiry triggers fire on UPDATE too — closes the "pending at apply time,
--      approved later" gap that left available listings with expire_at NULL
--      (2 such cars live: they would never expire). Includes catch-up stamp.
--   2. expire_wallet_items reclaims slot reservations orphaned by app crashes
--      (consumed_ref='reserved' older than 2h) — previously lost forever.
--   3. log_request_contact dedupe: one notification per
--      (request, dealership, channel) — closes the push-spam vector.
--   4. apply_featured_ad locks the listing row — closes the double-tap race
--      that consumed two featured_ad credits for one boost.
--   5. mark_listing_sold gains optional p_buyer_name / p_date_sold so the
--      AddEditListing user flow can use the RPC without losing form data
--      (old 3-arg signature dropped — no released build calls it).
--   Idempotent: safe to re-run in full.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Expiry triggers: INSERT OR UPDATE + catch-up backfill
--    set_listing_expire_at() already no-ops when expire_at is set, so firing
--    on every UPDATE is cheap and only ever stamps rows that missed it.
-- ----------------------------------------------------------------------------
-- WHEN guard keeps the trigger off hot UPDATE paths (cars is updated on every
-- view-count increment) — the function only runs for rows still missing a stamp.
DROP TRIGGER IF EXISTS trg_cars_set_expire_at ON public.cars;
CREATE TRIGGER trg_cars_set_expire_at
  BEFORE INSERT OR UPDATE ON public.cars
  FOR EACH ROW
  WHEN (NEW.expire_at IS NULL)
  EXECUTE FUNCTION public.set_listing_expire_at();

DROP TRIGGER IF EXISTS trg_cars_rent_set_expire_at ON public.cars_rent;
CREATE TRIGGER trg_cars_rent_set_expire_at
  BEFORE INSERT OR UPDATE ON public.cars_rent
  FOR EACH ROW
  WHEN (NEW.expire_at IS NULL)
  EXECUTE FUNCTION public.set_listing_expire_at();

DROP TRIGGER IF EXISTS trg_number_plates_set_expire_at ON public.number_plates;
CREATE TRIGGER trg_number_plates_set_expire_at
  BEFORE INSERT OR UPDATE ON public.number_plates
  FOR EACH ROW
  WHEN (NEW.expire_at IS NULL)
  EXECUTE FUNCTION public.set_listing_expire_at();

-- Catch-up: stamp available listings that slipped through (pending at the
-- lifecycle apply, approved afterwards). They get the standard new-listing
-- window, not the 75d grandfather — they ARE new listings.
UPDATE public.cars
   SET expire_at = now() + (public.app_config_numeric('listing_duration_days', 60) || ' days')::interval
 WHERE status = 'available' AND expire_at IS NULL;

UPDATE public.cars_rent
   SET expire_at = now() + (public.app_config_numeric('listing_duration_days', 60) || ' days')::interval
 WHERE status = 'available' AND expire_at IS NULL;

UPDATE public.number_plates
   SET expire_at = now() + (public.app_config_numeric('listing_duration_days', 60) || ' days')::interval
 WHERE status::text = 'available' AND expire_at IS NULL;

-- ----------------------------------------------------------------------------
-- 2. expire_wallet_items: reclaim orphaned slot reservations first.
--    request_listing_slot marks an item consumed/'reserved'; if the app dies
--    before bind/release, nothing ever recovered it. Reclaim runs BEFORE the
--    expiry pass so a reclaimed item whose expires_at has passed is expired
--    in the same run (never spendable beyond its window).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_wallet_items()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count     INTEGER;
  v_reclaimed INTEGER;
BEGIN
  -- Reclaim reservations orphaned by client crashes (release_listing_slot's
  -- own window is 1h; 2h here means we never race a live bind).
  UPDATE wallet_items
     SET status = 'active',
         consumed_at = NULL,
         consumed_listing_type = NULL,
         consumed_listing_id = NULL,
         consumed_ref = NULL
   WHERE status = 'consumed'
     AND consumed_ref = 'reserved'
     AND consumed_at < now() - interval '2 hours';
  GET DIAGNOSTICS v_reclaimed = ROW_COUNT;

  UPDATE wallet_items
     SET status = 'expired'
   WHERE status = 'active'
     AND expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Void online purchases stuck in 'pending' for >48h (user abandoned the
  -- Whish WebView and the callback/poll never confirmed). Admin can re-credit
  -- manually via grant if a payment later proves to have gone through.
  UPDATE wallet_acquisitions
     SET status = 'void'
   WHERE status = 'pending'
     AND kind = 'online_purchase'
     AND created_at < now() - interval '48 hours';

  RAISE LOG 'expire_wallet_items: expired % items, reclaimed % orphaned reservations',
    v_count, v_reclaimed;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_wallet_items() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. log_request_contact: one notification per (request, dealership, channel).
--    Repeat calls still succeed (and still return the conversation for chat)
--    but insert nothing and notify nothing.
-- ----------------------------------------------------------------------------
-- Dedupe any rows that predate the constraint (keep the earliest)
DELETE FROM public.car_request_contacts a
 USING public.car_request_contacts b
 WHERE a.request_id = b.request_id
   AND a.dealership_id = b.dealership_id
   AND a.channel = b.channel
   AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_car_request_contacts_unique
  ON public.car_request_contacts(request_id, dealership_id, channel);

CREATE OR REPLACE FUNCTION public.log_request_contact(
  p_request_id BIGINT,
  p_channel    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid             TEXT := auth.uid()::text;
  v_dealership      RECORD;
  v_request         RECORD;
  v_conversation_id BIGINT;
  v_screen          TEXT;
  v_inserted        INTEGER;
BEGIN
  IF p_channel NOT IN ('call', 'whatsapp', 'chat') THEN
    RAISE EXCEPTION 'Invalid channel: %', p_channel;
  END IF;

  SELECT id, name INTO v_dealership FROM dealerships WHERE user_id = v_uid LIMIT 1;
  IF v_dealership.id IS NULL THEN
    RAISE EXCEPTION 'Not a dealership account';
  END IF;

  SELECT id, user_id, make, model INTO v_request
    FROM car_requests WHERE id = p_request_id AND status = 'active';
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found or inactive';
  END IF;

  IF p_channel = 'chat' THEN
    SELECT id INTO v_conversation_id
      FROM conversations
     WHERE car_request_id = p_request_id
       AND dealership_id = v_dealership.id
       AND user_id = v_request.user_id
     LIMIT 1;

    IF v_conversation_id IS NULL THEN
      INSERT INTO conversations (user_id, dealership_id, conversation_type, car_request_id)
      VALUES (v_request.user_id, v_dealership.id, 'user_dealer', p_request_id)
      RETURNING id INTO v_conversation_id;
    END IF;

    v_screen := '/(home)/(user)/conversations/' || v_conversation_id;
  ELSE
    v_screen := '/(home)/(user)/(tabs)/profile';
  END IF;

  -- First contact per channel only — repeats are a no-op (no push spam)
  INSERT INTO car_request_contacts (request_id, dealership_id, contact_user_id, channel, conversation_id)
  VALUES (p_request_id, v_dealership.id, v_uid, p_channel, v_conversation_id)
  ON CONFLICT (request_id, dealership_id, channel) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 1 THEN
    INSERT INTO pending_notifications (user_id, type, data)
    VALUES (
      v_request.user_id,
      'car_request_contact',
      json_build_object(
        'title', 'A dealership is interested! 🚗',
        'message', COALESCE(v_dealership.name, 'A dealership') || ' contacted you about your ' ||
                   v_request.make || COALESCE(' ' || v_request.model, '') || ' request.',
        'screen', v_screen,
        'requestId', p_request_id,
        'conversationId', v_conversation_id,
        'channel', p_channel
      )
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'conversation_id', v_conversation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.log_request_contact(BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_request_contact(BIGINT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. apply_featured_ad: lock the listing row (FOR UPDATE) before consuming.
--    Serializes concurrent calls on the same listing — a double-tap now
--    consumes ONE credit; the loser sees the boost already applied and its
--    own consume runs after the lock clears, against the refreshed state.
--    (Body identical to 20260611_featured_ads.sql except the FOR UPDATE
--    clauses and the renewal-vs-duplicate guard.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_featured_ad(
  p_listing_type TEXT,
  p_listing_id   BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        TEXT := auth.uid()::text;
  v_owner      TEXT;
  v_status     TEXT;
  v_boost_end  TIMESTAMPTZ;
  v_item_id    BIGINT;
  v_end        TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_listing_type NOT IN ('sale', 'rent', 'plate') THEN
    RAISE EXCEPTION 'Invalid listing type: %', p_listing_type;
  END IF;

  -- Resolve owner + status (rentals are dealership-only per client spec).
  -- FOR UPDATE OF the listing serializes concurrent applies on the same row.
  IF p_listing_type = 'sale' THEN
    SELECT COALESCE(c.user_id, d.user_id), c.status, c.boost_end_date
      INTO v_owner, v_status, v_boost_end
      FROM cars c LEFT JOIN dealerships d ON d.id = c.dealership_id
     WHERE c.id = p_listing_id
       FOR UPDATE OF c;
  ELSIF p_listing_type = 'rent' THEN
    SELECT d.user_id, c.status, c.boost_end_date
      INTO v_owner, v_status, v_boost_end
      FROM cars_rent c JOIN dealerships d ON d.id = c.dealership_id
     WHERE c.id = p_listing_id
       FOR UPDATE OF c;
  ELSE
    SELECT COALESCE(np.user_id, d.user_id), np.status::text, np.boost_end_date
      INTO v_owner, v_status, v_boost_end
      FROM number_plates np LEFT JOIN dealerships d ON d.id = np.dealership_id
     WHERE np.id = p_listing_id AND np.deleted_at IS NULL
       FOR UPDATE OF np;
  END IF;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;
  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_owner');
  END IF;
  IF v_status IS DISTINCT FROM 'available' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'listing_not_active');
  END IF;

  -- Double-tap guard: a boost applied seconds ago is a duplicate, not a
  -- renewal. Renewals (boost nearing its end) remain allowed.
  IF v_boost_end IS NOT NULL AND v_boost_end > now() + interval '7 days' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_featured',
                              'boost_end_date', v_boost_end);
  END IF;

  -- Atomic consumption: soonest-expiring active item, SKIP LOCKED
  v_item_id := public.consume_wallet_item(v_uid, 'featured_ad', p_listing_type, p_listing_id, NULL);
  IF v_item_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_item');
  END IF;

  v_end := now() + (public.app_config_numeric('feature_duration_days', 8) || ' days')::interval;

  -- boost_priority = 1 keeps old production builds (which score by it) working
  IF p_listing_type = 'sale' THEN
    UPDATE cars
       SET is_boosted = true, boost_priority = 1, boost_end_date = v_end,
           featured_wallet_item_id = v_item_id, boost_expiry_warning_sent_at = NULL
     WHERE id = p_listing_id;
  ELSIF p_listing_type = 'rent' THEN
    UPDATE cars_rent
       SET is_boosted = true, boost_priority = 1, boost_end_date = v_end,
           featured_wallet_item_id = v_item_id, boost_expiry_warning_sent_at = NULL
     WHERE id = p_listing_id;
  ELSE
    UPDATE number_plates
       SET is_boosted = true, boost_priority = 1, boost_end_date = v_end,
           featured_wallet_item_id = v_item_id, boost_expiry_warning_sent_at = NULL
     WHERE id = p_listing_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'boost_end_date', v_end,
    'wallet_item_id', v_item_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_featured_ad(TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_featured_ad(TEXT, BIGINT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. mark_listing_sold: optional buyer_name / date_sold so the AddEditListing
--    user flow keeps its form data while going through the RPC. The old
--    3-arg signature is dropped (no released build calls it; keeping both
--    would make PostgREST RPC resolution ambiguous).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.mark_listing_sold(BIGINT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.mark_listing_sold(
  p_car_id     BIGINT,
  p_sold_via   TEXT,
  p_sold_price INTEGER DEFAULT NULL,
  p_buyer_name TEXT DEFAULT NULL,
  p_date_sold  DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := auth.uid()::text;
  v_car RECORD;
BEGIN
  IF p_sold_via NOT IN ('fleet', 'other') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_sold_via');
  END IF;

  SELECT c.id, COALESCE(c.user_id, d.user_id) AS owner_id, c.status, c.price
    INTO v_car
    FROM cars c LEFT JOIN dealerships d ON d.id = c.dealership_id
   WHERE c.id = p_car_id
     FOR UPDATE OF c;

  IF v_car.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;
  IF v_car.owner_id IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_owner');
  END IF;
  IF v_car.status <> 'available' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_active');
  END IF;

  UPDATE cars
     SET status = 'sold',
         sold_via = p_sold_via,
         sold_price = COALESCE(p_sold_price, v_car.price),
         buyer_name = COALESCE(p_buyer_name, buyer_name),
         date_sold = COALESCE(p_date_sold, CURRENT_DATE),
         date_modified = now()
   WHERE id = p_car_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_listing_sold(BIGINT, TEXT, INTEGER, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_listing_sold(BIGINT, TEXT, INTEGER, TEXT, DATE) TO authenticated;
