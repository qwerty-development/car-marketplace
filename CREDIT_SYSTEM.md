# Credit System — Technical Documentation

> **Last updated**: February 19, 2026
> **Status**: Active (batch-based system with expiring credits)

---

## Overview

Fleet uses a **batch-based credit system** where each credit purchase creates a separate "batch" that tracks its own balance and expiration date. This replaces the earlier flat-balance model (`users.credit_balance` as a single counter) with a more robust architecture that supports:

- **Expiring credits** — different durations for dealers vs. users
- **FIFO consumption** — earliest-expiring credits are used first
- **Full audit trail** — every credit movement is logged with batch traceability
- **Atomic operations** — deductions happen inside Postgres to prevent race conditions

---

## Credit Types

| Type | Duration | Who Can Purchase | Use Case |
|------|----------|-----------------|----------|
| `2month` | 2 months from purchase | Users **and** Dealers | Short-term credits, standard purchases |
| `1year` | 1 year from purchase | Dealers **only** | Long-term dealer inventory, bulk purchases |

**Pricing**: 1 credit = $1 USD (1:1 ratio). The frontend offers discount packages for bulk purchases (see `PurchaseCreditsModal.tsx`).

---

## Database Schema

### `credit_batches` (Primary table)

Each credit purchase creates one row. This is the source of truth for available credits.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | Auto-incrementing ID |
| `user_id` | TEXT FK → `users(id)` | Always populated — the buyer's auth user ID |
| `dealer_id` | BIGINT FK → `dealerships(id)` | NULL for regular users, populated for dealers |
| `purchased_credits` | DECIMAL(10,2) | Original amount purchased (immutable) |
| `remaining_credits` | DECIMAL(10,2) | Current balance — decremented on spend, zeroed on expiry |
| `credit_type` | TEXT | `'2month'` or `'1year'` |
| `purchased_at` | TIMESTAMPTZ | When the purchase was completed |
| `expires_at` | TIMESTAMPTZ | When this batch expires |
| `status` | TEXT | `'active'`, `'expired'`, or `'depleted'` |
| `source` | TEXT | `'purchase'`, `'admin_grant'`, `'promo'`, `'migration'` |
| `whish_external_id` | BIGINT UNIQUE | Whish payment ID (idempotency key) |
| `metadata` | JSONB | Flexible storage (e.g., `{ price_usd, payment_method }`) |

**Key constraints**:
- `remaining_credits >= 0`
- `credit_type IN ('2month', '1year')`
- `credit_type = '2month' OR dealer_id IS NOT NULL` — 1-year credits require a dealership
- RLS enabled: users can SELECT own rows; writes are service-role only

**Indexes**:
- `(user_id, status)` — balance lookups
- `(expires_at) WHERE status = 'active'` — cron expiry scans
- `(dealer_id) WHERE dealer_id IS NOT NULL` — dealership queries
- `(whish_external_id)` — payment idempotency

### `credit_transactions` (Audit log)

Append-only ledger of every credit movement. Never deleted or modified.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL PK | |
| `user_id` | TEXT FK → `users(id)` | |
| `amount` | DECIMAL(10,2) | Positive = added, negative = deducted |
| `balance_after` | DECIMAL(10,2) | Running balance after this transaction |
| `transaction_type` | TEXT | `'purchase'`, `'deduction'`, `'refund'`, `'admin_adjustment'`, `'expiry'` |
| `purpose` | TEXT | `'credit_purchase'`, `'post_listing'`, `'boost_listing'`, `'refund'`, `'admin_credit'`, `'credit_expiry'` |
| `reference_id` | TEXT | Car ID, boost ID, etc. |
| `description` | TEXT | Human-readable description |
| `batch_id` | BIGINT FK → `credit_batches(id)` | Links to the specific batch affected |
| `whish_external_id` | BIGINT UNIQUE | Whish payment ID |
| `payment_status` | TEXT | `'pending'`, `'success'`, `'failed'` |
| `metadata` | JSONB | Flexible storage |

**Note**: When a single deduction spans multiple batches (FIFO), one `credit_transactions` row is created **per batch touched**, each with its own `batch_id` and partial `amount`.

### `users.credit_balance` (Denormalized cache)

The `credit_balance` column on the `users` table is kept as a **read-optimized cache**. It's recalculated after every mutation by `sync_credit_balance()`. Do **not** write to it directly — always use the RPC functions.

---

## Postgres RPC Functions

### `sync_credit_balance(p_user_id TEXT) → DECIMAL`

Recalculates `users.credit_balance` from `SUM(remaining_credits) WHERE status = 'active'`. Called automatically after every batch mutation.

### `deduct_credits_fifo(p_user_id, p_amount, p_purpose, p_reference_id) → TABLE`

