-- ============================================================================
-- Migration: Listing slot consumption (US-09, US-11 — "buy extra listings")
-- Date: 2026-06-11
-- Description: Posting a listing beyond the free allowance consumes a
--   'listing' wallet item. Gated behind app_config.enforce_listing_slots
--   (default false) so the client can flip it on once pricing/wallets are
--   seeded — existing listings are grandfathered automatically (only new
--   posts consume).
--
--   Flow (listing creation stays a client-side insert, so consumption is a
--   reserve → bind / release pair to avoid orphans):
--     1. request_listing_slot(type)         → before insert; reserves an item
--     2. bind_listing_slot(item, type, id)  → after successful insert
--     3. release_listing_slot(item)         → insert failed; returns the item
--   Free allowance: users get app_config.free_active_listings_user active
--   listings free; dealerships' allowance comes entirely from granted/bought
--   items (their offline subscription package is topped up by admin).
--   Depends on: 20260611_wallet_system.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_listing_slot(p_listing_type TEXT DEFAULT 'sale')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        TEXT := auth.uid()::text;
  v_role       TEXT;
  v_free       INTEGER;
  v_active     INTEGER;
  v_item_id    BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.app_config_bool('enforce_listing_slots', false) THEN
    RETURN jsonb_build_object('allowed', true, 'free', true, 'enforced', false);
  END IF;

  SELECT role INTO v_role FROM users WHERE id = v_uid;

  -- Serialize per-user so two concurrent posts can't both pass the free check
  PERFORM 1 FROM users WHERE id = v_uid FOR UPDATE;

  IF v_role = 'user' THEN
    v_free := public.app_config_numeric('free_active_listings_user', 1)::int;
    SELECT (SELECT COUNT(*) FROM cars WHERE user_id = v_uid AND status = 'available')
         + (SELECT COUNT(*) FROM number_plates WHERE user_id = v_uid AND status::text = 'available' AND deleted_at IS NULL)
      INTO v_active;
    IF v_active < v_free THEN
      RETURN jsonb_build_object('allowed', true, 'free', true, 'enforced', true,
                                'active_listings', v_active, 'free_allowance', v_free);
    END IF;
  END IF;

  -- Beyond allowance (or dealership): consume a listing item
  v_item_id := public.consume_wallet_item(v_uid, 'listing', p_listing_type, NULL, 'reserved');
  IF v_item_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'payment_required');
  END IF;

  RETURN jsonb_build_object('allowed', true, 'free', false, 'enforced', true, 'wallet_item_id', v_item_id);
END;
$$;

REVOKE ALL ON FUNCTION public.request_listing_slot(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_listing_slot(TEXT) TO authenticated;

-- Stamp the consumed item with the listing it paid for (after successful insert)
CREATE OR REPLACE FUNCTION public.bind_listing_slot(
  p_wallet_item_id BIGINT,
  p_listing_type   TEXT,
  p_listing_id     BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE wallet_items
     SET consumed_listing_type = p_listing_type,
         consumed_listing_id = p_listing_id,
         consumed_ref = 'listing:' || p_listing_id
   WHERE id = p_wallet_item_id
     AND owner_user_id = auth.uid()::text
     AND status = 'consumed'
     AND consumed_ref = 'reserved'
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.bind_listing_slot(BIGINT, TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bind_listing_slot(BIGINT, TEXT, BIGINT) TO authenticated;

-- Give the item back if the listing insert failed. Only reserved-but-unbound
-- items, only the owner's, and only within an hour of consumption.
CREATE OR REPLACE FUNCTION public.release_listing_slot(p_wallet_item_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE wallet_items
     SET status = 'active',
         consumed_at = NULL,
         consumed_listing_type = NULL,
         consumed_listing_id = NULL,
         consumed_ref = NULL
   WHERE id = p_wallet_item_id
     AND owner_user_id = auth.uid()::text
     AND status = 'consumed'
     AND consumed_ref = 'reserved'
     AND consumed_at > now() - interval '1 hour'
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.release_listing_slot(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_listing_slot(BIGINT) TO authenticated;
