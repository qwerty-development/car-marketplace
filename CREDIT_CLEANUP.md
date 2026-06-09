# Credit System Cleanup — Complete

## Status: Removed from app (2026-06-09)

The legacy credit purchase/boost UI, edge functions, and database tables have been removed from this branch.

## Columns kept (production + possible reuse)

These columns remain on production — **do not drop** without an explicit decision and a shipped app build:

| Table | Columns | Current use |
|-------|---------|-------------|
| `cars` | `is_boosted`, `boost_priority`, `boost_end_date` | Home feed `ORDER BY boost_priority`; client-side boost sort |
| `cars_rent` | same | Rent browse boost sort |
| `users` | `credit_balance` | Reserved for a future credit wallet |

**Incident (2026-06):** Dropping `boost_priority` while production still ordered by it broke the home feed (HTTP 400). Data was fine; only the query failed. `20260610_restore_boost_columns.sql` ensures these columns exist if they were removed.

## Migrations

| File | Purpose |
|------|---------|
| `20260609_remove_credit_system.sql` | **Canonical cleanup** — drops credit/boost tables & RPCs, rewrites `search_cars`, `search_cars_rent`, `get_listings_by_chat_count` |
| `20260610_restore_boost_columns.sql` | Idempotent safety net — re-adds boost columns if missing |

Run `20260609` first, then `20260610` only if columns were previously dropped.

### What `20260609` removes

**Tables:** `credit_batches`, `credit_transactions`, `boosted_listings`, `boost_history`, `boost_analytics`, `boost_analytics_history`

**RPCs:** `sync_credit_balance`, `deduct_credits_fifo`, `get_credit_batches_summary`, `expire_credit_batches`, `get_user_credit_balance`, `get_available_boost_slots`, `is_user_dealer`, `get_dealership_boost_summary`, `get_boost_performance`, `track_boost_impression`, `track_boost_click`

**Crons:** `expire-credit-batches`, `expire-boosted-listings`

### What `20260609` intentionally keeps

- `users.credit_balance` column
- `cars` / `cars_rent` boost columns
- `payment_logs` table and `cleanup_pending_payment_logs` (subscription Whish payments — **not** credit)

## What was removed from the app

- `CreditContext`, `CreditBalance`, `PurchaseCreditsModal`, `BoostListingModal`, `BoostInsightsWidget`
- `TransactionHistory` screen
- `CreditProvider` from provider chain
- Edge functions: `credit-purchase`, `credit-purchase-callback`, `credit-operations`, `expire-boosts`

## What remains in the app

- Boost column sorting in browse/search (`index.tsx`, `CarsByBrand.tsx`, `DealershipDetails.tsx`)
- FEATURED badge on `CarCard` for active boosted listings

## Deploy checklist

1. Ship app build (no credit UI / no calls to removed RPCs).
2. Run `20260609_remove_credit_system.sql` on Supabase.
3. Run `20260610_restore_boost_columns.sql` if boost columns may be missing.
4. Delete credit edge functions from Supabase dashboard (already removed from repo).
5. Confirm home feed loads (boost columns must exist).

## Admin note

`get_listings_by_chat_count` signature changed — `p_boost_filter` param removed. Update any external admin tool that called the old signature.
