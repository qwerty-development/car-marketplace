# Fleet v3.0 — Wallet/Credit Release: Project Context

Last updated: 2026-06-12. This document replaces HANDOFF.md and is the durable context
for future sessions. Covers both repos: this one (mobile) and `../fleet-webapp` (admin).

## Status snapshot (verified LIVE via read-only Supabase MCP, 2026-06-12)

- DB is in **TESTING phase** — not serving real production traffic yet.
- All 9 feature migrations (`20260611_*`) are **APPLIED**, including the reworked
  app-wide `market_trending`. Verified live: latest wallet schema
  (`payment_provider`/`provider_ref` present), plates status enum has `'expired'`,
  RLS enabled on all 7 new tables, `enforce_listing_slots=false`, all new crons
  scheduled and succeeding.
- **NOT yet applied (in order):** `20260612_hardening_patch.sql`, then
  `20260612_admin_expiry_tools.sql`.
- Mobile + webapp code changes from 2026-06-12 are in the working tree on the
  `credit-system` branch (mobile) / fleet-webapp, **uncommitted**.
- pg_cron is **1.6** — named `cron.schedule()` UPSERTS, so re-running migration files
  does NOT duplicate jobs (verified empirically; do not "fix" this).
- tsc baselines (pre-existing, unrelated): **696 errors mobile / 369 webapp**. Any new
  work must keep these counts unchanged.

## What v3.0 is

All 18 user stories across 7 feature areas: wallet/credits, listing lifecycle (expiry),
featured ads, featured businesses, car requests, in-chat offers + mark-sold, listing
analytics (impressions/stats) + market trending, and listing slots (quota enforcement,
currently OFF).

### Wallet model (core design)

- **1 row per consumable credit** in `wallet_items` (types: `listing`, `featured_ad`,
  `car_request`); **money** lives in `wallet_acquisitions` (kind:
  `online_purchase`/`admin_grant`/`admin_refund`; refunds are NEGATIVE rows, originals
  never mutated).
- `pricing_packages` IS the bundles table; `contents` jsonb `{type: count}`. A bundle
  `{"listing":2,"featured_ad":3}` → 5 item rows, prorated `unit_price_usd`, ONE shared
  `expires_at`. Acquisitions stamp `package_id` → per-bundle analytics need no schema
  change.
- Payment providers abstracted: `payment_provider` + `provider_ref` (partial unique
  index per provider). Today only Whish; a new gateway = new edge fn pair + ref-keyed
  crediting RPC. Heads-up was given re Apple IAP if iOS digital-goods payments expand.
- Consumption is recorded on the wallet item (`consumed_at/-listing_type/-listing_id/
  -ref`) as **FK-free historical stamps** — history must NEVER block deletions
  (delete-safety audit, commit 97f7179: everything is CASCADE or SET NULL by design).
- **One expiry per credit type** (owner rule): enforced FRONTEND-ONLY — WalletView locks
  packages containing a type the user still holds. Admin grants exempt BY DESIGN.
- Offline dealer packages = admin grants (`/admin/wallets` → Grant). Revenue splits
  online vs offline via `kind`.

### The 9 feature migrations (supabase/migrations/, all applied)

1. `20260611_wallet_system.sql` — tables above + `app_config` + `consume_wallet_item`,
   `get_my_wallet`, admin grant/refund RPCs, `expire_wallet_items` nightly cron, Whish
   crediting RPC (idempotent on callback replay).
2. `20260611_listing_lifecycle.sql` — `expire_at` on cars/cars_rent/number_plates,
   75-day flat backfill (owner decision), insert triggers (60d default via
   `app_config.listing_duration_days`), hourly crons: `expire-featured-listings` (:05),
   `expire-listings` (:10), `send-expiry-warnings` (:15). Plates follow the FULL
   lifecycle (owner confirmed).
3. `20260611_featured_ads.sql` — `apply_featured_ad` (consume + boost 8d, same RPC for
   renewals) + `get_featured_listings` (random N for banner, deterministic for view-all).
4. `20260611_featured_businesses.sql` — `dealerships.is_featured/featured_until` +
   daily clear cron.
