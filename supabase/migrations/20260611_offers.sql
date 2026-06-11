-- ============================================================================
-- Migration: Offer System (US-12, US-13) + Mark-as-sold via (US-14)
-- Date: 2026-06-11
-- Description:
--   In-chat price offers: buyer offers >= 85% of listing price
--   (app_config.min_offer_ratio), one live offer per conversation,
--   counter-offer chains, one-tap accept/decline. Every offer action inserts a
--   type='offer' message with a human-readable body, so the existing
--   update_conversation_metadata + handle_new_message_notification triggers
--   handle previews and push notifications with no changes.
--   Also: cars.sold_via for US-14 and the analytics event_type extension
--   ('offer' here; 'impression' is added in the same statement for the
--   listing-analytics migration that follows).
--   Depends on: 20260611_wallet_system.sql (app_config).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. offers table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offers (
  id                      BIGSERIAL PRIMARY KEY,
  conversation_id         BIGINT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  listing_type            TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent', 'plate')),
  listing_id              BIGINT NOT NULL,
  amount                  NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  listing_price_snapshot  NUMERIC(12,2) NOT NULL,
  made_by                 TEXT NOT NULL REFERENCES public.users(id),
  made_by_side            TEXT NOT NULL CHECK (made_by_side IN ('buyer', 'seller')),
  parent_offer_id         BIGINT REFERENCES public.offers(id),
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'superseded')),
  responded_at            TIMESTAMPTZ,
  responded_by            TEXT,
  message_id              BIGINT REFERENCES public.messages(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.offers IS 'In-chat price negotiations. Counter chains via parent_offer_id; a countered offer becomes superseded.';

-- One live offer per conversation
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_one_pending_per_conversation
  ON public.offers(conversation_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_offers_conversation ON public.offers(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_listing ON public.offers(listing_type, listing_id);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view offers" ON public.offers;
CREATE POLICY "Participants can view offers"
  ON public.offers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    LEFT JOIN public.dealerships d ON d.id = c.dealership_id
    WHERE c.id = conversation_id
      AND (c.user_id = auth.uid()::text
           OR c.seller_user_id = auth.uid()::text
           OR d.user_id = auth.uid()::text)
  ));

DROP POLICY IF EXISTS "Service role manages offers" ON public.offers;
CREATE POLICY "Service role manages offers"
  ON public.offers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 2. messages: offer linkage. Offer messages always carry a readable body so
--    old app builds (and push notifications) render them fine.
-- ----------------------------------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'offer')),
  ADD COLUMN IF NOT EXISTS offer_id BIGINT REFERENCES public.offers(id);

-- ----------------------------------------------------------------------------
-- 3. analytics event types: 'offer' (this migration) + 'impression' (used by
--    the listing-analytics migration; added together to rewrite the CHECK once)
-- ----------------------------------------------------------------------------
ALTER TABLE public.listing_analytics_events DROP CONSTRAINT IF EXISTS listing_analytics_events_event_type_check;
ALTER TABLE public.listing_analytics_events
  ADD CONSTRAINT listing_analytics_events_event_type_check
  CHECK (event_type IN ('view', 'call', 'whatsapp', 'chat', 'like', 'offer', 'impression'));

-- ----------------------------------------------------------------------------
-- 4. US-14: sold attribution
-- ----------------------------------------------------------------------------
ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS sold_via TEXT CHECK (sold_via IN ('fleet', 'other') OR sold_via IS NULL);

COMMENT ON COLUMN public.cars.sold_via IS 'US-14: seller indicates whether the car sold through Fleet or elsewhere.';

