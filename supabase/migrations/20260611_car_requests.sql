-- ============================================================================
-- Migration: Car Requests (US-01, US-02, US-03, F-04)
-- Date: 2026-06-11
-- Description:
--   Users post buy-requests (one car per request, 7-day expiry, newest-first).
--   2 free per user per calendar month (app_config.free_car_requests_per_month);
--   beyond that a 'car_request' wallet item is consumed. Dealerships browse the
--   feed, dismiss per-dealership, and contact via call/WhatsApp/in-app chat —
--   the user is notified on contact. Regions are a lookup table (incl.
--   'All of Lebanon') and users gain a region column.
--   Depends on: 20260611_wallet_system.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Regions lookup + users.region
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.regions (
  code     TEXT PRIMARY KEY,
  name_en  TEXT NOT NULL,
  name_ar  TEXT NOT NULL,
  sort     INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read regions" ON public.regions;
CREATE POLICY "Anyone can read regions"
  ON public.regions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages regions" ON public.regions;
CREATE POLICY "Service role manages regions"
  ON public.regions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.regions (code, name_en, name_ar, sort) VALUES
  ('all_lebanon',   'All of Lebanon',  'كل لبنان',        0),
  ('beirut',        'Beirut',          'بيروت',           10),
  ('mount_lebanon', 'Mount Lebanon',   'جبل لبنان',       20),
  ('north_lebanon', 'North Lebanon',   'الشمال',          30),
  ('akkar',         'Akkar',           'عكار',            40),
  ('bekaa',         'Bekaa',           'البقاع',          50),
  ('baalbek_hermel','Baalbek-Hermel',  'بعلبك الهرمل',    60),
  ('south_lebanon', 'South Lebanon',   'الجنوب',          70),
  ('nabatieh',      'Nabatieh',        'النبطية',         80)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS region TEXT REFERENCES public.regions(code);

COMMENT ON COLUMN public.users.region IS 'User location by Lebanese region (client requested capturing this alongside car requests).';

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.car_requests (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  make        TEXT NOT NULL,
  model       TEXT,
  year_min    INTEGER,
  year_max    INTEGER,
  budget_min  NUMERIC(12,2),
  budget_max  NUMERIC(12,2),
  notes       TEXT,
  region      TEXT NOT NULL DEFAULT 'all_lebanon' REFERENCES public.regions(code),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'removed')),
  paid        BOOLEAN NOT NULL DEFAULT false,
  wallet_item_id BIGINT REFERENCES public.wallet_items(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  CONSTRAINT car_requests_year_range CHECK (year_min IS NULL OR year_max IS NULL OR year_min <= year_max),
  CONSTRAINT car_requests_budget_range CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)
);

COMMENT ON TABLE public.car_requests IS 'User buy-requests (US-01). One car per request; a user may post duplicate requests. 7-day expiry, newest-first feed.';