5. `20260611_car_requests.sql` — `regions` (LB + all_lebanon, en/ar), `users.region`,
   `car_requests` (7d expiry, 2 free/month via `app_config.free_car_requests_per_month`,
   then a `car_request` credit), dismissals, contacts, `conversations.car_request_id`.
   `paid` boolean on requests is a DURABLE stamp (the `wallet_item_id` FK is SET NULL,
   so it can't serve as the paid marker; admin dashboard reads `paid`). The quota
   counts ALL requests in the calendar month regardless of paid.
   KEY: dropped the old conversations listing-context CHECK; added ONLY
   `conversations_request_context_exclusive` — NOT VALID CHECKs still enforce on UPDATE
   and conversations update on EVERY message; an "exactly one context" constraint could
   have broken chat for legacy rows. `log_request_contact` creates the conversation
   SERVER-SIDE and returns `conversation_id`.
6. `20260611_offers.sql` — `offers` table (one pending per conversation via partial
   unique idx; counter chains; 85% floor via `app_config.min_offer_ratio`),
   `messages.type` (`text`/`offer`) + `offer_id` (SET NULL → bubble degrades to its
   plain-text body). Offers ride the existing message pipeline ON PURPOSE: timeline
   ordering, conversation previews/unread/push come free from existing triggers, and
   old builds render the readable body. `respond_offer` authz: identity from JWT,
   participant check, recipient-side-only (`own_offer`), FOR UPDATE + pending-only,
   RLS = SELECT for participants / writes service_role. `mark_listing_sold` (user P2P;
   dealers have their own flow) + `cars.sold_via`.
7. `20260611_listing_analytics.sql` — `record_listing_impressions` (anon-callable like
   existing track_* RPCs, ≤100/batch, JOIN validates ids), `get_my_listing_stats`,
   90-day impression prune (monthly cron). Client batching in
   `hooks/useImpressionTracker.ts`: ≥50% visible ≥500ms, once per session per listing,
   flush every 30s or at 50 events → ~2 RPC calls/min worst case. Pruning is safe for
   UX because listings expire at ≤75d (window outlives any listing); a daily-rollup
   table can be added later with no loss IF done before the first prune fires
   (1st of month, ≥90d after apply). Known accepted tradeoff: server trusts client
   dedupe (vanity metric) — add server-side dedupe before ever charging by impressions.
8. `20260611_dealership_trending.sql` — REWORKED 2026-06-12 (owner corrected the
   requirement): trending is **APP-WIDE**, not per-dealership. `market_trending` =
   top 2 make+model by views over trailing 7d across the whole app (aggregated so no
   competitor listing/numbers exposed; sold cars' views still count as demand).
   Weekly cron `refresh-market-trending` (Sun 21:00 UTC = Mon 00:00 Beirut) + initial
   populate. RLS: SELECT for DEALERS ONLY (role checked vs users profile; non-dealers
   get 0 rows, no error — safe for the brief (dealer)-route mount). UI:
   `components/dealer/TrendingSection.tsx` (no props, queries market_trending).
9. `20260611_listing_slots.sql` — request/bind/release_listing_slot. TOTAL NO-OP while
   `app_config.enforce_listing_slots=false` (current state). Users get
   `free_active_listings_user` (counts 'pending' too, plates included); dealers have NO
   free allowance — wallet only. Client fails OPEN (RPC error → post proceeds), so
   migration/app-build ordering can't block posting. The flag is the kill switch.

### 2026-06-12 full review → `20260612_hardening_patch.sql` (apply FIRST)

Review = 3 subagents (money-path SQL, engagement-path SQL, client↔SQL contracts) + live
DB inspection. Confirmed-real findings, all FIXED in the patch + working tree:

1. **Immortal listings**: expiry triggers were INSERT-only; rows that were 'pending' at
   apply time and approved later have `expire_at NULL` forever (2 live cars: 3756,
   3765). Patch: triggers now `BEFORE INSERT OR UPDATE` with
   `WHEN (NEW.expire_at IS NULL)` guard (cars is UPDATEd on every view increment — keep
   the guard) + catch-up stamp at 60d.
2. **Orphaned slot reservations**: app crash between `request_listing_slot` and
   bind/release left items `consumed/'reserved'` forever. Patch: `expire_wallet_items`
   reclaims them (>2h old) back to active BEFORE its expiry pass.
3. **Contact push spam**: `log_request_contact` notified on every call. Patch: dedupe
   existing rows + `UNIQUE (request_id, dealership_id, channel)` + notify only on first
   contact (`ON CONFLICT DO NOTHING` + ROW_COUNT).
4. **Featured double-spend**: two concurrent `apply_featured_ad` on one listing consumed
   2 credits for 1 boost. Patch: `FOR UPDATE` on the listing + new reason
   `'already_featured'` when `boost_end_date > now()+7d` (distinguishes double-tap from
   legitimate renewal at 8d duration). Client default case shows generic failure toast.
5. **mark_listing_sold**: old 3-arg signature DROPPED, new adds optional
   `p_buyer_name`/`p_date_sold` (+FOR UPDATE). MyListings' 3-named-arg call still
   resolves fine. No released build calls it.
6. Mobile fixes (working tree): **plates slot wiring** added to BOTH
   `NumberPlatesManager` files (user + dealer) — was a total quota bypass once
   enforcement flips; **AddEditListing user-mode mark-sold** now uses the RPC with a
   fleet/other Alert (reuses `listings.soldVia*` keys) — was a raw `.update()` that
   never set `sold_via` and trusted client userId with RLS off on cars. Dealer/rent
   sold path unchanged (dealership-scoped update).

**False positives rejected during review** (don't re-chase): cron.schedule idempotency
(pg_cron 1.6 upserts); DELETE+INSERT "visibility gap" in trending (plpgsql fn = one
transaction); STABLE annotation on get_my_wallet; correlated-subquery perf in
_offer_conversation_context (only one branch executes).

**Deferred findings (known debt, medium):** admin_grant jsonb count validation (negative
counts silently skip via generate_series); refund-of-consumed-items policy (admin can
refund an item whose feature still runs); `get_car_requests_feed` ignores
`subscription_end_date` (product call: is the request feed premium?); idempotency guard
missing on `conversations_request_context_exclusive` ADD CONSTRAINT (re-running
car_requests.sql errors there — harmless, it's applied); missing
`(listing_type, event_type, created_at)` index for trending/prune; 90d floor in
`get_my_listing_stats`; `SET search_path` pin on `app_config_numeric/_bool`.
Client polish: `own_offer` toast case (key `offers.notAllowed` exists), clearInterval in
useImpressionTracker, router/validateFormData in AddEditListing callback deps (defeats
memoization), suppressed dep in useConversationOffers.

### Admin expiry tools → `20260612_admin_expiry_tools.sql` (apply SECOND)

Owner-requested ops levers for the lifecycle. Three RPCs, ALL service_role-only (admin
is web-only), `p_admin_id` audit via RAISE LOG, days 1–365, extension always from
`GREATEST(expire_at, now())`, always resets `expiry_warning_sent_at`:

- `admin_extend_listing_expiry(type, id, days, admin)` — single listing; REVIVES
  expired→available (the support-ticket path); refuses sold/rented/deleted.
- `admin_extend_all_expiries(days, type?, dealership_id?, admin)` — bulk grace for
  AVAILABLE only; deliberately never revives; dealership scope = VIP/retention deals.
- `admin_extend_listings_expiry(type, ids[], days, admin)` — multi-select batch (max
  500, one type per call); extends AND revives (admin hand-picked); locks rows up front
  vs the hourly cron; returns `{extended, revived, skipped}`.

fleet-webapp: `/api/admin/listings/extend-expiry`, `/extend-all`, `/extend-selected`
(all behind `requireAdmin`, following the wallet/grant route pattern). Listings page:
per-card amber "Extend" button + modal (presets 7/30/60/90, "Restore & Extend" for
expired); checkbox overlay per card + sticky selection bar (Select page / Clear /
Extend Selected; selection clears on view-type switch — a batch targets ONE table);
toolbar "Extend All Expiries" (hidden on User Listings view; scopes to current type +
dealership filter); "Expired" added to status filters; `Car` type: status union
+`'expired'`, `expire_at?` field.

## Rollout TODO (owner)

1. Apply `20260612_hardening_patch.sql`, then `20260612_admin_expiry_tools.sql`
   (SQL editor; both idempotent). Smoke: extend one expired listing via admin panel;
   post one plate; user mark-sold one car.
2. Deploy edge functions: `wallet-purchase`, `wallet-purchase-status`,
   `wallet-purchase-callback --no-verify-jwt`, `process-notifications`.
3. Env: `APP_HMAC_SECRET` REQUIRED; optional `WHISH_API_URL` (defaults prod),
   `WHISH_SUCCESS/FAILURE_REDIRECT_URL`.
4. Sandbox-test 1 purchase; replay callback twice (2nd must be no-op 'already_paid').
5. Real prices in `/admin/pricing` (seed = placeholders); flip `enforce_listing_slots`
   ONLY AFTER seeding dealer wallets (dealers have no free allowance — empty wallet =
   cannot post). Flag is instantly reversible.
6. Retire `expire-boosts` edge fn; later undeploy credit-purchase/-callback/
   credit-operations.
7. Cleanup two PRE-EXISTING broken crons (unrelated to v3.0):
   `cleanup-pending-payment-logs` (function was dropped by credit-system removal —
   unschedule) and `remind-inactive-users-cron` (http call with EMPTY Bearer + 5s
   timeout — never worked).
8. Device pass both roles: feature→banner, buy→wallet, request→contact→push, offer
   round-trip (incl. <85% reject + counters), mark sold, stats, trending.

## House rules & gotchas

- Migrations: Claude writes SQL files, owner applies (DB read-only via MCP; MCP is
  connected read-only and CAN inspect live state). Commits WITHOUT co-author.
- Admin = fleet-webapp ONLY (no mobile admin screens).
- Old builds must keep working: `users.credit_balance` + `boost_priority=1` kept;
  whish-create-payment/whish-success untouched; offer messages carry readable bodies.
- Plates schema gotchas: `number_plates` has NO `date_modified`; `status` is an ENUM
  (cars/cars_rent are text); soft delete via `deleted_at`.
- SDK 54: router/segments in refs, `router.replace` in `setTimeout(0)`, context values
  useMemo'd. i18n en+ar always. PGRST116 guard on `.single()`. Brand `#D55004`.
- The expiry clock is LIVE: backfilled listings expire ~late August 2026 (75d from
  apply); new listings 60d. Pause lever: `SELECT cron.unschedule('expire-listings')`.
- Pre-existing debt (flagged, untouched): RLS off on `public.cars`; legacy
  `/api/admin/*` routes without requireAdmin; a security_definer_view; a policy reading
  user_metadata; Postgres has a pending security patch (per advisors).

## Decisions log (rationale that matters for future asks)

- Plate-specific listing credit: NOT PLANNED — owner was stress-testing schema
  flexibility (2026-06-12). Confirmed cheap if requested (one CASE in
  request_listing_slot + CHECK/whitelist entries + a package row + labels). Do NOT
  build proactively. Open questions if it happens: generic 'listing' fallback for
  plates? plates keep counting toward free_active_listings_user?
- Per-bundle revenue breakdown on /admin/revenue: OFFERED, owner sounded positive,
  awaiting explicit go.
- Trending = market demand signal for dealers, dealer-only data access (owner decision
  2026-06-12); per-dealership trending was a misread of the requirement and was
  reworked before apply… then applied same day.
- Impressions: client-trust accepted while impressions are a vanity metric; revisit
  before any impression-based billing.

## Commit log (mobile repo, credit-system branch)

8ac69e3 backend foundation · 551bc06 P1 featured-ads UI · 3283123 P2 featured
businesses · 70b59e7 P3 car requests · ef0b8c2 P4 wallet+slots · 1ce878b P5
offers/mark-sold · e3cfb30 P6 impressions/stats · 5a291a3 P7 trending+urgent expiry ·
b5f9cb6 review fixes · 1e6089f backfill+stale-boost · 3185e83 conversations constraint ·
5f61be6 one-expiry-per-type · d35fc4a payment providers · 97f7179 FK delete-safety ·
1cbe686 handoff doc · 711b1ac 2026-06-12 work (trending rework, hardening patch +
mobile fixes, admin expiry tools SQL). fleet-webapp: 9e545bd (admin wallets/pricing/
car-requests/revenue + featured toggle + requireAdmin); the 2026-06-12 expiry-tools
webapp work (3 API routes + listings page UI + Car type) is UNCOMMITTED there as of
this writing.
