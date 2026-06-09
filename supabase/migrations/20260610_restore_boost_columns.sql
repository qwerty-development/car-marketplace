-- =============================================================================
-- RESTORE BOOST / CREDIT COLUMNS
--
-- Ensures columns exist after a partial credit teardown. Production store
-- builds still need them (home feed orders by boost_priority, etc.). A future
-- credit system may reuse these same columns — dropping them is optional, not
-- required for cleanup. See CREDIT_CLEANUP.md.
--
-- Safe to re-run: uses IF NOT EXISTS on every column.
-- =============================================================================

ALTER TABLE public.cars
  ADD COLUMN IF NOT EXISTS is_boosted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_priority integer,
  ADD COLUMN IF NOT EXISTS boost_end_date timestamptz;

ALTER TABLE public.cars_rent
  ADD COLUMN IF NOT EXISTS is_boosted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boost_priority integer,
  ADD COLUMN IF NOT EXISTS boost_end_date timestamptz;

-- Legacy profile credit balance (CreditContext on older builds)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS credit_balance numeric(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.cars.is_boosted IS 'Listing boost active flag; used by production app and may be reused by new credit system';
COMMENT ON COLUMN public.cars.boost_priority IS 'Boost sort priority; used by production app and may be reused by new credit system';
COMMENT ON COLUMN public.cars.boost_end_date IS 'Boost expiry; used by production app and may be reused by new credit system';
