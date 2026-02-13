-- ============================================================
-- Banner Analytics Tables & SECURITY DEFINER RPC Functions
-- Tracks impressions and clicks for banners and ad_banners
-- Tables are fully locked from direct client access
-- ============================================================

-- 1. banner_analytics table
CREATE TABLE IF NOT EXISTS public.banner_analytics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  banner_id bigint NOT NULL REFERENCES public.banners(id) ON DELETE CASCADE,
  viewer_id text NOT NULL,
  viewer_type text NOT NULL CHECK (viewer_type IN ('user', 'guest')),
  event_type text NOT NULL CHECK (event_type IN ('impression', 'click')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for aggregation queries
CREATE INDEX idx_banner_analytics_banner_event ON public.banner_analytics (banner_id, event_type);
CREATE INDEX idx_banner_analytics_unique_viewer ON public.banner_analytics (banner_id, viewer_id, event_type);
CREATE INDEX idx_banner_analytics_created_at ON public.banner_analytics (created_at);

-- Enable RLS with ZERO policies (no direct access)
ALTER TABLE public.banner_analytics ENABLE ROW LEVEL SECURITY;

-- Revoke all direct table permissions from client roles
REVOKE ALL ON public.banner_analytics FROM anon, authenticated;

-- 2. ad_banner_analytics table
CREATE TABLE IF NOT EXISTS public.ad_banner_analytics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ad_banner_id bigint NOT NULL REFERENCES public.ad_banners(id) ON DELETE CASCADE,
  viewer_id text NOT NULL,
  viewer_type text NOT NULL CHECK (viewer_type IN ('user', 'guest')),
  event_type text NOT NULL CHECK (event_type IN ('impression', 'click')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for aggregation queries
CREATE INDEX idx_ad_banner_analytics_banner_event ON public.ad_banner_analytics (ad_banner_id, event_type);
CREATE INDEX idx_ad_banner_analytics_unique_viewer ON public.ad_banner_analytics (ad_banner_id, viewer_id, event_type);
CREATE INDEX idx_ad_banner_analytics_created_at ON public.ad_banner_analytics (created_at);

-- Enable RLS with ZERO policies (no direct access)
ALTER TABLE public.ad_banner_analytics ENABLE ROW LEVEL SECURITY;

-- Revoke all direct table permissions from client roles
REVOKE ALL ON public.ad_banner_analytics FROM anon, authenticated;

-- 3. RPC: track_banner_event (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.track_banner_event(
  p_banner_id bigint,
  p_viewer_id text,
  p_viewer_type text,
  p_event_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate event_type
  IF p_event_type NOT IN ('impression', 'click') THEN
    RAISE EXCEPTION 'Invalid event_type: %. Must be impression or click.', p_event_type;
  END IF;

  -- Validate viewer_type
  IF p_viewer_type NOT IN ('user', 'guest') THEN
    RAISE EXCEPTION 'Invalid viewer_type: %. Must be user or guest.', p_viewer_type;
  END IF;

  -- Validate viewer_id is not empty
  IF p_viewer_id IS NULL OR trim(p_viewer_id) = '' THEN
    RAISE EXCEPTION 'viewer_id cannot be empty.';
  END IF;

  -- Validate banner exists
  IF NOT EXISTS (SELECT 1 FROM banners WHERE id = p_banner_id) THEN
    RAISE EXCEPTION 'Banner with id % does not exist.', p_banner_id;
  END IF;

  -- Deduplicate: skip if same viewer already registered this event within the last hour
  IF EXISTS (
    SELECT 1 FROM banner_analytics
    WHERE banner_id = p_banner_id
      AND viewer_id = trim(p_viewer_id)
      AND event_type = p_event_type
      AND created_at > now() - interval '1 hour'
  ) THEN
    RETURN;
  END IF;

  -- Insert the analytics event
  INSERT INTO banner_analytics (banner_id, viewer_id, viewer_type, event_type)
  VALUES (p_banner_id, trim(p_viewer_id), p_viewer_type, p_event_type);
END;
$$;

-- Grant execute to client roles
GRANT EXECUTE ON FUNCTION public.track_banner_event(bigint, text, text, text) TO anon, authenticated;

-- 4. RPC: track_ad_banner_event (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.track_ad_banner_event(
  p_ad_banner_id bigint,
  p_viewer_id text,
  p_viewer_type text,
  p_event_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate event_type
  IF p_event_type NOT IN ('impression', 'click') THEN
    RAISE EXCEPTION 'Invalid event_type: %. Must be impression or click.', p_event_type;
  END IF;

  -- Validate viewer_type
  IF p_viewer_type NOT IN ('user', 'guest') THEN
    RAISE EXCEPTION 'Invalid viewer_type: %. Must be user or guest.', p_viewer_type;
  END IF;

  -- Validate viewer_id is not empty
  IF p_viewer_id IS NULL OR trim(p_viewer_id) = '' THEN
    RAISE EXCEPTION 'viewer_id cannot be empty.';
  END IF;

  -- Validate ad banner exists
  IF NOT EXISTS (SELECT 1 FROM ad_banners WHERE id = p_ad_banner_id) THEN
    RAISE EXCEPTION 'Ad banner with id % does not exist.', p_ad_banner_id;
  END IF;

  -- Deduplicate: skip if same viewer already registered this event within the last hour
  IF EXISTS (
    SELECT 1 FROM ad_banner_analytics
    WHERE ad_banner_id = p_ad_banner_id
      AND viewer_id = trim(p_viewer_id)
      AND event_type = p_event_type
      AND created_at > now() - interval '1 hour'
  ) THEN
    RETURN;
  END IF;

  -- Insert the analytics event
  INSERT INTO ad_banner_analytics (ad_banner_id, viewer_id, viewer_type, event_type)
  VALUES (p_ad_banner_id, trim(p_viewer_id), p_viewer_type, p_event_type);
END;
$$;

-- Grant execute to client roles
GRANT EXECUTE ON FUNCTION public.track_ad_banner_event(bigint, text, text, text) TO anon, authenticated;

-- ============================================================
-- Useful analytics queries (for reference, run in Supabase SQL editor)
-- ============================================================

-- Total impressions per banner
-- SELECT banner_id, COUNT(*) AS total_impressions
-- FROM banner_analytics WHERE event_type = 'impression'
-- GROUP BY banner_id ORDER BY total_impressions DESC;

-- Unique viewers per banner
-- SELECT banner_id, COUNT(DISTINCT viewer_id) AS unique_viewers
-- FROM banner_analytics WHERE event_type = 'impression'
-- GROUP BY banner_id ORDER BY unique_viewers DESC;

-- Click-through rate per banner
-- SELECT banner_id,
--   COUNT(*) FILTER (WHERE event_type = 'click') AS clicks,
--   COUNT(*) FILTER (WHERE event_type = 'impression') AS impressions,
--   ROUND(
--     COUNT(*) FILTER (WHERE event_type = 'click')::numeric /
--     NULLIF(COUNT(*) FILTER (WHERE event_type = 'impression'), 0) * 100, 2
--   ) AS ctr_percent
-- FROM banner_analytics GROUP BY banner_id ORDER BY ctr_percent DESC;

-- Same queries work for ad_banner_analytics (replace banner_id with ad_banner_id)