Atomic FIFO deduction:
1. Locks active batches with `FOR UPDATE` (prevents race conditions)
2. Validates total available >= amount (raises exception if insufficient)
3. Iterates batches ordered by `expires_at ASC` (earliest first)
4. Decrements `remaining_credits`; sets status to `'depleted'` when a batch hits 0
5. Creates one `credit_transactions` row per batch touched
6. Calls `sync_credit_balance()` to update the cache
7. Returns `{ success: boolean, new_balance: decimal, message: text }`

### `get_credit_batches_summary(p_user_id TEXT) → TABLE`

Returns active batches for display: `batch_id`, `remaining_credits`, `credit_type`, `expires_at`, `purchased_at`. Ordered by soonest-to-expire.

### `expire_credit_batches() → INTEGER`

Nightly cron job function:
1. Finds all batches WHERE `status = 'active' AND expires_at <= NOW()`
2. Sets `status = 'expired'`, `remaining_credits = 0`
3. Logs expiry transactions in `credit_transactions`
4. Syncs `users.credit_balance` for each affected user
5. Returns count of expired batches

**Schedule**: `59 23 * * *` (11:59 PM UTC daily) via `pg_cron`.

---

## Edge Functions

### `credit-purchase` (POST)

**Purpose**: Initiates a credit purchase via Whish payment gateway.

**Input**:
```json
{
  "userId": "abc-123",
  "creditAmount": 50,
  "creditType": "2month"    // optional, defaults to "2month"
}
```

**Behavior**:
- If `creditType === '1year'`, verifies user is a dealer (checks `dealerships` table). Returns 403 if not.
- Calls Whish API to create a payment, returns a `collectUrl` for the user to complete payment.
- Passes `creditType` and `dealerId` through HMAC-signed callback URL parameters.

**Output**: `{ collectUrl, externalId, creditAmount }`

### `credit-purchase-callback` (GET)

**Purpose**: Called by Whish after payment completion.

**Behavior**:
1. Extracts `eid`, `userId`, `creditAmount`, `creditType`, `dealerId` from query params
2. Verifies HMAC signature (timing-safe comparison)
3. Checks idempotency via `whish_external_id` on `credit_batches`
4. Verifies payment status with Whish API
5. On success:
   - Creates a `credit_batches` row with computed `expires_at`
   - Logs a `credit_transactions` row with `batch_id`
   - Calls `sync_credit_balance()` to update cached balance

**Expiry computation**:
- `'2month'`: `now + 2 months`
- `'1year'`: `now + 1 year`

### `credit-operations` (POST)

**Purpose**: Deducts credits for actions (posting listings, boosting).

**Operations**:

#### `post_listing`
- Dealers post for **free** (auto-detected via `dealerships` table)
- Users pay `10 credits` per listing
- Calls `deduct_credits_fifo` RPC for atomic FIFO deduction

#### `boost_listing`
- Priority-based pricing (1=Basic/5 credits to 5=Ultimate/9 credits)
- Duration multipliers: 3 days (1.0x), 7 days (1.8x), 10 days (2.3x)
- Checks for existing active boosts (prevents double-boost)
- Calls `deduct_credits_fifo` RPC, then updates `cars` table with boost info

**Input**:
```json
{
  "operation": "post_listing",
  "userId": "abc-123",
  "carId": 456,
  "boostConfig": {          // only for boost_listing
    "priority": 3,
    "durationDays": 7
  }
}
```

---

## Frontend Integration

### `CreditContext.tsx` (Provider)

Mounted in `app/_layout.tsx`. Provides:

| Property | Type | Description |
|----------|------|-------------|
| `creditBalance` | `number` | Cached balance from `users.credit_balance` |
| `creditBatches` | `CreditBatch[]` | Active batches with expiry info |
| `isLoading` | `boolean` | Loading state |
| `refreshBalance()` | `async` | Re-fetches balance from DB |
| `fetchBatches()` | `async` | Re-fetches active batches via RPC |
| `deductCredits()` | `async` | Optimistic UI update (actual deduction via edge function) |

**Realtime**: Subscribes to `users` table changes for live balance updates. Also refreshes batches when balance changes.

### UI Components

| Component | File | Description |
|-----------|------|-------------|
| `CreditBalance` | `components/CreditBalance.tsx` | Displays balance, expiry info, "Buy" button |
| `PurchaseCreditsModal` | `components/PurchaseCreditsModal.tsx` | Credit package selection (1/25/50/100/250), opens Whish payment |
| `BoostListingModal` | `components/BoostListingModal.tsx` | Priority & duration selection for boosting |
| `BoostInsightsWidget` | `components/BoostInsightsWidget.tsx` | Analytics for active boosts (impressions, clicks, CTR) |

### Where Credits Are Used

