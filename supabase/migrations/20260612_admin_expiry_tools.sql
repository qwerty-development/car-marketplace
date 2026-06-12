-- ============================================================================
-- Migration: Admin expiry tools (ops lever for the listing lifecycle)
-- Date: 2026-06-12
-- Description: The lifecycle crons expire listings automatically; this gives
--   the admin panel (fleet-webapp, service_role) the matching manual levers:
--   - admin_extend_listing_expiry: one listing — extend its window and, if it
--     already expired, restore it to 'available' (the support-ticket path).
--   - admin_extend_all_expiries: bulk grace period for AVAILABLE listings,
--     optionally scoped to one type and/or one dealership (VIP/retention
--     deals). Deliberately does NOT revive expired listings — mass-revival
--     is a separate, more dangerous decision; do it per-listing or via
--     multi-select.
--   - admin_extend_listings_expiry: explicit multi-select batch (array of
--     ids, one type) — extends AND revives like the single version, since
--     the admin hand-picked the rows.
--   Both reset expiry_warning_sent_at so owners get a fresh warning before
--   the new deadline. Service-role only (admin is web-only).
--   Gotchas honored: number_plates has NO date_modified column and an ENUM
--   status; soft-deleted plates (deleted_at) are never touched.
--   Idempotent: safe to re-run in full.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. admin_extend_listing_expiry — single listing, extends + revives.
--    Extension is from GREATEST(expire_at, now()): extending a listing that
--    expired last month gives p_days from TODAY, not a half-burned window.
--    Returns jsonb: { success, reason?, expire_at?, revived? }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_extend_listing_expiry(
  p_listing_type TEXT,
  p_listing_id   BIGINT,
  p_days         INTEGER,
  p_admin_id     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status  TEXT;
  v_expire  TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
  v_revived BOOLEAN := false;
BEGIN
  IF p_listing_type NOT IN ('sale', 'rent', 'plate') THEN
    RAISE EXCEPTION 'Invalid listing type: %', p_listing_type;
  END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 365';
  END IF;

  IF p_listing_type = 'sale' THEN
    SELECT status, expire_at INTO v_status, v_expire
      FROM cars WHERE id = p_listing_id FOR UPDATE;
  ELSIF p_listing_type = 'rent' THEN
    SELECT status, expire_at INTO v_status, v_expire
      FROM cars_rent WHERE id = p_listing_id FOR UPDATE;
  ELSE
    SELECT status::text, expire_at INTO v_status, v_expire
      FROM number_plates WHERE id = p_listing_id AND deleted_at IS NULL FOR UPDATE;
  END IF;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;
  -- Only live or expired listings: never resurrect sold/rented/deleted ones.
  IF v_status NOT IN ('available', 'expired') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_status', 'status', v_status);
  END IF;

  v_revived := (v_status = 'expired');
  v_new_end := GREATEST(COALESCE(v_expire, now()), now()) + (p_days || ' days')::interval;

  IF p_listing_type = 'sale' THEN
    UPDATE cars
       SET expire_at = v_new_end,
           expiry_warning_sent_at = NULL,
           status = 'available',
           date_modified = CASE WHEN v_revived THEN now() ELSE date_modified END
     WHERE id = p_listing_id;
  ELSIF p_listing_type = 'rent' THEN
    UPDATE cars_rent
       SET expire_at = v_new_end,
           expiry_warning_sent_at = NULL,
           status = 'available',
           date_modified = CASE WHEN v_revived THEN now() ELSE date_modified END
     WHERE id = p_listing_id;
  ELSE
    -- number_plates: enum status, no date_modified
    UPDATE number_plates
       SET expire_at = v_new_end,
           expiry_warning_sent_at = NULL,
           status = 'available'
     WHERE id = p_listing_id;
  END IF;

  RAISE LOG 'admin_extend_listing_expiry: % % +%d by % (revived=%)',
    p_listing_type, p_listing_id, p_days, COALESCE(p_admin_id, '?'), v_revived;

  RETURN jsonb_build_object(
    'success', true,
    'expire_at', v_new_end,
    'revived', v_revived
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_extend_listing_expiry(TEXT, BIGINT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_listing_expiry(TEXT, BIGINT, INTEGER, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. admin_extend_all_expiries — bulk grace period, available listings only.
--    p_listing_type NULL → all three types. p_dealership_id NULL → everyone
--    (user-owned listings included); set → only that dealership's inventory.
--    Returns jsonb: { success, updated: { sale, rent, plate } }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_extend_all_expiries(
  p_days          INTEGER,
  p_listing_type  TEXT DEFAULT NULL,
  p_dealership_id BIGINT DEFAULT NULL,
  p_admin_id      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale  INTEGER := 0;
  v_rent  INTEGER := 0;
  v_plate INTEGER := 0;
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 365';
  END IF;
  IF p_listing_type IS NOT NULL AND p_listing_type NOT IN ('sale', 'rent', 'plate') THEN
    RAISE EXCEPTION 'Invalid listing type: %', p_listing_type;
  END IF;

  IF p_listing_type IS NULL OR p_listing_type = 'sale' THEN
    UPDATE cars
       SET expire_at = GREATEST(COALESCE(expire_at, now()), now()) + (p_days || ' days')::interval,
           expiry_warning_sent_at = NULL
     WHERE status = 'available'
       AND (p_dealership_id IS NULL OR dealership_id = p_dealership_id);
    GET DIAGNOSTICS v_sale = ROW_COUNT;
  END IF;

  IF p_listing_type IS NULL OR p_listing_type = 'rent' THEN
    UPDATE cars_rent
       SET expire_at = GREATEST(COALESCE(expire_at, now()), now()) + (p_days || ' days')::interval,
           expiry_warning_sent_at = NULL
     WHERE status = 'available'
       AND (p_dealership_id IS NULL OR dealership_id = p_dealership_id);
    GET DIAGNOSTICS v_rent = ROW_COUNT;
  END IF;

  IF p_listing_type IS NULL OR p_listing_type = 'plate' THEN
    UPDATE number_plates
       SET expire_at = GREATEST(COALESCE(expire_at, now()), now()) + (p_days || ' days')::interval,
           expiry_warning_sent_at = NULL
     WHERE status::text = 'available'
       AND deleted_at IS NULL
       AND (p_dealership_id IS NULL OR dealership_id = p_dealership_id);
    GET DIAGNOSTICS v_plate = ROW_COUNT;
  END IF;

  RAISE LOG 'admin_extend_all_expiries: +%d type=% dealership=% by % (sale=%, rent=%, plate=%)',
    p_days, COALESCE(p_listing_type, 'all'), COALESCE(p_dealership_id::text, 'all'),
    COALESCE(p_admin_id, '?'), v_sale, v_rent, v_plate;

  RETURN jsonb_build_object(
    'success', true,
    'updated', jsonb_build_object('sale', v_sale, 'rent', v_rent, 'plate', v_plate)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_extend_all_expiries(INTEGER, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_all_expiries(INTEGER, TEXT, BIGINT, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 3. admin_extend_listings_expiry — explicit multi-select batch (one type per
--    call, matching the admin UI where selection happens within one view).
--    Behaves like the single-listing version — extends AND revives — because
--    the admin hand-picked these rows; sold/rented/deleted/missing ids are
--    skipped and counted. Atomic: one transaction, rows locked up front so
--    the hourly expiry cron can't flip a row mid-batch.
--    Returns jsonb: { success, extended, revived, skipped }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_extend_listings_expiry(
  p_listing_type TEXT,
  p_listing_ids  BIGINT[],
  p_days         INTEGER,
  p_admin_id     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested INTEGER;
  v_revived   INTEGER := 0;
  v_extended  INTEGER := 0;
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'p_days must be between 1 and 365';
  END IF;
  IF p_listing_type NOT IN ('sale', 'rent', 'plate') THEN
    RAISE EXCEPTION 'Invalid listing type: %', p_listing_type;
  END IF;
  v_requested := COALESCE(array_length(p_listing_ids, 1), 0);
  IF v_requested = 0 THEN
    RAISE EXCEPTION 'p_listing_ids must not be empty';
  END IF;
  IF v_requested > 500 THEN
    RAISE EXCEPTION 'Batch too large (max 500 listings)';
  END IF;

  IF p_listing_type = 'sale' THEN
    PERFORM 1 FROM cars WHERE id = ANY(p_listing_ids) FOR UPDATE;
    SELECT count(*) INTO v_revived
      FROM cars WHERE id = ANY(p_listing_ids) AND status = 'expired';
    UPDATE cars
       SET expire_at = GREATEST(COALESCE(expire_at, now()), now()) + (p_days || ' days')::interval,
           expiry_warning_sent_at = NULL,
           date_modified = CASE WHEN status = 'expired' THEN now() ELSE date_modified END,
           status = 'available'
     WHERE id = ANY(p_listing_ids)
       AND status IN ('available', 'expired');
    GET DIAGNOSTICS v_extended = ROW_COUNT;
  ELSIF p_listing_type = 'rent' THEN
    PERFORM 1 FROM cars_rent WHERE id = ANY(p_listing_ids) FOR UPDATE;
    SELECT count(*) INTO v_revived
      FROM cars_rent WHERE id = ANY(p_listing_ids) AND status = 'expired';
    UPDATE cars_rent
       SET expire_at = GREATEST(COALESCE(expire_at, now()), now()) + (p_days || ' days')::interval,
           expiry_warning_sent_at = NULL,
           date_modified = CASE WHEN status = 'expired' THEN now() ELSE date_modified END,
           status = 'available'
     WHERE id = ANY(p_listing_ids)
       AND status IN ('available', 'expired');
    GET DIAGNOSTICS v_extended = ROW_COUNT;
  ELSE
    -- number_plates: enum status, no date_modified, soft-delete guard
    PERFORM 1 FROM number_plates WHERE id = ANY(p_listing_ids) FOR UPDATE;
    SELECT count(*) INTO v_revived
      FROM number_plates
     WHERE id = ANY(p_listing_ids) AND status::text = 'expired' AND deleted_at IS NULL;
    UPDATE number_plates
       SET expire_at = GREATEST(COALESCE(expire_at, now()), now()) + (p_days || ' days')::interval,
           expiry_warning_sent_at = NULL,
           status = 'available'
     WHERE id = ANY(p_listing_ids)
       AND status::text IN ('available', 'expired')
       AND deleted_at IS NULL;
    GET DIAGNOSTICS v_extended = ROW_COUNT;
  END IF;

  RAISE LOG 'admin_extend_listings_expiry: % ids=% +%d by % (extended=%, revived=%, skipped=%)',
    p_listing_type, v_requested, p_days, COALESCE(p_admin_id, '?'),
    v_extended, v_revived, v_requested - v_extended;

  RETURN jsonb_build_object(
    'success', true,
    'extended', v_extended,
    'revived', v_revived,
    'skipped', v_requested - v_extended
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_extend_listings_expiry(TEXT, BIGINT[], INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_listings_expiry(TEXT, BIGINT[], INTEGER, TEXT) TO service_role;