-- ----------------------------------------------------------------------------
-- 5. Internal helpers
-- ----------------------------------------------------------------------------
-- Resolve the conversation's listing (type, id, current price) + participants.
CREATE OR REPLACE FUNCTION public._offer_conversation_context(p_conversation_id BIGINT)
RETURNS TABLE (
  conversation_type TEXT,
  buyer_id          TEXT,
  seller_id         TEXT,
  dealership_id     BIGINT,
  seller_user_id    TEXT,
  listing_type      TEXT,
  listing_id        BIGINT,
  listing_price     NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.conversation_type,
    c.user_id AS buyer_id,
    COALESCE(c.seller_user_id, d.user_id) AS seller_id,
    c.dealership_id,
    c.seller_user_id,
    CASE
      WHEN c.car_id IS NOT NULL THEN 'sale'
      WHEN c.car_rent_id IS NOT NULL THEN 'rent'
      WHEN c.number_plate_id IS NOT NULL THEN 'plate'
    END AS listing_type,
    COALESCE(c.car_id, c.car_rent_id, c.number_plate_id) AS listing_id,
    CASE
      WHEN c.car_id IS NOT NULL THEN (SELECT price::numeric FROM cars WHERE id = c.car_id)
      WHEN c.car_rent_id IS NOT NULL THEN (SELECT price::numeric FROM cars_rent WHERE id = c.car_rent_id)
      WHEN c.number_plate_id IS NOT NULL THEN (SELECT price::numeric FROM number_plates WHERE id = c.number_plate_id)
    END AS listing_price
  FROM conversations c
  LEFT JOIN dealerships d ON d.id = c.dealership_id
  WHERE c.id = p_conversation_id;
$$;

REVOKE ALL ON FUNCTION public._offer_conversation_context(BIGINT) FROM PUBLIC, anon, authenticated;

-- Insert the chat message for an offer action; returns message id.
CREATE OR REPLACE FUNCTION public._insert_offer_message(
  p_conversation_id BIGINT,
  p_sender_id       TEXT,
  p_sender_role     TEXT,
  p_body            TEXT,
  p_offer_id        BIGINT
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO messages (conversation_id, sender_id, sender_role, body, type, offer_id)
  VALUES (p_conversation_id, p_sender_id, p_sender_role, p_body, 'offer', p_offer_id)
  RETURNING id;
$$;

REVOKE ALL ON FUNCTION public._insert_offer_message(BIGINT, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. create_offer — buyer opens a negotiation (US-12)
--    Returns { success, reason?, offer_id?, min_amount? }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_offer(
  p_conversation_id BIGINT,
  p_amount          NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    TEXT := auth.uid()::text;
  v_ctx    RECORD;
  v_ratio  NUMERIC;
  v_min    NUMERIC;
  v_offer  RECORD;
  v_msg_id BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_ctx FROM public._offer_conversation_context(p_conversation_id);
  IF v_ctx.listing_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_listing');
  END IF;
  IF v_uid <> v_ctx.buyer_id THEN
    -- Initial offers come from the buyer (the conversation initiator)
    RETURN jsonb_build_object('success', false, 'reason', 'not_buyer');
  END IF;
  IF v_ctx.listing_price IS NULL OR v_ctx.listing_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_listing_price');
  END IF;

  v_ratio := public.app_config_numeric('min_offer_ratio', 0.85);
  v_min := round(v_ctx.listing_price * v_ratio, 2);
  IF p_amount IS NULL OR p_amount < v_min THEN
    RETURN jsonb_build_object('success', false, 'reason', 'below_minimum', 'min_amount', v_min);
  END IF;

  IF EXISTS (SELECT 1 FROM offers WHERE conversation_id = p_conversation_id AND status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'pending_offer_exists');
  END IF;

  -- The partial unique index (one pending offer per conversation) is the real
  -- guard — two concurrent calls can both pass the EXISTS check above, so the
  -- loser's INSERT must degrade to the same graceful reason, not a 500.
  BEGIN
    INSERT INTO offers (conversation_id, listing_type, listing_id, amount, listing_price_snapshot, made_by, made_by_side)
    VALUES (p_conversation_id, v_ctx.listing_type, v_ctx.listing_id, p_amount, v_ctx.listing_price, v_uid, 'buyer')
    RETURNING * INTO v_offer;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'reason', 'pending_offer_exists');
  END;

  v_msg_id := public._insert_offer_message(
    p_conversation_id, v_uid, 'user',
    'Offer: $' || to_char(p_amount, 'FM999,999,999,990.##'),
    v_offer.id
  );
  UPDATE offers SET message_id = v_msg_id WHERE id = v_offer.id;

  -- Offer count feeds per-listing analytics (US-15)
  INSERT INTO listing_analytics_events (listing_type, listing_id, dealership_id, seller_user_id, viewer_id, viewer_type, event_type, metadata)
  VALUES (v_ctx.listing_type, v_ctx.listing_id, v_ctx.dealership_id, v_ctx.seller_user_id, v_uid, 'user', 'offer',
          jsonb_build_object('offer_id', v_offer.id, 'amount', p_amount));

  RETURN jsonb_build_object('success', true, 'offer_id', v_offer.id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_offer(BIGINT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_offer(BIGINT, NUMERIC) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. respond_offer — accept / decline / counter (US-13)
--    Counters supersede the pending offer atomically and flip the side.
--    The 85% floor applies to BUYER amounts only (sellers counter freely).
--    Returns { success, reason?, offer_id?, status?, min_amount? }
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_offer(
  p_offer_id       BIGINT,
  p_action         TEXT,
  p_counter_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       TEXT := auth.uid()::text;
  v_offer     RECORD;
  v_ctx       RECORD;
  v_my_side   TEXT;
  v_role      TEXT;
  v_ratio     NUMERIC;
  v_min       NUMERIC;
  v_new_offer RECORD;
  v_msg_id    BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_action NOT IN ('accept', 'decline', 'counter') THEN
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  -- Lock the offer row so concurrent responses can't both proceed
  SELECT * INTO v_offer FROM offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;
  IF v_offer.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_' || v_offer.status);
  END IF;

  SELECT * INTO v_ctx FROM public._offer_conversation_context(v_offer.conversation_id);

  IF v_uid = v_ctx.buyer_id THEN
    v_my_side := 'buyer';
    v_role := 'user';
  ELSIF v_uid = v_ctx.seller_id THEN
    v_my_side := 'seller';
    v_role := CASE WHEN v_ctx.conversation_type = 'user_dealer' THEN 'dealer' ELSE 'seller_user' END;
  ELSE
    RETURN jsonb_build_object('success', false, 'reason', 'not_participant');
  END IF;

  IF v_my_side = v_offer.made_by_side THEN
    RETURN jsonb_build_object('success', false, 'reason', 'own_offer');
  END IF;

  IF p_action = 'accept' THEN
    UPDATE offers SET status = 'accepted', responded_at = now(), responded_by = v_uid
     WHERE id = p_offer_id;
    v_msg_id := public._insert_offer_message(
      v_offer.conversation_id, v_uid, v_role,
      'Offer accepted: $' || to_char(v_offer.amount, 'FM999,999,999,990.##') || ' ✅',
      p_offer_id
    );
    RETURN jsonb_build_object('success', true, 'offer_id', p_offer_id, 'status', 'accepted');
  END IF;

  IF p_action = 'decline' THEN
    UPDATE offers SET status = 'declined', responded_at = now(), responded_by = v_uid
     WHERE id = p_offer_id;
    v_msg_id := public._insert_offer_message(
      v_offer.conversation_id, v_uid, v_role,
      'Offer declined: $' || to_char(v_offer.amount, 'FM999,999,999,990.##'),
      p_offer_id
    );
    RETURN jsonb_build_object('success', true, 'offer_id', p_offer_id, 'status', 'declined');
  END IF;

  -- counter
  IF p_counter_amount IS NULL OR p_counter_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_counter_amount');
  END IF;
  IF v_my_side = 'buyer' THEN
    v_ratio := public.app_config_numeric('min_offer_ratio', 0.85);
    v_min := round(v_offer.listing_price_snapshot * v_ratio, 2);
    IF p_counter_amount < v_min THEN
      RETURN jsonb_build_object('success', false, 'reason', 'below_minimum', 'min_amount', v_min);
    END IF;
  END IF;

  UPDATE offers SET status = 'superseded', responded_at = now(), responded_by = v_uid
   WHERE id = p_offer_id;

  INSERT INTO offers (conversation_id, listing_type, listing_id, amount, listing_price_snapshot, made_by, made_by_side, parent_offer_id)
  VALUES (v_offer.conversation_id, v_offer.listing_type, v_offer.listing_id, p_counter_amount,
          v_offer.listing_price_snapshot, v_uid, v_my_side, p_offer_id)
  RETURNING * INTO v_new_offer;

  v_msg_id := public._insert_offer_message(
    v_offer.conversation_id, v_uid, v_role,
    'Counter-offer: $' || to_char(p_counter_amount, 'FM999,999,999,990.##'),
    v_new_offer.id
  );
  UPDATE offers SET message_id = v_msg_id WHERE id = v_new_offer.id;

  RETURN jsonb_build_object('success', true, 'offer_id', v_new_offer.id, 'status', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.respond_offer(BIGINT, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_offer(BIGINT, TEXT, NUMERIC) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. mark_listing_sold — US-14 (user P2P listings; dealers have their own
--    sold flow). sold_via is required: 'fleet' or 'other'.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_listing_sold(
  p_car_id     BIGINT,
  p_sold_via   TEXT,
  p_sold_price INTEGER DEFAULT NULL
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
   WHERE c.id = p_car_id;

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
         date_sold = CURRENT_DATE,
         date_modified = now()
   WHERE id = p_car_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_listing_sold(BIGINT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_listing_sold(BIGINT, TEXT, INTEGER) TO authenticated;
