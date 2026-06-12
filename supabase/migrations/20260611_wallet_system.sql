-- ============================================================================
-- Migration: Wallet System (item-based)
-- Date: 2026-06-11
-- Description: Rebuilds the wallet on an item-based model (F-01, F-02).
--   A wallet holds discrete consumable items ('listing', 'featured_ad',
--   'car_request'), each with its OWN expiry date:
--     - bought online (in-app via Whish): expires item_validity_days (~30) after purchase
--     - granted offline by admin (custom-priced packages): expires 1 year after grant
--   Money is tracked in wallet_acquisitions (one row per purchase/grant/refund)
--   for revenue analytics. Items are tracked in wallet_items (one row per
--   consumable) — no numeric balances, no FIFO time-window hacks.
--
--   KEEPS legacy users.credit_balance untouched (old builds read it).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Whish external-id sequence
--    Legacy flows used Date.now() (~1.78e12 in 2026) as externalId. Start the
--    sequence above any plausible Date.now() value so ids never collide with
--    historical payment_logs ids on Whish's side.
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.wallet_whish_external_id_seq
  START WITH 2000000000001;

-- ----------------------------------------------------------------------------
-- 1. wallet_acquisitions — the money ledger + idempotency anchor
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_acquisitions (
  id                  BIGSERIAL PRIMARY KEY,
  owner_user_id       TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- SET NULL: wallet history must never block deleting a dealership
  dealership_id       BIGINT REFERENCES public.dealerships(id) ON DELETE SET NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('online_purchase', 'admin_grant', 'admin_refund')),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'void')),
  package_id          BIGINT,
  -- Payment-provider abstraction: Whish (today) anchors idempotency on
  -- whish_external_id (numeric, sequence-backed). Future providers (Stripe,
  -- Apple IAP, ...) set payment_provider + provider_ref (their string id)
  -- and reuse the exact same pending→paid crediting flow.
  payment_provider    TEXT NOT NULL DEFAULT 'whish',
  provider_ref        TEXT,
  whish_external_id   BIGINT UNIQUE DEFAULT nextval('public.wallet_whish_external_id_seq'),
  total_price_usd     NUMERIC(10,2) NOT NULL DEFAULT 0,
  item_counts         JSONB NOT NULL DEFAULT '{}'::jsonb,
  item_validity_days  INTEGER NOT NULL DEFAULT 30,
  created_by          TEXT,
  notes               TEXT,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wallet_acquisitions IS 'One row per wallet money event: online purchase (Whish), admin grant (offline package), or admin refund (negative amount). Source of truth for revenue analytics.';
COMMENT ON COLUMN public.wallet_acquisitions.total_price_usd IS 'Negative for admin_refund. For admin_grant, record the offline package price so revenue stays truthful.';
COMMENT ON COLUMN public.wallet_acquisitions.item_counts IS 'e.g. {"listing":5,"featured_ad":2}';
COMMENT ON COLUMN public.wallet_acquisitions.whish_external_id IS 'Whish externalId; UNIQUE constraint is the callback idempotency anchor.';

