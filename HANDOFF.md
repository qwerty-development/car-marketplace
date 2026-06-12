# Fleet v3.0 — Session Handoff (2026-06-12, updated same day, evening)

All 18 user stories (7 feature areas) are IMPLEMENTED, REVIEWED, and COMMITTED in both repos.
DB is in TESTING phase (owner's words), not serving real production traffic yet.

## CURRENT STATE — verified LIVE via Supabase MCP 2026-06-12 (read-only access works now)
- ✅ ALL 9 migrations APPLIED — including the reworked market_trending (app-wide, dealer-only
  RLS). Verified live: latest wallet version (payment_provider/provider_ref present), plates
  enum has 'expired', RLS enabled on all 7 new tables, enforce_listing_slots=false, all new
  crons scheduled and succeeding. pg_cron is 1.6 (named cron.schedule UPSERTS — re-running
  migration files does NOT duplicate jobs).
- ⏳ NEXT TO APPLY (in order): `20260612_hardening_patch.sql` (review fixes — see below), then
  `20260612_admin_expiry_tools.sql` (admin expiry levers — see below). Mobile fixes for the
  review are in the working tree (plates slot wiring, mark_listing_sold RPC usage).

## Admin expiry tools (2026-06-12, owner-requested)
SQL `20260612_admin_expiry_tools.sql`: admin_extend_listing_expiry (single listing: extends from
GREATEST(expire_at, now()), REVIVES expired→available, resets warning stamp; refuses
sold/rented/deleted) + admin_extend_all_expiries (bulk grace for AVAILABLE only — deliberately
never revives; optional type + dealership scope for VIP deals) + admin_extend_listings_expiry
(multi-select batch: BIGINT[] ids, one type, max 500 — extends AND revives since admin
hand-picked; rows locked up front vs the hourly cron; returns extended/revived/skipped). All
service_role-ONLY (no authenticated grant), p_admin_id audit via RAISE LOG, plates gotchas
honored (enum status, no date_modified, deleted_at guard). fleet-webapp:
/api/admin/listings/extend-expiry + /extend-all + /extend-selected (requireAdmin), listings
page: per-card amber "Extend" button + modal (presets 7/30/60/90, "Restore & Extend" for
expired), checkbox overlay per card + sticky selection bar (Select page / Clear / Extend
Selected → batch modal; selection clears on view-type switch), toolbar "Extend All Expiries"
(hidden on User Listings view; scopes to current type + dealership filter), "Expired" added to
status filters, Car type: status union +'expired', expire_at field. tsc: 369 pre-existing, 0 new.
- ❗ Two PRE-EXISTING crons fail daily, unrelated to v3.0 (owner should clean up):
  `cleanup-pending-payment-logs` (function dropped by credit-system removal — unschedule it) and
  `remind-inactive-users-cron` (http call with EMPTY Bearer token + 5s timeout — never worked).

## 2026-06-12 full review (3 subagents + live DB) → 20260612_hardening_patch.sql
SQL patch (idempotent, safe to re-run): expiry triggers now BEFORE INSERT OR UPDATE with
WHEN (NEW.expire_at IS NULL) guard + catch-up stamp (2 live cars were 'immortal': available with
NULL expire_at — pending at apply time, approved later); expire_wallet_items reclaims orphaned
'reserved' slot items >2h (app crash between request/bind lost the credit forever);
log_request_contact dedupe — UNIQUE(request_id,dealership_id,channel), notify on first contact
only (was an unbounded push-spam vector); apply_featured_ad locks listing FOR UPDATE + returns
'already_featured' if boost_end > now()+7d (double-tap burned 2 credits for 1 boost);
mark_listing_sold: OLD 3-ARG SIGNATURE DROPPED, new sig adds p_buyer_name/p_date_sold (no
released build calls it; both client callers updated).
Mobile fixes: NumberPlatesManager (user AND dealer) now do request/bind/release slot wiring with
p_listing_type='plate' (was a total quota bypass once enforcement flips); AddEditListing user-mode
mark-sold goes through mark_listing_sold RPC with fleet/other Alert (was raw .update that never
set sold_via and trusted client userId with RLS off on cars); dealer/rent path unchanged.
Known-debt findings deliberately NOT fixed yet (medium): admin_grant jsonb count validation,
refund-of-consumed policy, get_car_requests_feed ignores subscription_end_date (product call),
idempotency guard on conversations_request_context_exclusive ADD CONSTRAINT (re-run of
car_requests.sql now errors there — harmless, already applied), missing
(listing_type,event_type,created_at) index for trending/prune, 90d floor in get_my_listing_stats,
search_path pin on app_config_numeric/_bool. Client polish: own_offer toast case,
useImpressionTracker clearInterval, router/validateFormData in AddEditListing callback deps,
useConversationOffers dep suppression.

## Migration reference — ALL APPLIED (kept for what-each-does documentation)
1. ~~wallet_system.sql~~ APPLIED (verify version, see above)
2. ~~20260611_listing_lifecycle.sql~~ APPLIED — and then UPDATED + RE-APPLIED same day
   (2026-06-12 session). Changes vs the originally-reviewed version:
   - Backfill changed from staggered 45–75d to a FLAT 75 days for all existing
     available listings (owner decision).
   - number_plates now gets the FULL expiry lifecycle too (owner confirmed plates
     follow the same 2-month rule): expire_at + expiry_warning_sent_at columns,
     75d backfill, insert trigger, partial index, plates loops added to
     expire_listings() + send_expiry_warnings().
   - PLATES SCHEMA GOTCHAS handled (found by codebase verification, would have
     crashed the hourly crons): number_plates has NO date_modified column (not
     set there); number_plates.status is an ENUM, not text — migration has a DO
     block that ALTER TYPE ADD VALUE 'expired' if missing; all loop columns
     qualified (id/user_id ambiguous vs dealerships join).
   - File is fully idempotent — re-running the whole file on the already-applied
     DB was the intended apply path.
   - POST-APPLY CHECK (DB read-only for Claude, owner runs): confirm 'expired'
     is in the plate status enum →
     `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
      JOIN pg_attribute a ON a.atttypid=t.oid JOIN pg_class c ON c.oid=a.attrelid
      WHERE c.relname='number_plates' AND a.attname='status';`
     (zero rows = status is text, also fine).
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
8. `20260611_dealership_trending.sql` — REWORKED 2026-06-12 (owner corrected the requirement):
   trending is APP-WIDE, not per-dealership — `market_trending` table = top 2 make+model by
   views over trailing 7d across the whole app (aggregated so no specific listing/competitor
   is exposed; sold cars' views still count as demand signal). Weekly cron
   `refresh-market-trending` (Sun 21:00 UTC = Mon 00:00 Beirut) + initial populate.
   RLS: SELECT for DEALERS ONLY (role checked against users profile; non-dealers get 0 rows,
   not an error), writes service_role. TrendingSection.tsx updated to match (no dealershipId
   prop, queries market_trending).
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
- Plate-specific listing credit: NOT PLANNED — owner was only stress-testing schema flexibility
  (2026-06-12) in case the client asks someday. Confirmed cheap if ever requested:
  request_listing_slot already receives p_listing_type ('sale'/'rent'/'plate'), so it's one CASE
  on the consume_wallet_item call + 'plate_listing' in the wallet_items CHECK and
  _insert_wallet_items_for_acquisition whitelist + a pricing_packages row + en/ar labels.
  Decisions to ask the owner only IF it ever happens: generic 'listing' fallback for plates?
  plates keep sharing free_active_listings_user (they count toward it, listing_slots.sql:52)?
  Do NOT build proactively.

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
