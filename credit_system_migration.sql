-- ============================================================================
-- CREDIT SYSTEM MIGRATION
-- ============================================================================
-- This migration adds a complete credit system for users to purchase credits,
-- post car listings, and boost listings with priority slots.
--
-- Features:
-- - User credit balances with transaction history
-- - Credit purchases via Whish payment integration
-- - Credit deduction for posting cars (10 credits)
-- - Boost listing system with 5 priority slots
-- - Duration-based boost pricing (3, 7, 10 days)
-- - Automatic boost expiration
--
-- Author: Claude Code
-- Date: 2025-11-06
-- ============================================================================

-- ============================================================================
-- 1. ADD CREDIT BALANCE TO USERS TABLE
-- ============================================================================

-- Add credit_balance column to existing users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(10,2) DEFAULT 0.00 NOT NULL
CHECK (credit_balance >= 0);

-- Add index for credit balance queries
CREATE INDEX IF NOT EXISTS idx_users_credit_balance ON users(credit_balance);

-- Add comment for documentation
COMMENT ON COLUMN users.credit_balance IS 'User credit balance (1 credit = $1 USD). Used for posting cars and boosting listings.';

-- ============================================================================
-- 2. CREDIT TRANSACTIONS TABLE (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- User reference
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Transaction details
  amount DECIMAL(10,2) NOT NULL, -- Positive for credits added, negative for credits deducted
  balance_after DECIMAL(10,2) NOT NULL, -- Balance after this transaction
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'deduction', 'refund', 'admin_adjustment')),

  -- Purpose/reason
  purpose TEXT NOT NULL CHECK (purpose IN (
    'credit_purchase',      -- User purchased credits
    'post_listing',         -- Credits deducted for posting a car
    'boost_listing',        -- Credits deducted for boosting a listing
    'refund',              -- Credits refunded (e.g., admin rejected listing)
    'admin_credit'         -- Admin manually added credits
  )),

  -- References
  reference_id TEXT, -- external_id for purchases, car_id for listings, boost_id for boosts
  description TEXT NOT NULL,

  -- Payment tracking (for purchases)
  whish_external_id BIGINT UNIQUE, -- Whish payment external_id (for idempotency)
  payment_status TEXT CHECK (payment_status IN ('pending', 'success', 'failed')),

  -- Metadata (JSONB for flexible data storage)
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for fast queries
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX idx_credit_transactions_whish_external_id ON credit_transactions(whish_external_id) WHERE whish_external_id IS NOT NULL;
CREATE INDEX idx_credit_transactions_type_purpose ON credit_transactions(transaction_type, purpose);
CREATE INDEX idx_credit_transactions_reference ON credit_transactions(reference_id) WHERE reference_id IS NOT NULL;

-- Comments
COMMENT ON TABLE credit_transactions IS 'Complete audit trail of all credit transactions (purchases, deductions, refunds)';
COMMENT ON COLUMN credit_transactions.amount IS 'Transaction amount: positive for credits added, negative for deducted';
COMMENT ON COLUMN credit_transactions.whish_external_id IS 'Unique Whish payment ID for idempotency checks';

-- ============================================================================
-- 3. BOOSTED LISTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS boosted_listings (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Listing details
  car_id BIGINT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Boost configuration
  boost_slot INTEGER NOT NULL CHECK (boost_slot BETWEEN 1 AND 5), -- 1=highest priority, 5=lowest
  duration_days INTEGER NOT NULL CHECK (duration_days IN (3, 7, 10)),
  credits_paid DECIMAL(10,2) NOT NULL,

  -- Status and timing
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Metadata for future extensibility
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Constraints
  CONSTRAINT unique_active_boost_per_car UNIQUE(car_id, status) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT unique_active_slot UNIQUE(boost_slot, status) DEFERRABLE INITIALLY DEFERRED
);

-- Partial unique indexes (only for active boosts)
CREATE UNIQUE INDEX idx_boosted_listings_active_car
ON boosted_listings(car_id)
WHERE status = 'active';

CREATE UNIQUE INDEX idx_boosted_listings_active_slot
ON boosted_listings(boost_slot)
WHERE status = 'active';

-- Regular indexes
CREATE INDEX idx_boosted_listings_car_id ON boosted_listings(car_id);
CREATE INDEX idx_boosted_listings_user_id ON boosted_listings(user_id);
CREATE INDEX idx_boosted_listings_status ON boosted_listings(status);
CREATE INDEX idx_boosted_listings_end_date ON boosted_listings(end_date);
CREATE INDEX idx_boosted_listings_slot_status ON boosted_listings(boost_slot, status);

-- Comments
COMMENT ON TABLE boosted_listings IS 'Tracks boosted listing configurations and status with priority slots (1-5)';
COMMENT ON COLUMN boosted_listings.boost_slot IS 'Priority slot: 1=highest (most expensive), 5=lowest (cheapest)';
COMMENT ON CONSTRAINT unique_active_boost_per_car ON boosted_listings IS 'A car can only have one active boost at a time';
COMMENT ON CONSTRAINT unique_active_slot ON boosted_listings IS 'Each slot can only have one active boost at a time';

-- ============================================================================
-- 4. ADD BOOST COLUMNS TO CARS TABLE
-- ============================================================================

