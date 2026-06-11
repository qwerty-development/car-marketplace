# HANDOFF — Fleet v3.0 New Features (18 user stories)

Session handoff, 2026-06-11. Read this top-to-bottom before doing anything.

## Source of truth
- Requirements: `/home/charbel/Desktop/Fleet_Development_Timeline.pdf` + `/home/charbel/Desktop/Fleet_User_Stories copy.pdf` (18 stories, 7 areas). Priorities: 1) Featured Ads, 2) Featured Businesses, 3) Car Requests, then Wallets, Offers, Listing Analytics, Inventory Insights.
- Approved plan: `/home/charbel/.claude/plans/home-charbel-desktop-fleet-development-stateful-stearns.md` (full per-phase detail — follow it).
- Two repos: mobile app = this repo (`car-marketplace`, branch `credit-system`); **ALL admin features = `/home/charbel/Desktop/qwerty/fleet-webapp`** (Next.js 14). NO admin screens on mobile, ever.

## DONE ✅

### 1. Backend foundation — committed on `credit-system` @ `8ac69e3`
9 migrations in `supabase/migrations/` (dated 20260611_*, NOT YET APPLIED — user applies manually, DB is read-only for Claude):
- `wallet_system.sql` — `wallet_acquisitions` (money ledger, `whish_external_id UNIQUE` = idempotency anchor), `wallet_items` (1 row per consumable: item_type `listing|featured_ad|car_request`, own `expires_at`; online ~30d via package, admin grants 365d), `pricing_packages` (placeholder seed — client sets real prices in admin), `app_config` (listing_duration_days=60, feature_duration_days=8, free_car_requests_per_month=2, min_offer_ratio=0.85, free_active_listings_user=1, enforce_listing_slots=false), RPCs: `credit_wallet_purchase`, `mark_wallet_purchase_failed`, `admin_grant_wallet_items`, `admin_revoke_wallet_items`, `admin_refund_wallet_items`, `consume_wallet_item` (internal, SKIP LOCKED), `get_my_wallet()` (authenticated), cron `expire-wallet-items` nightly.
- `listing_lifecycle.sql` — `expire_at` + warning stamps + `featured_wallet_item_id` on cars/cars_rent (+plates boost cols `is_boosted/boost_priority/boost_end_date`); backfill grandfathered (now()+60d, NOT listed_at+60d); insert triggers; crons hourly: `expire_featured_listings` (clears boost all 3 tables + notify), `expire_listings` (available→'expired' + notify), `send_expiry_warnings` (24h-before, idempotent stamps). Notifications ride existing `pending_notifications` pipeline.
- `featured_ads.sql` — `apply_featured_ad(p_listing_type,p_listing_id)` → {success, reason?('no_item'→open purchase), boost_end_date}; sets boost_priority=1 (legacy builds need it). `get_featured_listings(type,limit,random)` → jsonb array (sale rows include dealership_name/logo/phone/location/lat/long). anon+authenticated.
- `featured_businesses.sql` — `dealerships.is_featured/featured_until` + daily clear cron.
- `car_requests.sql` — `regions` (LB governorates + all_lebanon, en+ar names), `users.region`, `car_requests` (7d expiry, paid flag), `car_request_dismissals` (per-dealership X), `car_request_contacts`, `conversations.car_request_id`. RPCs: `create_car_request(...)` (2 free/calendar-month via app_config, then consumes car_request item, else reason 'payment_required'; per-user row lock vs races), `remove_car_request`, `get_car_requests_feed(region,limit,offset)` (dealer-only, newest-first, excludes dismissed, includes user name+phone), `dismiss_car_request`, `log_request_contact(request,channel,conversation?)` (notifies user, links conversation), hourly expire cron.
- `offers.sql` — `offers` table (one pending per conversation via partial unique index, counter chains via parent_offer_id, price snapshot), `messages.type('text'|'offer')+offer_id`, analytics event CHECK extended (+'offer','impression'), `cars.sold_via('fleet'|'other')`. RPCs: `create_offer(conversation,amount)` (buyer-only initial, floor = price×min_offer_ratio, returns min_amount on 'below_minimum'), `respond_offer(offer,action accept|decline|counter,counter_amount)` (opposite side only, FOR UPDATE lock, buyer counters keep 85% floor), `mark_listing_sold(car,sold_via,price?)`. Offer actions insert type='offer' messages with readable bodies → existing triggers handle conversation metadata + push automatically.
- `listing_analytics.sql` — `record_listing_impressions(p_events jsonb,p_viewer_id)` (anon ok, max 100/batch, 3 INSERT..SELECT by type), `get_my_listing_stats()` (per-listing + totals; impressions/offers from events, views from lifetime counters), 90-day impression prune cron, index `idx_lae_listing_event`.
- `dealership_trending.sql` — table + `refresh_dealership_trending()` (top-2 viewed sale cars per dealership, last 7d), weekly cron Sun 21:00 UTC (=Mon 00:00 Beirut), initial populate at migration time.
- `listing_slots.sql` — `request_listing_slot(type)` (no-op while enforce_listing_slots=false; users get free_active_listings_user free; dealers always consume) → `bind_listing_slot(item,type,id)` after insert / `release_listing_slot(item)` on failure (1h window).

