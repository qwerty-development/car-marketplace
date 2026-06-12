# Fleet v3.0 — Session Handoff (2026-06-12)

All 18 user stories (7 feature areas) are IMPLEMENTED, REVIEWED, and COMMITTED in both repos.
We are now in the ROLLOUT phase: the owner applies migrations manually (DB is read-only for Claude;
Supabase MCP may be disconnected — work from this file + the SQL files).

## CURRENT STATE — read carefully
- ✅ `20260611_wallet_system.sql` APPLIED to production by the owner.
- ⏳ The owner wants to REVIEW each remaining migration BEFORE applying it — that's the next task:
  walk through them one by one (what it does, exact production impact), then they apply in order.
- ❗ Verify which version of wallet_system was applied — it changed late. Latest includes
  `payment_provider`/`provider_ref` columns and `ON DELETE SET NULL` on dealership FKs. Check with:
  `SELECT column_name FROM information_schema.columns WHERE table_name='wallet_acquisitions' AND column_name IN ('payment_provider','provider_ref');`
  If missing → write a tiny patch migration (ADD COLUMN payment_provider TEXT NOT NULL DEFAULT 'whish',
  provider_ref TEXT, the partial unique index, and ALTER the two dealership FKs to SET NULL).

## Remaining migrations to review+apply IN ORDER (all in supabase/migrations/)
1. ~~wallet_system.sql~~ APPLIED (verify version, see above)
2. `20260611_listing_lifecycle.sql` — expire_at on cars/cars_rent (+boost cols on plates), insert
   triggers, 3 hourly crons (expire boosts/listings + 24h warnings via pending_notifications).
   PROD SAFETY built in: grandfathered listings staggered 45–75d (no day-60 mass-expiry cliff);
   stale legacy boosts cleared SILENTLY pre-cron (no bogus "renew" pushes). Day-one impact: none.
3. `20260611_featured_ads.sql` — apply_featured_ad + get_featured_listings RPCs only. No impact.
4. `20260611_featured_businesses.sql` — dealerships.is_featured/featured_until + daily clear cron. No impact.
5. `20260611_car_requests.sql` — regions (LB + all_lebanon, en/ar), users.region, car_requests
   (7d expiry, 2 free/month quota), dismissals, contacts, conversations.car_request_id.
   KEY DECISION: drops the old conversations listing-context CHECK and adds ONLY
   `conversations_request_context_exclusive` (request convos carry no other context) — because
   NOT VALID CHECKs still enforce on UPDATE and conversations update on EVERY message; an
   "exactly one" constraint could have broken chat for legacy rows. log_request_contact creates
   the conversation SERVER-SIDE and returns conversation_id.
6. `20260611_offers.sql` — offers table (one pending/conversation partial unique idx, counter
   chains, 85% floor via app_config.min_offer_ratio), messages.type+offer_id (default 'text'),
   analytics CHECK extended (+'offer','impression'), cars.sold_via, mark_listing_sold.
   create_offer handles unique_violation race → 'pending_offer_exists'.
7. `20260611_listing_analytics.sql` — record_listing_impressions (anon ok, ≤100/batch),
   get_my_listing_stats, 90d impression prune cron, idx_lae_listing_event.
8. `20260611_dealership_trending.sql` — trending table + weekly cron (Sun 21:00 UTC = Mon 00:00 Beirut)
   + initial populate.
9. `20260611_listing_slots.sql` — request/bind/release_listing_slot RPCs; TOTAL NO-OP while
   app_config.enforce_listing_slots=false. Free user allowance counts 'pending' too.

