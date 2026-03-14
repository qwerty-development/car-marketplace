# Fleet (Car Marketplace) — Claude Code Instructions

## Project Overview
Mobile-first car marketplace app ("Fleet") for buying, selling, and renting vehicles in Lebanon. Users browse/favorite cars, dealers manage listings with analytics, credits, and AutoClips. Supports guest browsing, AI chat assistant, and number plate trading.

## Tech Stack
- **Framework:** React Native 0.81 + Expo SDK 54 (Expo Router v6, file-based routing)
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions, Storage)
- **Styling:** NativeWind v2 (Tailwind CSS 3.3) + React Native Paper + RNEUI
- **State:** TanStack React Query v5 (24h aggressive caching) + Context API
- **i18n:** i18next (English + Arabic with RTL support)
- **Package Manager:** npm
- **Testing:** Jest with jest-expo preset (minimal coverage)
- **Error Tracking:** Sentry
- **Analytics:** Facebook SDK (Meta Events)
- **Payments:** Whish payment gateway (Edge Functions)

## Critical Business Rules
- **Roles:** `user` (browse/buy) vs `dealer` (manage listings/analytics) — determined by `profile.role`
- **Credits:** Dealers spend credits to boost listings, create AutoClips, export data
- **Guest mode:** Users can browse without auth; protected actions show AuthRequiredModal
- **Subscriptions:** Dealers have `subscription_end_date`; expired dealers lose premium features
- **Deep links:** `fleet://cars/[id]`, `fleet://clips/[id]`, `fleet://messages/[id]`

## Architecture Patterns

### SDK 54 Critical Rules (MUST FOLLOW)
- `useSegments()` and `useRouter()` return NEW refs every render — store in refs, never in deps
- All `router.replace()` calls MUST use `setTimeout(0)` to avoid nested update cascades
- Context provider values MUST be wrapped in `useMemo`; functions via `useCallback` or ref wrappers
- See `MAXIMUM_UPDATE_DEPTH_FIX.md` for full bug report

### Provider Chain (app/_layout.tsx)
```
ErrorBoundary > GestureHandler > SafeArea > GuestUser > Auth > DeepLink
> QueryClient > Theme > StatusBar > Language > Credit > Favorites
> Notifications > RootLayoutNav > Slot
```

### Supabase Client (utils/supabase.ts)
- Auth tokens in SecureStore (not AsyncStorage)
- Realtime enabled at 10 events/sec
- Dual auth init: `loadSession()` + `onAuthStateChange()`

### React Query (utils/queryClient.ts)
- 24h stale time, 7-day cache time, no refetch on focus/mount/reconnect
- 1 retry with 1s delay

## File Structure
```
app/                    # Expo Router v6 file-based routing
  (auth)/               # Sign-in, sign-up, forgot-password, OAuth callback
  (home)/(user)/        # User role: browse, favorites, search, profile
  (home)/(dealer)/      # Dealer role: dashboard, analytics, listings
  car/[id].tsx          # Deep link routes
components/             # Reusable UI (64 files — CarCard, ListingModal, etc.)
utils/                  # Contexts + helpers (AuthContext, supabase, queryClient)
hooks/                  # Custom hooks (useNotifications, useCachedCars, etc.)
services/               # Business logic (NotificationService, ChatService)
types/                  # TypeScript interfaces
locales/                # en.json, ar.json translations
supabase/functions/     # Deno Edge Functions (credits, payments, notifications)
plugins/                # Expo config plugins (splash, proguard)
assets/                 # Images, sounds, brand logos
```

## Styling
- **Brand color:** `#D55004` (orange-red accent)
- **Dark mode:** `night: #0D0D0D` background
- **Light mode:** `#FFFFFF` background, `#333333` text
- **Config:** `tailwind.config.js` — extend colors with `light.*` and `red` alias

## Commands
```bash
npm start               # Expo dev server
npm run ios             # iOS build + run
npm run android         # Android build + run
npm run lint            # ESLint via expo lint
npm test                # Jest (--watchAll)
npx expo prebuild       # Generate native projects
eas build --profile release  # Production build
```

## Prohibitions (NEVER DO)
- Never add `router` or `segments` from Expo Router to `useEffect` deps — use refs
- Never use `<Redirect>` in layout files — return `null`, navigate in parent
- Never show `Alert` on PGRST116 errors — it means 0 rows, not a real error
- Never create additional Supabase client instances — use `utils/supabase.ts` singleton
- Never store auth tokens in AsyncStorage — only SecureStore
- Never call `router.replace()` synchronously in render — always `setTimeout(0)`

## Code Conventions
- TypeScript strict mode with `@/*` path alias
- NativeWind `className` for styling (Tailwind classes)
- Supabase `.single()` — always guard `error?.code !== 'PGRST116'` for 0-row case
- Use `useRef` for router/segments to avoid SDK 54 re-render loops
- Components prefixed with `_` (e.g., `_ProfileHeader.tsx`) are route-local, not shared
- Large modals are separate component files (ListingModal, FilterModal, etc.)

## Verification
- After modifying components: `npx tsc --noEmit` on changed files to check types
- After modifying providers/context: verify the provider chain order in `app/_layout.tsx`
- After modifying auth: test both user and dealer role flows
- After modifying deep links: test with `fleet://` scheme and `https://fleetapp.me/` URLs
- After modifying i18n: check both `en.json` and `ar.json` have the new keys

## Key Files
- `app/_layout.tsx` — Root layout, provider chain, DeepLinkHandler, InitManager (55KB)
- `utils/AuthContext.tsx` — Auth state machine, role routing, profile fetch (60KB)
- `utils/GuestUserContext.tsx` — Guest mode with AsyncStorage UUID
- `utils/queryClient.ts` — React Query config with aggressive caching
- `utils/supabase.ts` — Supabase client initialization
- `hooks/useNotifications.ts` — Push notification lifecycle (34KB)
- `services/NotificationService.ts` — Token management singleton (35KB)
- `components/ListingModal.tsx` — Add/edit car listing form (1789 lines)

## When Debugging
- **"Maximum update depth exceeded"** — Check useEffect deps for router/segments objects; use refs
- **PGRST116 error** — `.single()` on 0 rows; guard with `error?.code !== 'PGRST116'`
- **Dealer pages crash for non-dealers** — `(dealer)` routes briefly mount during routing; keep fetches defensive
- **Auth loop on startup** — Check dual init paths in AuthContext; ensure `loadSession` completes before `onAuthStateChange` fires
- **Deep link not working** — Check DeepLinkQueue, safeReplace timing, and router ref initialization
- **RTL layout broken** — Language change requires app reload via `I18nManager.forceRTL()`
- **~780 pre-existing TS errors** — Mostly in auth, deep link, dealer files; don't try to fix all at once

## External Docs
- `MAXIMUM_UPDATE_DEPTH_FIX.md` — SDK 54 re-render cascade fix report
- `STARTUP_FIXES.md` — Startup issue solutions
- `SUPABASE_ENV_VARIABLES.md` — Backend env var setup
- `.mcp.json` — Supabase MCP server config (read-only)