-- Add boost tracking columns to existing cars table
ALTER TABLE cars
ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS boost_slot INTEGER CHECK (boost_slot IS NULL OR (boost_slot BETWEEN 1 AND 5)),
ADD COLUMN IF NOT EXISTS boost_end_date TIMESTAMP WITH TIME ZONE;

-- Index for boosted car queries (for fast filtering on browse page)
CREATE INDEX IF NOT EXISTS idx_cars_boosted ON cars(is_boosted, boost_slot) WHERE is_boosted = TRUE;
CREATE INDEX IF NOT EXISTS idx_cars_boost_end_date ON cars(boost_end_date) WHERE boost_end_date IS NOT NULL;

-- Comments
COMMENT ON COLUMN cars.is_boosted IS 'Whether car listing is currently boosted (denormalized for query performance)';
COMMENT ON COLUMN cars.boost_slot IS 'Current boost priority slot (1-5, 1 is highest). NULL if not boosted.';
COMMENT ON COLUMN cars.boost_end_date IS 'When the current boost expires. NULL if not boosted.';

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boosted_listings ENABLE ROW LEVEL SECURITY;

-- Credit transactions policies
DROP POLICY IF EXISTS "Users can view own credit transactions" ON credit_transactions;
CREATE POLICY "Users can view own credit transactions" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users cannot modify credit transactions" ON credit_transactions;
CREATE POLICY "Users cannot modify credit transactions" ON credit_transactions
  FOR ALL USING (false); -- Only edge functions with service role can modify

-- Boosted listings policies
DROP POLICY IF EXISTS "Anyone can view boosted listings" ON boosted_listings;
CREATE POLICY "Anyone can view boosted listings" ON boosted_listings
  FOR SELECT USING (true); -- Public data

DROP POLICY IF EXISTS "Users can view own boosts" ON boosted_listings;
CREATE POLICY "Users can view own boosts" ON boosted_listings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users cannot modify boost listings" ON boosted_listings;
CREATE POLICY "Users cannot modify boost listings" ON boosted_listings
  FOR ALL USING (false); -- Only edge functions with service role can modify

-- ============================================================================
-- 6. HELPER FUNCTIONS (RPC)
-- ============================================================================

-- Function to get user's current credit balance
CREATE OR REPLACE FUNCTION get_user_credit_balance(user_uuid UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  balance DECIMAL(10,2);
BEGIN
  SELECT credit_balance INTO balance
  FROM users
  WHERE id = user_uuid;

  RETURN COALESCE(balance, 0);
END;
$$;

COMMENT ON FUNCTION get_user_credit_balance IS 'Returns the current credit balance for a user';

-- Function to check available boost slots
CREATE OR REPLACE FUNCTION get_available_boost_slots()
RETURNS TABLE(slot_number INTEGER, is_available BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.slot_number,
    NOT EXISTS(
      SELECT 1 FROM boosted_listings bl
      WHERE bl.boost_slot = s.slot_number
      AND bl.status = 'active'
    ) AS is_available
  FROM generate_series(1, 5) AS s(slot_number)
  ORDER BY s.slot_number;
END;
$$;

COMMENT ON FUNCTION get_available_boost_slots IS 'Returns all boost slots (1-5) with availability status';

-- Function to check if user is a dealer
CREATE OR REPLACE FUNCTION is_user_dealer(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM dealerships
    WHERE user_id = user_uuid
  );
END;
$$;

COMMENT ON FUNCTION is_user_dealer IS 'Checks if a user has an associated dealership account';

-- ============================================================================
-- 7. TRIGGER FOR UPDATED_AT
-- ============================================================================

-- Update updated_at timestamp on boosted_listings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_boosted_listings_updated_at ON boosted_listings;
CREATE TRIGGER update_boosted_listings_updated_at
  BEFORE UPDATE ON boosted_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. CONFIGURATION DATA
-- ============================================================================

-- Insert default pricing configuration (can be updated by admin later)
-- This is for documentation purposes - actual pricing is in edge functions
INSERT INTO users (id, name, email, credit_balance)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'System Configuration',
  'system@fleetapp.me',
  0
) ON CONFLICT (id) DO NOTHING;

-- Add comment explaining system user
COMMENT ON TABLE users IS 'User accounts. The system user (00000000-0000-0000-0000-000000000000) stores configuration.';

-- ============================================================================
-- 9. GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions
GRANT SELECT ON credit_transactions TO authenticated;
GRANT SELECT ON boosted_listings TO authenticated;
GRANT SELECT, UPDATE ON users TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_credit_balance TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_boost_slots TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_dealer TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Verify migration by counting objects created
DO $$
DECLARE
  column_count INT;
  table_count INT;
  index_count INT;
  function_count INT;
BEGIN
  -- Count new columns in users and cars
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name IN ('users', 'cars')
  AND column_name IN ('credit_balance', 'is_boosted', 'boost_slot', 'boost_end_date');

  -- Count new tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_name IN ('credit_transactions', 'boosted_listings');

  -- Count new indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE indexname LIKE '%credit%' OR indexname LIKE '%boost%';

  -- Count new functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname IN ('get_user_credit_balance', 'get_available_boost_slots', 'is_user_dealer');

  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '- Columns added: %', column_count;
  RAISE NOTICE '- Tables created: %', table_count;
  RAISE NOTICE '- Indexes created: %', index_count;
  RAISE NOTICE '- Functions created: %', function_count;
  RAISE NOTICE 'Credit system migration completed successfully!';
END $$;