CREATE INDEX IF NOT EXISTS idx_car_requests_feed
  ON public.car_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_car_requests_user_month
  ON public.car_requests(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_car_requests_expiry
  ON public.car_requests(expires_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.car_request_dismissals (
  request_id    BIGINT NOT NULL REFERENCES public.car_requests(id) ON DELETE CASCADE,
  dealership_id BIGINT NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  dismissed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, dealership_id)
);

COMMENT ON TABLE public.car_request_dismissals IS 'Per-dealership dismissals (the X button) — hides the request for that dealership only, user is never notified.';

CREATE TABLE IF NOT EXISTS public.car_request_contacts (
  id              BIGSERIAL PRIMARY KEY,
  request_id      BIGINT NOT NULL REFERENCES public.car_requests(id) ON DELETE CASCADE,
  dealership_id   BIGINT NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  contact_user_id TEXT,
  channel         TEXT NOT NULL CHECK (channel IN ('call', 'whatsapp', 'chat')),
  conversation_id BIGINT REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_car_request_contacts_request ON public.car_request_contacts(request_id);
CREATE INDEX IF NOT EXISTS idx_car_request_contacts_dealership ON public.car_request_contacts(dealership_id);

-- Chat threads can be linked to a request (extends the polymorphic pattern).
-- SET NULL: deleting a request (or cascading a user delete) must never block
-- on, or delete, the conversation itself.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS car_request_id BIGINT REFERENCES public.car_requests(id) ON DELETE SET NULL;

-- The conversations table requires a listing context (car/rent/plate). Request
-- chats have none of those — drop any such CHECK so request conversations can
-- be inserted.
--
-- PRODUCTION SAFETY: we deliberately do NOT add an "exactly one context"
-- constraint here. Even with NOT VALID, Postgres enforces CHECKs on every
-- subsequent UPDATE — and conversations rows are updated on EVERY message
-- (update_conversation_metadata trigger). A single legacy row with an
-- unexpected shape would break chat for its participants. Instead we add only
-- a constraint that every legacy row trivially satisfies (car_request_id is
-- NULL on all of them): a request conversation must not carry another
-- listing context. Shape of regular conversations stays guarded by the app
-- and the SECURITY DEFINER RPC.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.conversations'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ~ '(car_id|car_rent_id|number_plate_id)'
  LOOP
    EXECUTE format('ALTER TABLE public.conversations DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_request_context_exclusive CHECK (
    car_request_id IS NULL
    OR (car_id IS NULL AND car_rent_id IS NULL AND number_plate_id IS NULL)
  );

-- ----------------------------------------------------------------------------
-- 3. RLS — reads direct, writes through RPCs (quota enforcement)
-- ----------------------------------------------------------------------------
ALTER TABLE public.car_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_request_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_request_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own requests" ON public.car_requests;
CREATE POLICY "Owners can view own requests"
  ON public.car_requests FOR SELECT
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Dealers can view active requests" ON public.car_requests;
CREATE POLICY "Dealers can view active requests"
  ON public.car_requests FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (SELECT 1 FROM public.dealerships d WHERE d.user_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "Service role manages requests" ON public.car_requests;
CREATE POLICY "Service role manages requests"
  ON public.car_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Dealers can view own dismissals" ON public.car_request_dismissals;
CREATE POLICY "Dealers can view own dismissals"
  ON public.car_request_dismissals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.dealerships d
    WHERE d.id = dealership_id AND d.user_id = auth.uid()::text
  ));

DROP POLICY IF EXISTS "Service role manages dismissals" ON public.car_request_dismissals;
CREATE POLICY "Service role manages dismissals"
  ON public.car_request_dismissals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Participants can view contacts" ON public.car_request_contacts;
CREATE POLICY "Participants can view contacts"
  ON public.car_request_contacts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.car_requests r WHERE r.id = request_id AND r.user_id = auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.dealerships d WHERE d.id = dealership_id AND d.user_id = auth.uid()::text)
  );

DROP POLICY IF EXISTS "Service role manages contacts" ON public.car_request_contacts;
CREATE POLICY "Service role manages contacts"
  ON public.car_request_contacts FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 4. create_car_request — quota check + optional wallet consumption, atomic.
--    Returns { success, request_id?, paid?, reason? }
--    reason 'payment_required' → client opens the purchase sheet.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_car_request(
  p_make       TEXT,
  p_model      TEXT DEFAULT NULL,
  p_year_min   INTEGER DEFAULT NULL,
  p_year_max   INTEGER DEFAULT NULL,
  p_budget_min NUMERIC DEFAULT NULL,
  p_budget_max NUMERIC DEFAULT NULL,
  p_notes      TEXT DEFAULT NULL,
  p_region     TEXT DEFAULT 'all_lebanon'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        TEXT := auth.uid()::text;
  v_free_limit INTEGER;
  v_this_month INTEGER;
  v_item_id    BIGINT;
  v_paid       BOOLEAN := false;
  v_request_id BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_make IS NULL OR length(trim(p_make)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'make_required');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM regions WHERE code = COALESCE(p_region, 'all_lebanon')) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_region');
  END IF;

  v_free_limit := public.app_config_numeric('free_car_requests_per_month', 2)::int;

  -- Serialize per-user quota checks: lock this user's row so two concurrent
  -- requests can't both pass the free-quota count.
  PERFORM 1 FROM users WHERE id = v_uid FOR UPDATE;

  SELECT COUNT(*) INTO v_this_month
    FROM car_requests
   WHERE user_id = v_uid
     AND created_at >= date_trunc('month', now());

  IF v_this_month >= v_free_limit THEN
    v_item_id := public.consume_wallet_item(v_uid, 'car_request', NULL, NULL, 'car_request');
    IF v_item_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'reason', 'payment_required',
                                'used_this_month', v_this_month, 'free_limit', v_free_limit);
    END IF;
    v_paid := true;
  END IF;

  INSERT INTO car_requests (user_id, make, model, year_min, year_max, budget_min, budget_max, notes, region, paid, wallet_item_id)
  VALUES (v_uid, trim(p_make), NULLIF(trim(p_model), ''), p_year_min, p_year_max, p_budget_min, p_budget_max, NULLIF(trim(p_notes), ''), COALESCE(p_region, 'all_lebanon'), v_paid, v_item_id)
  RETURNING id INTO v_request_id;

  UPDATE wallet_items SET consumed_ref = 'car_request:' || v_request_id WHERE id = v_item_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id, 'paid', v_paid);
