# Fleet v3.0 — Ship Checklist

All 18 user stories (7 feature areas) are IMPLEMENTED in both repos as of 2026-06-11.
Plan: `/home/charbel/.claude/plans/home-charbel-desktop-fleet-development-stateful-stearns.md`.
Delete this file once shipped.

## What shipped (commits on `credit-system`)
- `8ac69e3` backend foundation: 9 migrations + wallet edge functions + process-notifications fix
- `551bc06` Phase 1 Featured Ads mobile (banner, view-all, pinning, feature flow, expiry)
- `3283123` Phase 2 Featured Businesses mobile (featured-first dealership list + badge)
- `70b59e7` Phase 3 Car Requests mobile (form/quota/purchase, My Requests, dealer feed + contact)
- `ef0b8c2` Phase 4 Wallet screens (user/dealer) + listing-slot wiring (dormant behind flag)
- `1ce878b` Phase 5 Offers in chat (85% floor, counters, one-tap respond) + mark-as-sold
- `e3cfb30` Phase 6 impressions tracking + MyListings stats/totals
- `5a291a3` Phase 7 trending-this-week + <7-day urgent expiry styling
- (next commit) code-review fixes: create_offer unique-violation race, requests.allLebanon key, walletKey memo
- fleet-webapp `9e545bd`: /admin/wallets, /admin/pricing, /admin/car-requests, /admin/revenue, featured toggle, requireAdmin guard

## Verification done
- `npx tsc --noEmit`: 696 errors before AND after (all pre-existing; zero new across every phase)
- ESLint clean on all new files; i18n parity exact (157/157 new keys en+ar)
- fleet-webapp tsc: 369 pre-existing before/after, zero new
- feature-dev code review over the full diff: payment flow (HMAC required, server-side re-verification, idempotent crediting) confirmed sound; 2 found bugs fixed
- NOT yet possible: live testing (migrations unapplied, edge functions undeployed) — see below

## Owner TODO (in order)
1. Apply the 9 migrations in `supabase/migrations/20260611_*.sql` in FILENAME ORDER (wallet_system first).
2. Deploy edge functions:
   `supabase functions deploy wallet-purchase && supabase functions deploy wallet-purchase-status && supabase functions deploy wallet-purchase-callback --no-verify-jwt && supabase functions deploy process-notifications`
3. Env (Supabase dashboard): `APP_HMAC_SECRET` is REQUIRED for the wallet flow. Optional: `WHISH_API_URL` (defaults prod), `WHISH_SUCCESS_REDIRECT_URL` / `WHISH_FAILURE_REDIRECT_URL`.
4. Sandbox-test one purchase end-to-end (set `WHISH_API_URL` to sandbox; see WHISH_API_SANDBOX.md) and replay the callback URL twice — second call must return `already_paid`.
5. Set real prices in `/admin/pricing` (seed is placeholder); flip `enforce_listing_slots` in app_config when ready to charge for listings (existing listings grandfathered; users get `free_active_listings_user`=1, adjust there).
6. Retire the `expire-boosts` edge function; undeploy `credit-purchase` / `credit-purchase-callback` / `credit-operations` after the new app build is adopted.
7. Manual device pass (user + dealer roles): feature a car → banner/top-of-list w/ badge; buy package → wallet updates; create request → dealer dismiss/contact → user notified + chat deep-link; offer round-trip incl. sub-85% rejection and counter chain; mark sold (fleet/other); stats move; trending appears after view events accumulate.

## Known/pre-existing debt (flagged, intentionally untouched)
- RLS disabled on `public.cars`; legacy `/api/admin/*` routes unguarded (new ones use requireAdmin)
- `users.credit_balance` + `boost_priority` kept for old store builds
