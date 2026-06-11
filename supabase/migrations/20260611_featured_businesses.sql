-- ============================================================================
-- Migration: Featured Businesses (US-07)
-- Date: 2026-06-11
-- Description: Admin-granted featured status on dealerships with optional
--   expiry. Featured dealerships sort to the top of the mobile dealership list
--   and show a badge. Toggled only from the admin dashboard (service role).
-- ============================================================================

ALTER TABLE public.dealerships
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

COMMENT ON COLUMN public.dealerships.is_featured IS 'Admin-granted featured business status (US-07). Cleared by cron when featured_until passes.';
COMMENT ON COLUMN public.dealerships.featured_until IS 'Optional expiry for featured status. NULL = until manually turned off.';

CREATE INDEX IF NOT EXISTS idx_dealerships_featured
  ON public.dealerships(is_featured) WHERE is_featured;

-- Daily cron: clear expired featured-business flags
CREATE OR REPLACE FUNCTION public.expire_featured_dealerships()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE dealerships
     SET is_featured = false, featured_until = NULL
   WHERE is_featured
     AND featured_until IS NOT NULL
     AND featured_until <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE LOG 'expire_featured_dealerships: cleared % dealerships', v_count;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_featured_dealerships() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('expire-featured-dealerships', '20 0 * * *', 'SELECT public.expire_featured_dealerships()');
