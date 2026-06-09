# Credit System Cleanup — Branch Notes

## Columns: keep for now (production + possible reuse)

These columns stay on production for two reasons:

1. **Current store builds** still depend on them (home feed, browse, profile).
2. **A future credit system** may reuse the same fields — we may **never** drop them.

| Table | Columns | Current use | Future |
|-------|---------|-------------|--------|
| `cars` | `is_boosted`, `boost_priority`, `boost_end_date` | Home feed `ORDER BY boost_priority`; client-side boost sort | May power listing boost in new credit system |
| `cars_rent` | same | Rent browse boost sort | Same |
| `users` | `credit_balance` | `CreditContext` / profile on older builds | Likely kept for new credit wallet |

**Do not drop these columns** while production app versions still query them.  
**Also avoid dropping preemptively** — only remove if the new design explicitly replaces them with something else.

**Applied on production:** `supabase/migrations/20260610_restore_boost_columns.sql`  
Run this (or leave columns in place) if a partial teardown removed them.

### Incident (2026-06)

`remove_credit_system` dropped `boost_priority` while production app still ordered by it → home feed returned HTTP 400 and showed zero cars. Data was fine (~2950 listings); only the query broke.

---

## Cleanup branch strategy

1. **App** — Remove old credit UI / dead code paths; wire new system when ready (can keep using same columns).
2. **Ship** — Release when client no longer depends on removed tables/RPCs/edge functions.
3. **DB** — Drop **only what is truly obsolete** (old tables, crons, edge functions). Column drops are **optional**, not required.

### What to remove vs keep

| Remove when safe | Keep (likely permanent) |
|------------------|-------------------------|
| `credit_batches`, `credit_transactions` (if replaced) | `cars.is_boosted`, `boost_priority`, `boost_end_date` |
| Old credit RPCs / crons / edge functions | `cars_rent` boost columns |
| Dead client components (`PurchaseCreditsModal`, etc.) | `users.credit_balance` |

### Migrations on this branch

| File | Notes |
|------|--------|
| `20260610_restore_boost_columns.sql` | Ensures columns exist on production; idempotent |
| `20260609_remove_credit_system.sql` (when added) | **Skip §7–9 (column drops)** unless we explicitly decide not to reuse these fields |

---

## When the new credit system ships

1. Confirm production builds no longer 400 on missing columns (or all users updated).
2. Remove obsolete tables, RPCs, and edge functions — **not necessarily the columns above**.
3. If a column is genuinely unused and replaced, drop it in a dedicated migration with an explicit decision — not as part of bulk cleanup by default.