Edge functions (in repo, NOT deployed):
- `_shared/whish.ts` — extracted Whish helpers; HMAC **required** (legacy treated missing sig as valid — fixed), externalId from DB sequence (not Date.now()), server-to-server `payment/collect/status` verification.
- `wallet-purchase` (deploy WITH JWT): {packageId} → server-side price lookup → pending acquisition → {collectUrl, externalId}.
- `wallet-purchase-callback` (deploy `--no-verify-jwt`): HMAC + Whish re-verify → `credit_wallet_purchase` RPC (idempotent pending→paid transition).
- `wallet-purchase-status` (WITH JWT): client polls after WebView; recovers lost callbacks. 
- `process-notifications/index.ts` MODIFIED: generic fallback branch so new types (feature_expired/feature_expiring/listing_expired/listing_expiring/car_request_contact/offer_*) deliver title/message from data instead of being dropped. Needs redeploy.
- Legacy NOT touched: `whish-create-payment`, `whish-success` (live subscriptions). `expire-boosts` edge fn to be retired after migrations applied. `users.credit_balance` + `boost_priority` kept for old builds.

### 2. Admin dashboard (fleet-webapp) — DONE but UNCOMMITTED working tree
13 new files + 2 modified, zero new tsc errors (369 pre-existing before & after):
- `utils/supabase/requireAdmin.ts` (cookie session → users.role==='admin' check; 401/403) — used by every new route.
- Routes: `app/api/admin/wallet` (+/grant,/revoke,/refund), `/api/admin/pricing` (+/config), `/api/admin/car-requests`, `/api/admin/dealerships/featured`, `/api/admin/revenue`.
- Pages: `app/admin/wallets`, `app/admin/pricing`, `app/admin/car-requests`, `app/admin/revenue`; `app/admin/dealerships/page.tsx` got featured toggle + expiry + badge; navbar got 4 items.
- Review then commit this repo separately (no co-author per CLAUDE.md).

