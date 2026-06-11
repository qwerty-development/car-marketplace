-- ============================================================================
-- Migration: User Listing Analytics (US-15, US-16)
-- Date: 2026-06-11
-- Description:
--   - Impression tracking: batched client events land in
--     listing_analytics_events with event_type='impression' (CHECK already
--     extended in 20260611_offers.sql). Anon-callable like the existing
--     track_* RPCs; batch-capped; 90-day retention (impressions only).
--   - get_my_listing_stats: per-listing impressions/views/offers + totals for
--     the current user's own listings (sale cars + number plates).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. record_listing_impressions — single batched insert
--    p_events: [{ "listing_type": "sale"|"rent"|"plate", "listing_id": 123 }, ...]
--    Viewer identity comes from auth when present; guests pass viewer_id (the
--    AsyncStorage guest UUID) like the existing track RPCs.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_listing_impressions(
  p_events    JSONB,
  p_viewer_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         TEXT := auth.uid()::text;
  v_viewer_id   TEXT;
  v_viewer_type TEXT;
  v_count       INTEGER := 0;
  v_n           INTEGER;
BEGIN
  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN
    RETURN 0;
  END IF;
  v_n := jsonb_array_length(p_events);
  IF v_n = 0 THEN
    RETURN 0;
  END IF;
  IF v_n > 100 THEN
    RAISE EXCEPTION 'Batch too large (max 100 events)';
  END IF;

  v_viewer_id := COALESCE(v_uid, NULLIF(trim(p_viewer_id), ''));
  v_viewer_type := CASE WHEN v_uid IS NOT NULL THEN 'user' ELSE 'guest' END;

  -- Sale cars
  INSERT INTO listing_analytics_events (listing_type, listing_id, dealership_id, seller_user_id, viewer_id, viewer_type, event_type)
  SELECT 'sale', c.id, c.dealership_id, c.user_id, v_viewer_id, v_viewer_type, 'impression'
    FROM (
      SELECT DISTINCT (e->>'listing_id')::bigint AS listing_id
        FROM jsonb_array_elements(p_events) e
       WHERE e->>'listing_type' = 'sale' AND (e->>'listing_id') ~ '^[0-9]+$'
    ) batch
    JOIN cars c ON c.id = batch.listing_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  -- Rentals
  INSERT INTO listing_analytics_events (listing_type, listing_id, dealership_id, seller_user_id, viewer_id, viewer_type, event_type)
  SELECT 'rent', c.id, c.dealership_id, NULL, v_viewer_id, v_viewer_type, 'impression'
    FROM (
      SELECT DISTINCT (e->>'listing_id')::bigint AS listing_id
        FROM jsonb_array_elements(p_events) e
       WHERE e->>'listing_type' = 'rent' AND (e->>'listing_id') ~ '^[0-9]+$'
    ) batch
    JOIN cars_rent c ON c.id = batch.listing_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  -- Plates
  INSERT INTO listing_analytics_events (listing_type, listing_id, dealership_id, seller_user_id, viewer_id, viewer_type, event_type)
  SELECT 'plate', np.id, np.dealership_id, np.user_id, v_viewer_id, v_viewer_type, 'impression'
    FROM (
      SELECT DISTINCT (e->>'listing_id')::bigint AS listing_id
        FROM jsonb_array_elements(p_events) e
       WHERE e->>'listing_type' = 'plate' AND (e->>'listing_id') ~ '^[0-9]+$'
    ) batch
    JOIN number_plates np ON np.id = batch.listing_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_listing_impressions(JSONB, TEXT) TO anon, authenticated;

-- Index for the per-listing aggregations (events table is append-only)
CREATE INDEX IF NOT EXISTS idx_lae_listing_event
  ON public.listing_analytics_events(listing_type, listing_id, event_type);

-- ----------------------------------------------------------------------------
-- 2. get_my_listing_stats — per-listing + totals for the current user.
--    impressions/offers from events; views from the long-standing lifetime
--    counters on the listing rows (events only exist since 2026-05).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_listing_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_listings AS (
    SELECT 'sale'::text AS listing_type, c.id AS listing_id, COALESCE(c.views, 0) AS views, c.status::text AS status
      FROM cars c WHERE c.user_id = auth.uid()::text AND c.status <> 'deleted'
    UNION ALL
    SELECT 'plate', np.id, COALESCE(np.views, 0), np.status::text
      FROM number_plates np WHERE np.user_id = auth.uid()::text AND np.deleted_at IS NULL
  ),
  event_counts AS (
    SELECT e.listing_type, e.listing_id,
           COUNT(*) FILTER (WHERE e.event_type = 'impression') AS impressions,
           COUNT(*) FILTER (WHERE e.event_type = 'offer') AS offers
      FROM listing_analytics_events e
      JOIN my_listings ml ON ml.listing_type = e.listing_type AND ml.listing_id = e.listing_id
     GROUP BY e.listing_type, e.listing_id
  ),
  merged AS (
    SELECT ml.listing_type, ml.listing_id, ml.status,
           COALESCE(ec.impressions, 0) AS impressions,
           ml.views,
           COALESCE(ec.offers, 0) AS offers
      FROM my_listings ml
      LEFT JOIN event_counts ec ON ec.listing_type = ml.listing_type AND ec.listing_id = ml.listing_id
  )
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'impressions', COALESCE(SUM(impressions), 0),
        'views', COALESCE(SUM(views), 0),
        'offers', COALESCE(SUM(offers), 0)
      ) FROM merged
    ),
    'listings', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'listing_type', listing_type,
        'listing_id', listing_id,
        'status', status,
        'impressions', impressions,
        'views', views,
        'offers', offers
      )), '[]'::jsonb) FROM merged
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_my_listing_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_listing_stats() TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Retention: impressions run 10–50x views — prune impression rows older
--    than 90 days, monthly. All other event types are kept forever.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_impression_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM listing_analytics_events
   WHERE event_type = 'impression'
     AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE LOG 'prune_impression_events: removed % rows', v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_impression_events() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('prune-impression-events', '0 2 1 * *', 'SELECT public.prune_impression_events()');
