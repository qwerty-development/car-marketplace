-- ============================================================================
-- Migration: Featured Ads RPCs (US-04, US-05, F-03)
-- Date: 2026-06-11
-- Description:
--   - apply_featured_ad: consume a 'featured_ad' wallet item and boost a
--     listing (sale car, rental, or number plate) for feature_duration_days
--     (8 days). Same RPC serves renewals. Atomic — no check-then-act.
--   - get_featured_listings: serve N random featured listings per app entry
--     (banner + top-of-list pinning) or the full deterministic list (view all).
--   Depends on: 20260611_wallet_system.sql, 20260611_listing_lifecycle.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. apply_featured_ad — client RPC (authenticated)
--    Returns jsonb: { success, reason?, boost_end_date?, wallet_item_id? }
--    reason 'no_item' → client opens the purchase sheet.
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
  v_item_id    BIGINT;
  v_end        TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_listing_type NOT IN ('sale', 'rent', 'plate') THEN
    RAISE EXCEPTION 'Invalid listing type: %', p_listing_type;
  END IF;

  -- Resolve owner + status (rentals are dealership-only per client spec)
  IF p_listing_type = 'sale' THEN
    SELECT COALESCE(c.user_id, d.user_id), c.status
      INTO v_owner, v_status
      FROM cars c LEFT JOIN dealerships d ON d.id = c.dealership_id
     WHERE c.id = p_listing_id;
  ELSIF p_listing_type = 'rent' THEN
    SELECT d.user_id, c.status
      INTO v_owner, v_status
      FROM cars_rent c JOIN dealerships d ON d.id = c.dealership_id
     WHERE c.id = p_listing_id;
  ELSE
    SELECT COALESCE(np.user_id, d.user_id), np.status::text
      INTO v_owner, v_status
      FROM number_plates np LEFT JOIN dealerships d ON d.id = np.dealership_id
     WHERE np.id = p_listing_id AND np.deleted_at IS NULL;
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
-- 2. get_featured_listings — anon + authenticated (guests browse too)
--    p_random=true  → N random featured (banner / top-of-list, per app entry)
--    p_random=false → full deterministic list, newest feature first (view all)
--    The featured set is small (each feature costs money), so ORDER BY random()
--    over the partial is_boosted index is cheap.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_featured_listings(
  p_listing_type TEXT DEFAULT 'sale',
  p_limit        INTEGER DEFAULT 5,
  p_random       BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_limit  INTEGER := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 100);
BEGIN
  IF p_listing_type = 'sale' THEN
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_result
    FROM (
      SELECT to_jsonb(c) || jsonb_build_object(
               'dealership_name', d.name,
               'dealership_logo', d.logo,
               'dealership_phone', d.phone,
               'dealership_location', d.location,
               'dealership_latitude', d.latitude,
               'dealership_longitude', d.longitude
             ) AS row_data
        FROM cars c
        LEFT JOIN dealerships d ON d.id = c.dealership_id
       WHERE c.is_boosted AND c.boost_end_date > now() AND c.status = 'available'
       ORDER BY CASE WHEN p_random THEN random() ELSE NULL END,
                c.boost_end_date DESC
       LIMIT v_limit
    ) t;
  ELSIF p_listing_type = 'rent' THEN
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_result
    FROM (
      SELECT to_jsonb(c) || jsonb_build_object(
               'dealership_name', d.name,
               'dealership_logo', d.logo,
               'dealership_phone', d.phone,
               'dealership_location', d.location
             ) AS row_data
        FROM cars_rent c
        LEFT JOIN dealerships d ON d.id = c.dealership_id
       WHERE c.is_boosted AND c.boost_end_date > now() AND c.status = 'available'
       ORDER BY CASE WHEN p_random THEN random() ELSE NULL END,
                c.boost_end_date DESC
       LIMIT v_limit
    ) t;
  ELSIF p_listing_type = 'plate' THEN
    SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_result
    FROM (
      SELECT to_jsonb(np) AS row_data
        FROM number_plates np
       WHERE np.is_boosted AND np.boost_end_date > now()
         AND np.deleted_at IS NULL AND np.status::text = 'available'
       ORDER BY CASE WHEN p_random THEN random() ELSE NULL END,
                np.boost_end_date DESC
       LIMIT v_limit
    ) t;
  ELSE
    RAISE EXCEPTION 'Invalid listing type: %', p_listing_type;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_featured_listings(TEXT, INTEGER, BOOLEAN) TO anon, authenticated;
