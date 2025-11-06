# Credit System Implementation Guide

## ✅ Completed Steps

### 1. Database Migration
- ✅ Added `credit_balance` column to `users` table
- ✅ Created `credit_transactions` table for audit trail
- ✅ Created `boosted_listings` table for boost tracking
- ✅ Added boost columns to `cars` table (is_boosted, boost_slot, boost_end_date)
- ✅ Created RLS policies for security
- ✅ Created helper functions (get_user_credit_balance, get_available_boost_slots, is_user_dealer)

### 2. Edge Functions Created
- ✅ `credit-purchase` - Handles credit purchases via Whish
- ✅ `credit-purchase-callback` - Processes Whish payment callbacks
- ✅ `credit-operations` - Deducts credits for posting/boosting
- ✅ `expire-boosts` - Cron job to expire boosted listings

## 🔧 Required Configuration

### Supabase Environment Variables

Add these to your Supabase Dashboard → Functions → Secrets:

```bash
# Existing (should already be set)
WHISH_CHANNEL=your_channel
WHISH_SECRET=your_secret
WHISH_WEBSITEURL=https://fleetapp.me
APP_HMAC_SECRET=your_hmac_secret

# NEW - Add these
CALLBACK_SUCCESS_URL_CREDITS=https://auth.fleetapp.me/functions/v1/credit-purchase-callback
CALLBACK_FAILURE_URL_CREDITS=https://auth.fleetapp.me/functions/v1/credit-purchase-callback
```

### Deploy Edge Functions

Run these commands to deploy the new edge functions:

```bash
# Deploy credit purchase function
supabase functions deploy credit-purchase

# Deploy credit purchase callback
supabase functions deploy credit-purchase-callback

# Deploy credit operations
supabase functions deploy credit-operations

# Deploy boost expiration cron
supabase functions deploy expire-boosts
```

### Set Up Cron Job for Boost Expiration

In Supabase Dashboard → Database → Cron Jobs, add:

```sql
-- Run every hour to expire boosted listings
SELECT cron.schedule(
  'expire-boosted-listings',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url:='https://auth.fleetapp.me/functions/v1/expire-boosts',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb
  ) as request_id;
  $$
);
```

## 📋 Next Steps (Frontend Implementation)

### Still TODO:
1. ⏳ Create CreditContext provider (state management)
2. ⏳ Create credit purchase UI components
3. ⏳ Integrate credit check into car posting flow
4. ⏳ Create boost listing UI and integration
5. ⏳ Update car listing queries for boosted cars
6. ⏳ Test complete credit flow end-to-end
7. ⏳ Verify nothing is broken

## 💰 Pricing Configuration

Currently hardcoded in `credit-operations` edge function:

```typescript
const PRICING = {
  POST_LISTING_COST: 10,
  BOOST_SLOTS: {
    1: 9,  // Highest priority - most expensive
    2: 8,
    3: 7,
    4: 6,
    5: 5   // Lowest priority - cheapest
  },
  BOOST_DURATION_MULTIPLIERS: {
    3: 1.0,   // 3 days = base price
    7: 1.8,   // 7 days = 1.8x base price
    10: 2.3   // 10 days = 2.3x base price
  }
};
```

### Example Pricing:
- **Post a car**: 10 credits ($10)
- **Boost slot 1 for 3 days**: 9 × 1.0 = 9 credits ($9)
- **Boost slot 1 for 7 days**: 9 × 1.8 = 16 credits ($16)
- **Boost slot 5 for 3 days**: 5 × 1.0 = 5 credits ($5)

## 🔒 Security Features

1. **HMAC Signature Verification**: All Whish callbacks are verified with HMAC signatures
2. **Idempotency**: Duplicate payment callbacks are detected and ignored
3. **RLS Policies**: Users can only view their own transactions
4. **Service Role Only**: Credit balance modifications only via edge functions
5. **Atomic Transactions**: Balance updates and transaction logging are atomic

## 🧪 Testing Checklist

Before going live:

- [ ] Test credit purchase via Whish (sandbox mode)
- [ ] Verify balance updates after successful payment
- [ ] Test insufficient credits error when posting
- [ ] Verify dealers can post for free
- [ ] Test boost slot availability check
- [ ] Test boost expiration (manually trigger cron)
- [ ] Verify boosted cars appear first in listings
- [ ] Test transaction history display

## 📞 API Endpoints

### Credit Purchase
```javascript
const response = await fetch('https://auth.fleetapp.me/functions/v1/credit-purchase', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  },
  body: JSON.stringify({
    userId: 'user-id-here',
    creditAmount: 10
  })
});

const { collectUrl, externalId } = await response.json();
// Open collectUrl in browser for payment
```

### Post Listing (Deduct Credits)
```javascript
const response = await fetch('https://auth.fleetapp.me/functions/v1/credit-operations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  },
  body: JSON.stringify({
    operation: 'post_listing',
    userId: 'user-id-here',
    carId: 123
  })
});
```

### Boost Listing
```javascript
const response = await fetch('https://auth.fleetapp.me/functions/v1/credit-operations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  },
  body: JSON.stringify({
    operation: 'boost_listing',
    userId: 'user-id-here',
    carId: 123,
    boostConfig: {
      slot: 1,        // 1-5
      durationDays: 7 // 3, 7, or 10
    }
  })
});
```

## 🎨 UI Components Needed

1. **CreditBalance Widget** - Shows current balance
2. **PurchaseCreditsModal** - Modal to buy credits
3. **BoostListingModal** - Modal to select boost slot and duration
4. **TransactionHistory Screen** - List of credit transactions
5. **Boost Badge** - Visual indicator on boosted cars
6. **Insufficient Credits Alert** - Prompt to buy credits

## 📊 Database Queries

### Get User Balance
```sql
SELECT credit_balance FROM users WHERE id = 'user-id';
```

### Get Transaction History
```sql
SELECT * FROM credit_transactions
WHERE user_id = 'user-id'
ORDER BY created_at DESC
LIMIT 50;
```

### Get Available Boost Slots
```sql
SELECT * FROM get_available_boost_slots();
```

### Get Active Boosted Cars
```sql
SELECT * FROM cars
WHERE is_boosted = true
ORDER BY boost_slot ASC;
```

---

## 🚀 Ready for Frontend Implementation!

All backend infrastructure is in place. You can now proceed with building the React Native UI components and integrating them into your app.