CREATE INDEX IF NOT EXISTS idx_wallet_acq_owner ON public.wallet_acquisitions(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_acq_dealership ON public.wallet_acquisitions(dealership_id) WHERE dealership_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_acq_status_pending ON public.wallet_acquisitions(created_at) WHERE status = 'pending';
-- Idempotency anchor for future non-Whish providers (one ref per provider)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_acq_provider_ref
  ON public.wallet_acquisitions(payment_provider, provider_ref)
  WHERE provider_ref IS NOT NULL;

ALTER TABLE public.wallet_acquisitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own acquisitions" ON public.wallet_acquisitions;
CREATE POLICY "Owners can view own acquisitions"
  ON public.wallet_acquisitions FOR SELECT
  USING (owner_user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Service role manages acquisitions" ON public.wallet_acquisitions;
CREATE POLICY "Service role manages acquisitions"
  ON public.wallet_acquisitions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 2. wallet_items — the inventory, one row per consumable right
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_items (
  id                    BIGSERIAL PRIMARY KEY,
  acquisition_id        BIGINT NOT NULL REFERENCES public.wallet_acquisitions(id) ON DELETE CASCADE,
  owner_user_id         TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dealership_id         BIGINT REFERENCES public.dealerships(id) ON DELETE SET NULL,
  item_type             TEXT NOT NULL CHECK (item_type IN ('listing', 'featured_ad', 'car_request')),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired', 'revoked', 'refunded')),
  unit_price_usd        NUMERIC(10,2) NOT NULL DEFAULT 0,
  expires_at            TIMESTAMPTZ NOT NULL,
  consumed_at           TIMESTAMPTZ,
  consumed_listing_type TEXT CHECK (consumed_listing_type IN ('sale', 'rent', 'plate') OR consumed_listing_type IS NULL),
  consumed_listing_id   BIGINT,
  consumed_ref          TEXT,
  revoked_at            TIMESTAMPTZ,
  revoked_by            TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wallet_items IS 'One row per consumable wallet right. Consumption/refund is a single-row state transition — no numeric balance anywhere.';
COMMENT ON COLUMN public.wallet_items.unit_price_usd IS 'Prorated share of the acquisition price. 0 = free/promo (free-vs-paid analytics).';

-- Hot path: "does the owner have an item of this type? take the soonest-expiring"
CREATE INDEX IF NOT EXISTS idx_wallet_items_consume
  ON public.wallet_items(owner_user_id, item_type, expires_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wallet_items_expiry
  ON public.wallet_items(expires_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wallet_items_acquisition ON public.wallet_items(acquisition_id);
CREATE INDEX IF NOT EXISTS idx_wallet_items_dealership ON public.wallet_items(dealership_id) WHERE dealership_id IS NOT NULL;

ALTER TABLE public.wallet_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own wallet items" ON public.wallet_items;
CREATE POLICY "Owners can view own wallet items"
  ON public.wallet_items FOR SELECT
  USING (owner_user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Service role manages wallet items" ON public.wallet_items;
CREATE POLICY "Service role manages wallet items"
  ON public.wallet_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ----------------------------------------------------------------------------
-- 3. pricing_packages — admin-editable online price list
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id                    BIGSERIAL PRIMARY KEY,
  code                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  name_ar               TEXT,
  description           TEXT,
  description_ar        TEXT,
  contents              JSONB NOT NULL,
  price_usd             NUMERIC(10,2) NOT NULL CHECK (price_usd >= 0),
  compare_at_price_usd  NUMERIC(10,2) CHECK (compare_at_price_usd IS NULL OR compare_at_price_usd >= price_usd),
  audience              TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('user', 'dealer', 'all')),
  item_validity_days    INTEGER NOT NULL DEFAULT 30 CHECK (item_validity_days > 0),
  active                BOOLEAN NOT NULL DEFAULT true,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  updated_by            TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pricing_packages IS 'Online (in-app) packages. Edited from the admin dashboard — never hardcode prices in app or edge functions. Offline dealership packages are NOT listed here; admin grants them directly.';
COMMENT ON COLUMN public.pricing_packages.compare_at_price_usd IS 'Strike-through price for displaying discounts.';

ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active packages" ON public.pricing_packages;
CREATE POLICY "Anyone can view active packages"
  ON public.pricing_packages FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "Service role manages packages" ON public.pricing_packages;
CREATE POLICY "Service role manages packages"
  ON public.pricing_packages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- PLACEHOLDER seed — client provides final pricing via the admin pricing editor.
INSERT INTO public.pricing_packages (code, name, contents, price_usd, compare_at_price_usd, audience, item_validity_days, sort_order)
VALUES
  ('featured_1',  '1 Featured Ad',   '{"featured_ad":1}'::jsonb, 9.99,  NULL,  'all', 30, 10),
  ('featured_3',  '3 Featured Ads',  '{"featured_ad":3}'::jsonb, 24.99, 29.97, 'all', 30, 20),
  ('listing_1',   '1 Extra Listing', '{"listing":1}'::jsonb,     4.99,  NULL,  'all', 30, 30),
  ('listing_3',   '3 Extra Listings','{"listing":3}'::jsonb,     11.99, 14.97, 'all', 30, 40),
  ('request_1',   '1 Car Request',   '{"car_request":1}'::jsonb, 1.99,  NULL,  'user', 30, 50)
ON CONFLICT (code) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. app_config — admin-tunable business rules (no code changes to adjust)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app config" ON public.app_config;
CREATE POLICY "Anyone can read app config"
  ON public.app_config FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role manages app config" ON public.app_config;
CREATE POLICY "Service role manages app config"
  ON public.app_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.app_config (key, value, description) VALUES
  ('listing_duration_days',        '60'::jsonb,    'Listings expire this many days after posting (2 months).'),
  ('feature_duration_days',        '8'::jsonb,     'An applied featured ad lasts this many days on a listing.'),
  ('free_car_requests_per_month',  '2'::jsonb,     'Free car requests per user per calendar month; beyond this a car_request wallet item is consumed.'),
  ('min_offer_ratio',              '0.85'::jsonb,  'Minimum buyer offer as a fraction of listing price (85% = max 15% discount).'),
  ('free_active_listings_user',    '1'::jsonb,     'Free active listings for regular users before listing items are required. NOTE: not specified in the client PDFs — adjust from admin.'),
  ('enforce_listing_slots',        'false'::jsonb, 'Rollout switch: when true, posting a listing beyond the free allowance consumes a listing wallet item.')
ON CONFLICT (key) DO NOTHING;

-- Helpers to read config inside SQL functions
CREATE OR REPLACE FUNCTION public.app_config_numeric(p_key TEXT, p_default NUMERIC)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE((SELECT (value #>> '{}')::numeric FROM public.app_config WHERE key = p_key), p_default);
$$;

CREATE OR REPLACE FUNCTION public.app_config_bool(p_key TEXT, p_default BOOLEAN)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE((SELECT (value #>> '{}')::boolean FROM public.app_config WHERE key = p_key), p_default);
$$;

-- ----------------------------------------------------------------------------
-- 5. Internal: insert items for a paid/granted acquisition
--    unit_price_usd = prorated share of the acquisition total (2dp).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._insert_wallet_items_for_acquisition(p_acquisition_id BIGINT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acq         RECORD;
  v_entry       RECORD;
  v_total_items INTEGER := 0;
  v_unit_price  NUMERIC(10,2);
  v_inserted    INTEGER := 0;
BEGIN
  SELECT * INTO v_acq FROM wallet_acquisitions WHERE id = p_acquisition_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acquisition % not found', p_acquisition_id;
  END IF;

  SELECT COALESCE(SUM((value)::int), 0) INTO v_total_items
  FROM jsonb_each_text(v_acq.item_counts);

  IF v_total_items <= 0 THEN
    RETURN 0;
  END IF;

  v_unit_price := round(GREATEST(v_acq.total_price_usd, 0) / v_total_items, 2);

  FOR v_entry IN SELECT key, value::int AS cnt FROM jsonb_each_text(v_acq.item_counts) LOOP
    IF v_entry.key NOT IN ('listing', 'featured_ad', 'car_request') THEN
      RAISE EXCEPTION 'Unknown wallet item type: %', v_entry.key;
    END IF;
    INSERT INTO wallet_items (acquisition_id, owner_user_id, dealership_id, item_type, unit_price_usd, expires_at)
    SELECT v_acq.id, v_acq.owner_user_id, v_acq.dealership_id, v_entry.key, v_unit_price,
           now() + (v_acq.item_validity_days || ' days')::interval
    FROM generate_series(1, v_entry.cnt);
    v_inserted := v_inserted + v_entry.cnt;
  END LOOP;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public._insert_wallet_items_for_acquisition(BIGINT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. credit_wallet_purchase — called by the Whish callback / status poll
--    (service role only). Idempotent by construction: only the transaction
--    that wins the pending→paid row-lock transition inserts items. Replayed
--    callbacks and concurrent polls are no-ops.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_wallet_purchase(p_external_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acq      RECORD;
  v_inserted INTEGER;
BEGIN
  UPDATE wallet_acquisitions
     SET status = 'paid', paid_at = now()
   WHERE whish_external_id = p_external_id
     AND status = 'pending'
  RETURNING * INTO v_acq;

  IF NOT FOUND THEN
    SELECT * INTO v_acq FROM wallet_acquisitions WHERE whish_external_id = p_external_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('credited', false, 'reason', 'unknown_external_id');
    END IF;
    RETURN jsonb_build_object('credited', false, 'reason', 'already_' || v_acq.status);
  END IF;

  v_inserted := public._insert_wallet_items_for_acquisition(v_acq.id);

  RETURN jsonb_build_object('credited', true, 'acquisition_id', v_acq.id, 'items_inserted', v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_wallet_purchase(BIGINT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. mark_wallet_purchase_failed — callback/poll records a failed payment
--    (service role only). Only transitions pending → failed.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_wallet_purchase_failed(p_external_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE wallet_acquisitions
     SET status = 'failed'
   WHERE whish_external_id = p_external_id
     AND status = 'pending'
  RETURNING true;
$$;

REVOKE ALL ON FUNCTION public.mark_wallet_purchase_failed(BIGINT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. admin_grant_wallet_items — offline dealership packages & manual top-ups
--    (service role only — called from the admin dashboard API routes).
--    Items expire 1 year after grant by default.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_wallet_items(
  p_owner_user_id   TEXT,
  p_item_counts     JSONB,
  p_total_price_usd NUMERIC,
  p_created_by      TEXT,
  p_notes           TEXT DEFAULT NULL,
  p_validity_days   INTEGER DEFAULT 365
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dealership_id BIGINT;
  v_acq_id        BIGINT;
  v_inserted      INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_owner_user_id) THEN
    RAISE EXCEPTION 'User % not found', p_owner_user_id;
  END IF;

  SELECT id INTO v_dealership_id FROM dealerships WHERE user_id = p_owner_user_id LIMIT 1;

  INSERT INTO wallet_acquisitions (
    owner_user_id, dealership_id, kind, status, total_price_usd,
    item_counts, item_validity_days, created_by, notes, paid_at, whish_external_id
  ) VALUES (
    p_owner_user_id, v_dealership_id, 'admin_grant', 'paid', COALESCE(p_total_price_usd, 0),
    p_item_counts, p_validity_days, p_created_by, p_notes, now(), NULL
  )
  RETURNING id INTO v_acq_id;

  v_inserted := public._insert_wallet_items_for_acquisition(v_acq_id);

  RETURN jsonb_build_object('acquisition_id', v_acq_id, 'items_inserted', v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_wallet_items(TEXT, JSONB, NUMERIC, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. admin_revoke_wallet_items / admin_refund_wallet_items
--    (service role only). Refund inserts a NEGATIVE admin_refund acquisition;
--    original purchase rows are never mutated, so revenue sums stay truthful.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_revoke_wallet_items(
  p_item_ids   BIGINT[],
  p_revoked_by TEXT,
  p_notes      TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE wallet_items
     SET status = 'revoked',
         revoked_at = now(),
         revoked_by = p_revoked_by,
         metadata = metadata || jsonb_build_object('revoke_notes', p_notes)
   WHERE id = ANY(p_item_ids)
     AND status = 'active';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_wallet_items(BIGINT[], TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_refund_wallet_items(
  p_item_ids      BIGINT[],
  p_refund_amount NUMERIC,
  p_created_by    TEXT,
  p_notes         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner   TEXT;
  v_owners  INTEGER;
  v_count   INTEGER;
  v_acq_id  BIGINT;
  v_dealership_id BIGINT;
BEGIN
  -- All refunded items must belong to one owner (one refund ledger row).
  SELECT COUNT(DISTINCT owner_user_id), MIN(owner_user_id)
    INTO v_owners, v_owner
    FROM wallet_items
   WHERE id = ANY(p_item_ids);

  IF v_owners = 0 THEN
    RAISE EXCEPTION 'No wallet items found for given ids';
  ELSIF v_owners > 1 THEN
    RAISE EXCEPTION 'Refund items must all belong to the same owner';
  END IF;

  UPDATE wallet_items
     SET status = 'refunded',
         revoked_at = now(),
         revoked_by = p_created_by,
         metadata = metadata || jsonb_build_object('refund_notes', p_notes)
   WHERE id = ANY(p_item_ids)
     AND status IN ('active', 'consumed');
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No refundable (active/consumed) items in given ids';
  END IF;

  SELECT id INTO v_dealership_id FROM dealerships WHERE user_id = v_owner LIMIT 1;

  INSERT INTO wallet_acquisitions (
    owner_user_id, dealership_id, kind, status, total_price_usd,
    item_counts, created_by, notes, paid_at, whish_external_id
  ) VALUES (
    v_owner, v_dealership_id, 'admin_refund', 'paid', -ABS(COALESCE(p_refund_amount, 0)),
    jsonb_build_object('refunded_items', v_count), p_created_by, p_notes, now(), NULL
  )
  RETURNING id INTO v_acq_id;

  RETURN jsonb_build_object('refund_acquisition_id', v_acq_id, 'items_refunded', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_refund_wallet_items(BIGINT[], NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. consume_wallet_item — INTERNAL primitive used by feature/listing/request
--     RPCs. Single-statement consume: no check-then-act race. SKIP LOCKED makes
--     concurrent consumers take different rows instead of blocking/failing.
--     Returns the consumed item id, or NULL if none available.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_wallet_item(
  p_owner_user_id TEXT,
  p_item_type     TEXT,
  p_listing_type  TEXT DEFAULT NULL,
  p_listing_id    BIGINT DEFAULT NULL,
  p_ref           TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id BIGINT;
BEGIN
  UPDATE wallet_items
     SET status = 'consumed',
         consumed_at = now(),
         consumed_listing_type = p_listing_type,
         consumed_listing_id = p_listing_id,
         consumed_ref = p_ref
   WHERE id = (
     SELECT id FROM wallet_items
      WHERE owner_user_id = p_owner_user_id
        AND item_type = p_item_type
        AND status = 'active'
        AND expires_at > now()
      ORDER BY expires_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING id INTO v_item_id;

  RETURN v_item_id;  -- NULL when no active item is available
END;
$$;

REVOKE ALL ON FUNCTION public.consume_wallet_item(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 11. get_my_wallet — client RPC (authenticated). Summary counts + item list.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_wallet()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'summary', (
      SELECT COALESCE(jsonb_object_agg(t.item_type, jsonb_build_object(
        'active', t.active_count,
        'next_expiry', t.next_expiry
      )), '{}'::jsonb)
      FROM (
        SELECT item_type,
               COUNT(*) AS active_count,
               MIN(expires_at) AS next_expiry
          FROM wallet_items
         WHERE owner_user_id = auth.uid()::text
           AND status = 'active'
           AND expires_at > now()
         GROUP BY item_type
      ) t
    ),
    'items', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', wi.id,
        'item_type', wi.item_type,
        'status', CASE WHEN wi.status = 'active' AND wi.expires_at <= now() THEN 'expired' ELSE wi.status END,
        'unit_price_usd', wi.unit_price_usd,
        'expires_at', wi.expires_at,
        'consumed_at', wi.consumed_at,
        'consumed_listing_type', wi.consumed_listing_type,
        'consumed_listing_id', wi.consumed_listing_id,
        'source', wa.kind,
        'created_at', wi.created_at
      ) ORDER BY (wi.status = 'active') DESC, wi.expires_at ASC), '[]'::jsonb)
      FROM wallet_items wi
      JOIN wallet_acquisitions wa ON wa.id = wi.acquisition_id
      WHERE wi.owner_user_id = auth.uid()::text
        AND wi.created_at > now() - interval '18 months'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_my_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_wallet() TO authenticated;

-- ----------------------------------------------------------------------------
-- 12. expire_wallet_items — nightly cron 23:59 UTC (mirrors old credit batches)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_wallet_items()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
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

  RAISE LOG 'expire_wallet_items: expired % items', v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_wallet_items() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'expire-wallet-items',
  '59 23 * * *',
  'SELECT public.expire_wallet_items()'
);
