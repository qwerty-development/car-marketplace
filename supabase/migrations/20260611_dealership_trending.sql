-- ============================================================================
-- Migration: Market Trending — dealer insight (US-17)
-- Date: 2026-06-11 (reworked 2026-06-12: app-wide, not per-dealership)
-- Description: "Trending this week" — the top 2 most-viewed MAKE+MODEL
--   combinations across the WHOLE app over the trailing 7 days, rebuilt weekly
--   from listing_analytics_events. Shown on the dealer dashboard so dealers
--   know what the market is looking at. Aggregated by make+model on purpose:
--   no specific listing (or its owner's numbers) is ever exposed.
--   Plain truncate+rebuild table (tiny data) beats a materialized view here:
--   simple RLS, no concurrent-refresh unique-index requirements.
--   Per client note: early weeks may shift daily until enough click data
--   accumulates; the weekly refresh is the steady state.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_trending (
  week_start    DATE NOT NULL,
  rank          INTEGER NOT NULL,
  make          TEXT NOT NULL,
  model         TEXT NOT NULL,
  event_count   INTEGER NOT NULL,
  refreshed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (week_start, rank)
);

ALTER TABLE public.market_trending ENABLE ROW LEVEL SECURITY;

-- Dealer-only insight (owner decision 2026-06-12): role verified against the
-- users profile, not the client. Non-dealers simply get 0 rows (no error), so
-- the brief (dealer)-route mount for non-dealers during routing stays safe.
DROP POLICY IF EXISTS "Dealers can view market trending" ON public.market_trending;
CREATE POLICY "Dealers can view market trending"
  ON public.market_trending FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()::text AND u.role = 'dealer'
  ));

DROP POLICY IF EXISTS "Service role manages market trending" ON public.market_trending;
CREATE POLICY "Service role manages market trending"
  ON public.market_trending FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.refresh_market_trending()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM market_trending;

  -- Views on sold/expired cars still count: the demand signal is the point.
  -- Cars deleted since the view happened drop out via the JOIN (no make/model
  -- left to attribute them to).
  INSERT INTO market_trending (week_start, rank, make, model, event_count)
  SELECT date_trunc('week', now())::date, ranked.rank, ranked.make, ranked.model, ranked.event_count
    FROM (
      SELECT c.make, c.model,
             COUNT(*)::int AS event_count,
             row_number() OVER (ORDER BY COUNT(*) DESC, c.make, c.model) AS rank
        FROM listing_analytics_events e
        JOIN cars c ON c.id = e.listing_id
       WHERE e.event_type = 'view'
         AND e.listing_type = 'sale'
         AND e.created_at >= now() - interval '7 days'
         AND c.make IS NOT NULL AND c.make <> ''
         AND c.model IS NOT NULL AND c.model <> ''
       GROUP BY c.make, c.model
    ) ranked
   WHERE ranked.rank <= 2;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RAISE LOG 'refresh_market_trending: % rows', v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_market_trending() FROM PUBLIC, anon, authenticated;

-- Weekly: Sunday 21:00 UTC = Monday 00:00 Asia/Beirut (EEST). The data is
-- defined by created_at >= now()-7d, so DST drift only shifts the refresh hour.
SELECT cron.schedule('refresh-market-trending', '0 21 * * 0', 'SELECT public.refresh_market_trending()');

-- Initial populate so the section isn't empty until next Monday
SELECT public.refresh_market_trending();
