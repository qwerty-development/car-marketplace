-- Create payment logs table for audit trail and idempotency
CREATE TABLE payment_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Transaction identifiers
  external_id BIGINT NOT NULL,
  dealer_id BIGINT NOT NULL REFERENCES dealerships(id),
  
  -- Payment details
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  whish_status TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create unique index for idempotency
CREATE UNIQUE INDEX idx_payment_logs_external_id ON payment_logs(external_id);

-- Create index for dealer lookups
CREATE INDEX idx_payment_logs_dealer_id ON payment_logs(dealer_id);

-- Create index for status queries
CREATE INDEX idx_payment_logs_status ON payment_logs(status);

-- Add comments for documentation
COMMENT ON TABLE payment_logs IS 'Audit trail and idempotency tracking for Whish payments';
COMMENT ON COLUMN payment_logs.external_id IS 'Unique identifier from payment creation (timestamp-based)';
COMMENT ON COLUMN payment_logs.dealer_id IS 'Reference to dealerships table';
COMMENT ON COLUMN payment_logs.plan IS 'Subscription plan type (monthly or yearly)';
COMMENT ON COLUMN payment_logs.amount IS 'Payment amount in USD';
COMMENT ON COLUMN payment_logs.status IS 'Internal payment processing status';
COMMENT ON COLUMN payment_logs.whish_status IS 'Status returned from Whish API';
COMMENT ON COLUMN payment_logs.processed_at IS 'When the payment was fully processed';
COMMENT ON COLUMN payment_logs.error_message IS 'Error details if payment failed';