END;
$$;

REVOKE ALL ON FUNCTION public.create_car_request(TEXT, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_car_request(TEXT, TEXT, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. remove_car_request — owner deletes from profile (US-01)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_car_request(p_request_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE car_requests
     SET status = 'removed'
   WHERE id = p_request_id
     AND user_id = auth.uid()::text
     AND status = 'active'
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.remove_car_request(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_car_request(BIGINT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 6. get_car_requests_feed — dealership feed (newest first, region filter,
--    per-dealership dismissals excluded). Includes requester contact info
--    (name + phone) needed for the call/WhatsApp buttons.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_car_requests_feed(
  p_region TEXT DEFAULT NULL,
  p_limit  INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           TEXT := auth.uid()::text;
  v_dealership_id BIGINT;
  v_result        JSONB;
BEGIN
  SELECT id INTO v_dealership_id FROM dealerships WHERE user_id = v_uid LIMIT 1;
  IF v_dealership_id IS NULL THEN
    RAISE EXCEPTION 'Not a dealership account';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb) INTO v_result
  FROM (
    SELECT jsonb_build_object(
             'id', r.id,
             'make', r.make,
             'model', r.model,
             'year_min', r.year_min,
             'year_max', r.year_max,
             'budget_min', r.budget_min,
             'budget_max', r.budget_max,
             'notes', r.notes,
             'region', r.region,
             'region_name_en', rg.name_en,
             'region_name_ar', rg.name_ar,
             'created_at', r.created_at,
             'expires_at', r.expires_at,
             'user_id', r.user_id,
             'user_name', u.name,
             'user_phone', u.phone_number
           ) AS row_data
      FROM car_requests r
      JOIN users u ON u.id = r.user_id
      JOIN regions rg ON rg.code = r.region
     WHERE r.status = 'active'
       AND r.expires_at > now()
       AND (p_region IS NULL OR r.region = p_region OR r.region = 'all_lebanon')
       AND NOT EXISTS (
         SELECT 1 FROM car_request_dismissals dd
         WHERE dd.request_id = r.id AND dd.dealership_id = v_dealership_id
       )
     ORDER BY r.created_at DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
     OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) t;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_car_requests_feed(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_car_requests_feed(TEXT, INTEGER, INTEGER) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. dismiss_car_request — dealership X button (no user notification)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dismiss_car_request(p_request_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealership_id BIGINT;
BEGIN
  SELECT id INTO v_dealership_id FROM dealerships WHERE user_id = auth.uid()::text LIMIT 1;
  IF v_dealership_id IS NULL THEN
    RAISE EXCEPTION 'Not a dealership account';
  END IF;

  INSERT INTO car_request_dismissals (request_id, dealership_id)
  VALUES (p_request_id, v_dealership_id)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_car_request(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_car_request(BIGINT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. log_request_contact — records a dealership contacting the requester and
--    notifies the user (US-03). For channel 'chat' it finds-or-creates the
--    conversation linked to the request SERVER-SIDE (dealer-initiated
--    conversation inserts would otherwise depend on client RLS) and returns
--    its id so the app can navigate straight into the thread.
--    Returns jsonb: { success, conversation_id? }
-- ----------------------------------------------------------------------------
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

  INSERT INTO car_request_contacts (request_id, dealership_id, contact_user_id, channel, conversation_id)
  VALUES (p_request_id, v_dealership.id, v_uid, p_channel, v_conversation_id);

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

  RETURN jsonb_build_object('success', true, 'conversation_id', v_conversation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.log_request_contact(BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_request_contact(BIGINT, TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 9. expire_car_requests — hourly cron
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_car_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE car_requests
     SET status = 'expired'
   WHERE status = 'active'
     AND expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE LOG 'expire_car_requests: expired % requests', v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_car_requests() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('expire-car-requests', '25 * * * *', 'SELECT public.expire_car_requests()');
