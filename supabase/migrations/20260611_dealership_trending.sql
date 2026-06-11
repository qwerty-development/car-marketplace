-- ============================================================================
-- Migration: Dealership Inventory Insights — trending (US-17)
-- Date: 2026-06-11
-- Description: "Trending this week" — top 2 most-viewed cars per dealership
--   over the trailing 7 days, rebuilt weekly from listing_analytics_events.
--   Plain truncate+rebuild table (tiny data) beats a materialized view here:
--   simple RLS, no concurrent-refresh unique-index requirements.
--   Per client note: early weeks may shift daily until enough click data
--   accumulates; the weekly refresh is the steady state.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dealership_trending (
  dealership_id BIGINT NOT NULL REFERENCES public.dealerships(id) ON DELETE CASCADE,
  listing_type  TEXT NOT NULL DEFAULT 'sale',
  listing_id    BIGINT NOT NULL,
  make          TEXT,
  model         TEXT,
  event_count   INTEGER NOT NULL,
  rank          INTEGER NOT NULL,
  week_start    DATE NOT NULL,
  refreshed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dealership_id, listing_type, rank, week_start)
);

ALTER TABLE public.dealership_trending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dealers can view own trending" ON public.dealership_trending;
CREATE POLICY "Dealers can view own trending"
  ON public.dealership_trending FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.dealerships d
    WHERE d.id = dealership_id AND d.user_id = auth.uid()::text
  ));

DROP POLICY IF EXISTS "Service role manages trending" ON public.dealership_trending;
CREATE POLICY "Service role manages trending"
  ON public.dealership_trending FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.refresh_dealership_trending()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM dealership_trending;

  INSERT INTO dealership_trending (dealership_id, listing_type, listing_id, make, model, event_count, rank, week_start)
  SELECT ranked.dealership_id, 'sale', ranked.listing_id, c.make, c.model,
         ranked.event_count, ranked.rank, date_trunc('week', now())::date
    FROM (
      SELECT e.dealership_id, e.listing_id,
             COUNT(*)::int AS event_count,
             row_number() OVER (PARTITION BY e.dealership_id ORDER BY COUNT(*) DESC, e.listing_id) AS rank
        FROM listing_analytics_events e
       WHERE e.event_type = 'view'
         AND e.listing_type = 'sale'
         AND e.dealership_id IS NOT NULL
         AND e.created_at >= now() - interval '7 days'
       GROUP BY e.dealership_id, e.listing_id
    ) ranked
    JOIN cars c ON c.id = ranked.listing_id
   WHERE ranked.rank <= 2
     AND c.status = 'available';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RAISE LOG 'refresh_dealership_trending: % rows', v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_dealership_trending() FROM PUBLIC, anon, authenticated;

-- Weekly: Sunday 21:00 UTC = Monday 00:00 Asia/Beirut (EEST). The data is
-- defined by created_at >= now()-7d, so DST drift only shifts the refresh hour.
SELECT cron.schedule('refresh-dealership-trending', '0 21 * * 0', 'SELECT public.refresh_dealership_trending()');

-- Initial populate so the section isn't empty until next Monday
SELECT public.refresh_dealership_trending();
