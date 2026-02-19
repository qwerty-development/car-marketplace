-- ============================================================================
-- Migration: Credit Batches System
-- Date: 2026-02-19
-- Description: Introduces batch-based credit system with expiring credits.
--   Each purchase creates a credit_batch with an expiry date.
--   FIFO deduction consumes earliest-expiring batches first.
--   pg_cron job expires stale batches nightly at 23:59 UTC.
-- ============================================================================

-- ============================================================================
-- 1. Create credit_batches table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.credit_batches (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dealer_id     BIGINT REFERENCES public.dealerships(id),
  purchased_credits  DECIMAL(10,2) NOT NULL,
  remaining_credits  DECIMAL(10,2) NOT NULL,
  credit_type   TEXT NOT NULL,
  purchased_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  source        TEXT NOT NULL DEFAULT 'purchase',
  whish_external_id  BIGINT UNIQUE,
  metadata      JSONB DEFAULT '{}'::jsonb,

  -- Constraints
  CONSTRAINT credit_batches_remaining_non_negative CHECK (remaining_credits >= 0),
  CONSTRAINT credit_batches_purchased_positive CHECK (purchased_credits > 0),
  CONSTRAINT credit_batches_status_check CHECK (status IN ('active', 'expired', 'depleted')),
  CONSTRAINT credit_batches_credit_type_check CHECK (credit_type IN ('2month', '1year')),
  CONSTRAINT credit_batches_1year_requires_dealer CHECK (credit_type = '2month' OR dealer_id IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_credit_batches_user_status ON public.credit_batches(user_id, status);
CREATE INDEX idx_credit_batches_dealer ON public.credit_batches(dealer_id) WHERE dealer_id IS NOT NULL;
CREATE INDEX idx_credit_batches_expires_active ON public.credit_batches(expires_at) WHERE status = 'active';
CREATE INDEX idx_credit_batches_whish ON public.credit_batches(whish_external_id) WHERE whish_external_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.credit_batches IS 'Tracks individual credit purchase batches with expiry dates. Each purchase creates one row.';
COMMENT ON COLUMN public.credit_batches.credit_type IS '2month = expires in 2 months (users + dealers), 1year = expires in 1 year (dealers only)';
COMMENT ON COLUMN public.credit_batches.remaining_credits IS 'Decremented on spend via FIFO, set to 0 on expiry';
COMMENT ON COLUMN public.credit_batches.source IS 'purchase, admin_grant, promo, migration';

-- ============================================================================
-- 2. RLS for credit_batches
-- ============================================================================
ALTER TABLE public.credit_batches ENABLE ROW LEVEL SECURITY;

-- Users can read their own batches
CREATE POLICY "Users can view own credit batches"
  ON public.credit_batches FOR SELECT
  USING (user_id = auth.uid()::text);

-- Only service role can insert/update/delete (edge functions use service role key)
CREATE POLICY "Service role can manage credit batches"
  ON public.credit_batches FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 3. Alter credit_transactions: add batch_id, expand check constraints
-- ============================================================================

-- Add batch_id column
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS batch_id BIGINT REFERENCES public.credit_batches(id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_batch_id
  ON public.credit_transactions(batch_id) WHERE batch_id IS NOT NULL;

-- Expand transaction_type check to include 'expiry'
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_transaction_type_check;
ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_transaction_type_check
  CHECK (transaction_type IN ('purchase', 'deduction', 'refund', 'admin_adjustment', 'expiry'));

-- Expand purpose check to include 'credit_expiry'
ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_purpose_check;
ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_purpose_check
  CHECK (purpose IN ('credit_purchase', 'post_listing', 'boost_listing', 'refund', 'admin_credit', 'credit_expiry'));

-- ============================================================================
-- 4. sync_credit_balance function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_credit_balance(p_user_id TEXT)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(remaining_credits), 0)
    INTO v_new_balance
    FROM public.credit_batches
    WHERE user_id = p_user_id AND status = 'active';

  UPDATE public.users
    SET credit_balance = v_new_balance
    WHERE id = p_user_id;

  RETURN v_new_balance;
END;
$$;

COMMENT ON FUNCTION public.sync_credit_balance IS 'Recalculates users.credit_balance from active credit_batches. Called after every batch mutation.';

-- ============================================================================
-- 5. deduct_credits_fifo function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.deduct_credits_fifo(
  p_user_id     TEXT,
  p_amount      DECIMAL(10,2),
  p_purpose     TEXT,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS TABLE(
  success       BOOLEAN,
  new_balance   DECIMAL(10,2),
  message       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_available DECIMAL(10,2);
  v_remaining_to_deduct DECIMAL(10,2);
  v_deduct_from_batch DECIMAL(10,2);
  v_new_balance DECIMAL(10,2);
  v_batch RECORD;
BEGIN
  -- Lock and sum available credits
  SELECT COALESCE(SUM(cb.remaining_credits), 0)
    INTO v_total_available
    FROM public.credit_batches cb
    WHERE cb.user_id = p_user_id
      AND cb.status = 'active'
    FOR UPDATE;

  -- Check sufficiency
  IF v_total_available < p_amount THEN
    RETURN QUERY SELECT
      false,
      v_total_available,
      format('Insufficient credits: need %s, have %s', p_amount, v_total_available);
    RETURN;
  END IF;

  v_remaining_to_deduct := p_amount;

  -- FIFO: consume earliest-expiring batches first
  FOR v_batch IN
    SELECT id, remaining_credits
      FROM public.credit_batches
      WHERE user_id = p_user_id
        AND status = 'active'
        AND remaining_credits > 0
      ORDER BY expires_at ASC
      FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_to_deduct <= 0;

    IF v_batch.remaining_credits >= v_remaining_to_deduct THEN
      v_deduct_from_batch := v_remaining_to_deduct;
    ELSE
      v_deduct_from_batch := v_batch.remaining_credits;
    END IF;

    -- Decrement batch
    UPDATE public.credit_batches
      SET remaining_credits = remaining_credits - v_deduct_from_batch,
          status = CASE
            WHEN remaining_credits - v_deduct_from_batch <= 0 THEN 'depleted'
            ELSE status
          END
      WHERE id = v_batch.id;

    -- Audit log for this batch portion
    INSERT INTO public.credit_transactions (
      user_id, amount, balance_after, transaction_type, purpose,
      reference_id, description, batch_id
    ) VALUES (
      p_user_id,
      -v_deduct_from_batch,
      0,  -- will be corrected below
      'deduction',
      p_purpose,
      p_reference_id,
      format('Deducted %s credits from batch #%s', v_deduct_from_batch, v_batch.id),
      v_batch.id
    );

    v_remaining_to_deduct := v_remaining_to_deduct - v_deduct_from_batch;
  END LOOP;

  -- Sync the cached balance
  v_new_balance := public.sync_credit_balance(p_user_id);

  -- Update balance_after on all transactions we just inserted (they have balance_after=0)
  UPDATE public.credit_transactions
    SET balance_after = v_new_balance
    WHERE user_id = p_user_id
      AND balance_after = 0
      AND transaction_type = 'deduction'
      AND created_at >= now() - interval '5 seconds';

  RETURN QUERY SELECT true, v_new_balance, 'Credits deducted successfully'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.deduct_credits_fifo IS 'Atomically deducts credits using FIFO (earliest-expiring first). Creates audit rows per batch touched.';

-- ============================================================================
-- 6. get_credit_batches_summary function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_credit_batches_summary(p_user_id TEXT)
RETURNS TABLE(
  batch_id      BIGINT,
  remaining_credits DECIMAL(10,2),
  credit_type   TEXT,
  expires_at    TIMESTAMPTZ,
  purchased_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id, remaining_credits, credit_type, expires_at, purchased_at
    FROM public.credit_batches
    WHERE user_id = p_user_id
      AND status = 'active'
    ORDER BY expires_at ASC;
$$;

COMMENT ON FUNCTION public.get_credit_batches_summary IS 'Returns active credit batches for a user, ordered by soonest to expire.';

-- ============================================================================
-- 7. expire_credit_batches function (called by pg_cron)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.expire_credit_batches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch RECORD;
  v_expired_count INTEGER := 0;
  v_affected_users TEXT[];
BEGIN
  v_affected_users := ARRAY[]::TEXT[];

  -- Find and expire all active batches past their expiry date
  FOR v_batch IN
    SELECT id, user_id, remaining_credits
      FROM public.credit_batches
      WHERE status = 'active'
        AND expires_at <= now()
      FOR UPDATE
  LOOP
    -- Only log if there were remaining credits
    IF v_batch.remaining_credits > 0 THEN
      INSERT INTO public.credit_transactions (
        user_id, amount, balance_after, transaction_type, purpose,
        description, batch_id
      ) VALUES (
        v_batch.user_id,
        -v_batch.remaining_credits,
        0,  -- will be corrected in sync
        'expiry',
        'credit_expiry',
        format('Batch #%s expired with %s credits remaining', v_batch.id, v_batch.remaining_credits),
        v_batch.id
      );
    END IF;

    UPDATE public.credit_batches
      SET status = 'expired',
          remaining_credits = 0
      WHERE id = v_batch.id;

    v_expired_count := v_expired_count + 1;

    -- Track affected users for balance sync
    IF NOT v_batch.user_id = ANY(v_affected_users) THEN
      v_affected_users := array_append(v_affected_users, v_batch.user_id);
    END IF;
  END LOOP;

  -- Sync balances for all affected users
  FOR i IN 1..coalesce(array_length(v_affected_users, 1), 0) LOOP
    PERFORM public.sync_credit_balance(v_affected_users[i]);

    -- Fix balance_after on expiry transactions
    UPDATE public.credit_transactions
      SET balance_after = (
        SELECT COALESCE(SUM(remaining_credits), 0)
          FROM public.credit_batches
          WHERE user_id = v_affected_users[i] AND status = 'active'
      )
      WHERE user_id = v_affected_users[i]
        AND transaction_type = 'expiry'
        AND balance_after = 0
        AND created_at >= now() - interval '1 minute';
  END LOOP;

  RAISE LOG 'expire_credit_batches: expired % batches for % users', v_expired_count, coalesce(array_length(v_affected_users, 1), 0);

  RETURN v_expired_count;
END;
$$;

COMMENT ON FUNCTION public.expire_credit_batches IS 'Nightly cron job: expires credit batches past their expiry date, logs audit rows, syncs balances.';

-- ============================================================================
-- 8. Schedule pg_cron job (runs at 23:59 UTC daily)
-- ============================================================================
-- Note: pg_cron extension must be enabled. On Supabase it is available via the dashboard.
-- If pg_cron is not yet enabled, enable it first:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'expire-credit-batches',
  '59 23 * * *',
  'SELECT public.expire_credit_batches()'
);

-- ============================================================================
-- 9. Migrate existing credit balances (one-time)
-- ============================================================================
-- For users with credit_balance > 0, create a migration batch so credits aren't lost.
INSERT INTO public.credit_batches (
  user_id, dealer_id, purchased_credits, remaining_credits,
  credit_type, expires_at, status, source, metadata
)
SELECT
  u.id,
  d.id,  -- NULL for non-dealers
  u.credit_balance,
  u.credit_balance,
  '2month',
  now() + interval '2 months',
  'active',
  'migration',
  jsonb_build_object('migrated_from', 'users.credit_balance', 'migration_date', now()::text)
FROM public.users u
LEFT JOIN public.dealerships d ON d.user_id = u.id
WHERE u.credit_balance > 0;