FK delete-safety audit (97f7179) applied across files 2/5/6: history never blocks deletions —
consumed_listing_id is a plain stamp (no FK, survives car deletion); featured_wallet_item_id,
wallet_item_id, car_request_id, conversation_id, offers.message_id/parent, messages.offer_id all
SET NULL; offers.made_by CASCADE (seller deletion was blocked by offers in buyers' convos);
regions FKs intentionally RESTRICT (lookup protection).

## After migrations (owner TODO)
1. Deploy: `supabase functions deploy wallet-purchase && supabase functions deploy wallet-purchase-status && supabase functions deploy wallet-purchase-callback --no-verify-jwt && supabase functions deploy process-notifications`
2. Env: `APP_HMAC_SECRET` REQUIRED (wallet flow); optional WHISH_API_URL (defaults prod), WHISH_SUCCESS/FAILURE_REDIRECT_URL.
3. Sandbox-test 1 purchase; replay callback twice (2nd must be no-op 'already_paid').
4. Real prices in /admin/pricing (seed = placeholders); flip enforce_listing_slots only after seeding wallets.
5. Retire expire-boosts edge fn; later undeploy credit-purchase/-callback/credit-operations.
6. Device pass both roles (feature→banner, buy→wallet, request→contact→push, offer round-trip incl. <85% reject + counters, mark sold, stats, trending).

## Commits on credit-system (mobile repo)
8ac69e3 backend foundation (9 migrations + wallet edge fns + process-notifications generic fallback)
551bc06 P1 featured ads UI · 3283123 P2 featured businesses · 70b59e7 P3 car requests UI
ef0b8c2 P4 wallet screens + slot wiring · 1ce878b P5 offers + mark-sold · e3cfb30 P6 impressions/stats
5a291a3 P7 trending + urgent expiry · b5f9cb6 review fixes (offer race, allLebanon key, walletKey memo)
1e6089f staggered backfill + stale-boost cleanup · 3185e83 conversations constraint safety
5f61be6 one-expiry-per-type wallet lock · d35fc4a payment-provider abstraction · 97f7179 FK delete-safety
fleet-webapp: 9e545bd (admin wallets/pricing/car-requests/revenue + featured toggle + requireAdmin).

## Design decisions agreed with owner (rationale matters for future asks)
- Wallet = 1 row per consumable credit (wallet_items), money in wallet_acquisitions
  (kind online_purchase/admin_grant/admin_refund; refunds = negative rows, originals never mutated).
  Bundle {"listing":2,"featured_ad":3} → 5 item rows, prorated unit_price_usd, ONE shared expires_at.
- pricing_packages IS the bundles table; contents jsonb = {type: count}; acquisitions stamp package_id
  → per-bundle admin analytics possible with zero schema change. OFFERED, NOT YET BUILT:
  per-bundle breakdown on /admin/revenue — owner sounded positive, awaiting explicit go.
- ONE EXPIRY PER CREDIT TYPE (owner rule): enforced FRONTEND-ONLY (5f61be6) — WalletView locks
  packages containing a type the user still holds (lock icon + "use remaining X first, expires D").
  Feature sheet + request form already only sell at zero balance. Admin grants exempt BY DESIGN
  (DB unrestricted; bundles legal since one bundle = one expiry).
- Offline dealer packages = admin grants (/admin/wallets → Grant: counts + offline price + 365d
  default). Works for users too (support compensation). Revenue: online vs offline via kind.
- Payment providers: future-proofed (d35fc4a) — payment_provider/provider_ref + partial unique idx;
  new gateway = new edge fn pair + ref-keyed crediting RPC; everything downstream provider-agnostic.
  Heads-up given re Apple IAP requirement for digital goods if iOS payments expand.
- Consumption logging: consumed_at/-listing_type/-listing_id/-ref already on wallet_items,
  deliberately FK-free (historical stamps).

## Verification status
tsc: 696 (mobile) / 369 (webapp) pre-existing before AND after — zero new. ESLint clean on new files.
i18n parity exact (en/ar). Independent code review of full diff done; its findings fixed (b5f9cb6).
NOT yet done: anything requiring applied migrations/deployed functions (live E2E).

## House rules
Migrations: Claude writes SQL files, owner applies (DB read-only). Commits WITHOUT co-author.
Admin = fleet-webapp ONLY (no mobile admin). SDK54: router/segments in refs, replace in setTimeout(0),
context values useMemo'd. i18n en+ar always. PGRST116 guard. Brand #D55004. Old builds must keep
working: users.credit_balance + boost_priority=1 kept; whish-create-payment/whish-success untouched.
Pre-existing debt (flagged, untouched): RLS off on public.cars; legacy /api/admin/* unguarded.