## NOT DONE ❌ — all MOBILE app UI (this repo)
A dispatch prompt for Phase 1 mobile was prepared but the user REJECTED the agent launch — ask the user whether to build directly in-session or via smaller agents before dispatching anything. Remaining work (plan file has details):
1. **Phase 1 Featured Ads UI**: `hooks/useFeaturedListings.ts` (same-5-per-app-entry semantics: staleTime Infinity, refresh once per session), featured banner on user home + `FeaturedListings.tsx` view-all route, pin same 5 atop all-listings (dedupe), CarCard featured badge check, `components/FeatureListingSheet.tsx` (apply via RPC; 'no_item' → packages → wallet-purchase invoke → open collectUrl (expo-web-browser) → poll wallet-purchase-status 3s/60s → auto-retry apply), Feature buttons + countdowns + `expire_at` display on user MyListings + dealer inventory cards, NotificationService: add 4 new types (route via data.screen), i18n en+ar.
2. **Phase 2 mobile bit**: dealerships tab — featured-first ordering in ALL sort modes + badge.
3. **Phase 3 Car Requests UI**: user request form (reuse make/model pickers + allcars, region picker from `regions`), My Requests in profile (view/delete via remove_car_request), payment_required → purchase sheet (request_1 package); dealer feed screen (newest-first, region filter, X dismiss, call/WhatsApp/chat buttons — chat creates conversation via ChatService then `log_request_contact` with conversation_id; call/whatsapp log too); 'car_request_contact' notification type.
4. **Phase 4 Wallet UI**: user wallet screen (profile entry; counts + items + buy packages — REUSE FeatureListingSheet purchase plumbing), dealer wallet (subscription_end_date + remaining listings/featured), listing-slot consumption wiring on listing create flows (request_listing_slot → insert → bind/release) — only active when enforce_listing_slots flips.
5. **Phase 5 Offers UI**: chat composer offer button (buyer side, min 85% validation w/ min_amount from RPC), offer bubbles for type='offer' messages (join offers by offer_id: pending/accepted/declined/superseded states), one-tap accept/decline/counter for the opposite side (`respond_offer`), 'offer_received'-style notifications come free via existing message pushes; Mark-as-sold in MyListings (`mark_listing_sold`, required fleet/other choice, Sold section in profile listings).
6. **Phase 6 Analytics UI**: impression tracker util (FlatList viewabilityConfig ≥500ms, session dedupe, flush 30s/50 events → record_listing_impressions with guest UUID for anon), MyListings per-card impressions/views/offers + totals header (get_my_listing_stats, invalidate on focus).
7. **Phase 7 Trending UI**: dealer inventory "Trending this week" (top-2 from dealership_trending, make/model), <7-days red/amber styling on expiry dates.
8. **Final sweep**: `npx tsc --noEmit` (zero NEW errors; ~780 pre-existing), lint, i18n key parity en/ar, api-tester agent on wallet/offers backend, coderabbit review, commit per phase (NO co-author).

## User TODO (manual, Claude can't)
1. Apply the 9 migrations IN FILENAME ORDER (wallet_system first — others depend on it).
2. Deploy: `supabase functions deploy wallet-purchase && supabase functions deploy wallet-purchase-status && supabase functions deploy wallet-purchase-callback --no-verify-jwt && supabase functions deploy process-notifications`.
3. Env (Supabase dashboard): `APP_HMAC_SECRET` now REQUIRED for wallet flow; optional `WHISH_API_URL` (defaults prod), `WHISH_SUCCESS_REDIRECT_URL`/`WHISH_FAILURE_REDIRECT_URL`.
4. After migrations: retire `expire-boosts` edge function; later undeploy `credit-purchase`/`credit-purchase-callback`/`credit-operations` once new app ships.
5. Set real prices in /admin/pricing (seed is placeholder); flip `enforce_listing_slots` when ready.

## House rules (from CLAUDE.md — enforce)
SDK54: router/segments in refs, router.replace in setTimeout(0), context values useMemo'd. Supabase singleton only; PGRST116 guard. i18n both en.json+ar.json. FlatList + expo-image. Brand #D55004 (bg-red/text-red). Commits WITHOUT co-author. Known pre-existing issue (out of scope, flagged): `public.cars` has RLS disabled; old admin routes unprotected (new ones use requireAdmin).

## Task list state (in-session tracker)
#1 Phase 0 ✅ · #2 Featured Ads in_progress (backend ✅, mobile ❌) · #3 Featured Businesses (admin ✅, mobile ordering ❌) · #4 Car Requests (backend+admin ✅, mobile ❌) · #5 Wallet UI (admin ✅, mobile ❌) · #6 Offers (backend ✅, mobile ❌) · #7 Analytics (backend ✅, mobile ❌) · #8 Trending (backend ✅, mobile ❌) · #9 verification sweep ❌.