| Screen | File | What |
|--------|------|------|
| Dealer Profile | `app/(home)/(dealer)/(tabs)/profile.tsx` | Shows balance, purchase modal |
| User Profile | `app/(home)/(user)/(tabs)/profile.tsx` | Shows balance, purchase modal |
| Dealer Inventory | `app/(home)/(dealer)/(tabs)/index.tsx` | Boost button on listings |
| User My Listings | `app/(home)/(user)/(tabs)/MyListings.tsx` | Boost button on listings |
| Add/Edit Listing | `app/(home)/(dealer)/AddEditListing.tsx` | Credit check + deduction on post |

---

## Flow Diagrams

### Credit Purchase Flow

```
User taps "Buy Credits"
  → PurchaseCreditsModal (select package + creditType)
  → POST /credit-purchase { userId, creditAmount, creditType }
  → Whish API creates payment → returns collectUrl
  → User completes payment in Whish UI
  → Whish calls GET /credit-purchase-callback?eid=...&creditType=...
  → Callback verifies HMAC + Whish status
  → INSERT credit_batches (status=active, expires_at computed)
  → INSERT credit_transactions (type=purchase, batch_id)
  → sync_credit_balance() → updates users.credit_balance
  → Realtime subscription fires → CreditContext updates UI
```

### Credit Spending Flow (FIFO)

```
User posts a listing
  → POST /credit-operations { operation: post_listing, userId, carId }
  → Edge function checks if dealer (free) or user (10 credits)
  → Calls deduct_credits_fifo(userId, 10, 'post_listing', carId)
    → Locks active batches ORDER BY expires_at ASC
    → Deducts from earliest-expiring batch first
    → If batch depleted → status = 'depleted', move to next
    → Inserts credit_transactions per batch touched
    → Calls sync_credit_balance()
  → Returns { success, new_balance }
```

### Credit Expiry Flow

```
pg_cron runs at 23:59 UTC daily
  → SELECT expire_credit_batches()
    → Finds batches WHERE status=active AND expires_at <= now()
    → For each: status='expired', remaining_credits=0
    → Logs expiry in credit_transactions
    → sync_credit_balance() for each affected user
```

---

## Environment Variables

Required in Supabase Edge Function secrets:

| Variable | Used By | Description |
|----------|---------|-------------|
| `WHISH_CHANNEL` | credit-purchase, callback | Whish API channel |
| `WHISH_SECRET` | credit-purchase, callback | Whish API secret |
| `WHISH_WEBSITEURL` | credit-purchase, callback | Whish website URL |
| `CALLBACK_SUCCESS_URL_CREDITS` | credit-purchase | Base URL for success callback |
| `CALLBACK_FAILURE_URL_CREDITS` | credit-purchase | Base URL for failure callback |
| `APP_HMAC_SECRET` | credit-purchase, callback | HMAC signing key for callback verification |
| `SUPABASE_URL` | all | Auto-provided by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | all | Auto-provided by Supabase |

---

## Deployment

### Apply Migration
Run the SQL in `supabase/migrations/20260219_credit_batches_system.sql` via the Supabase SQL Editor (Dashboard → SQL Editor → New Query → Paste → Run).

### Deploy Edge Functions
```bash
supabase functions deploy credit-purchase --no-verify-jwt
supabase functions deploy credit-purchase-callback --no-verify-jwt
supabase functions deploy credit-operations --no-verify-jwt
```

### Verify pg_cron
```sql
SELECT * FROM cron.job WHERE jobname = 'expire-credit-batches';
```

---

## Key Design Decisions

1. **Separate `credit_batches` table** (not columns on `credit_transactions`) — batches track live balance, transactions are an immutable audit log
2. **FIFO deduction in Postgres** (not edge function) — atomic, race-condition-free via `FOR UPDATE` row locking
3. **`users.credit_balance` kept as cache** — avoids breaking existing queries, gives O(1) balance reads
4. **Single edge function with `creditType` param** (not separate functions per duration) — less code duplication, easier to extend
5. **pg_cron for expiry** (not edge function cron) — runs inside DB, no HTTP overhead, more reliable
6. **`dealer_id` on `credit_batches`** — enables dealership-level queries without joins, enforces 1-year type constraint at data level

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Balance mismatch | Run `SELECT sync_credit_balance('user-id')` to force re-sync |
| Credits not expiring | Verify cron: `SELECT * FROM cron.job WHERE jobname = 'expire-credit-batches'` |
| Duplicate payment processing | Check `whish_external_id` uniqueness on `credit_batches` |
| 1-year purchase rejected | Verify user has a row in `dealerships` with matching `user_id` |
| HMAC verification failing | Ensure `APP_HMAC_SECRET` matches between `credit-purchase` and `credit-purchase-callback` |
| Deduction race condition | `deduct_credits_fifo` uses `FOR UPDATE` locking — should not happen |
