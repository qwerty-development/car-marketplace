# Fleet App – Startup & Navigation Fix Report

## Overview

The app suffered from a cascade of interrelated startup bugs that caused:
- Persistent `Maximum update depth exceeded` errors
- Double splash screen (logo appearing twice)
- Black screen after splash with no navigation occurring
- Profile fetch timeouts on cold start

All issues stemmed from the same root: **multiple components independently owned auth state and navigation**, creating races and loops. This document explains each bug and its fix in order of discovery.

---

## Bug 1 — `Maximum update depth exceeded` (Persistent, App Unusable)

**File:** `app/(auth)/_layout.tsx`

### What was wrong

`UnAuthenticatedLayout` contained:

```tsx
if (isSignedIn || isGuest) {
  return <Redirect href={'/'} />
}
```

`<Redirect>` in Expo Router triggers a **synchronous navigator state update during React's render/commit phase**. This counted as a nested update. During cold start, `isSignedIn` was transitioning (auth state settling), causing this component to re-render repeatedly, each re-render firing another `<Redirect>`, until React hit its 50-nested-update limit.

### The fix

Replaced `<Redirect>` with `return null`. The auth layout no longer navigates — it just renders nothing while `RootLayoutNav` handles navigation via its deferred `safeReplace()` (which uses `setTimeout(0)` to break out of the commit phase).

Added an `isLoaded` guard so the component doesn't even evaluate the signed-in check until auth has fully initialized:

```tsx
if (!isLoaded) return null
if (isSignedIn || isGuest) return null  // RootLayoutNav will navigate
```

---

## Bug 2 — `Maximum update depth exceeded` (Transient, Still Logged)

**File:** `app/(home)/_layout.tsx`

### What was wrong

`HomeLayout` called `setOperationState(...)` with transient `'running'` values during startup:
- `setOperationState({ userCheck: 'running' })` — fired on every user check start
- `setOperationState({ routing: 'running' })` — fired on every routing start

Each `setState` call schedules a re-render. During cold start, several effects fired in rapid succession (user check, routing, auth loading), each calling `setState`. The cumulative re-renders cascaded and hit React's nested-update limit.

### The fix

Replaced the `'running'` state transitions with **refs** (which don't trigger re-renders):

- `userCheckRunningRef.current = true/false` instead of `setOperationState({ userCheck: 'running' })`
- Removed `setOperationState({ routing: 'running' })` entirely — `routingStartedRef` already guards re-entry

Only final states (`'completed'`, `'failed'`) are written to state, since those need to trigger re-renders.

---

## Bug 3 — Profile Fetch Timeout on Cold Start

**File:** `utils/AuthContext.tsx`

### What was wrong

`PROFILE_FETCH` timeout was set to **8000ms**. Supabase can take 10–12 seconds to respond on a cold start (after the database idles). The timeout fired before the DB responded, landing in the catch block, which:
1. Called `setDealership(null)` (a state update)
2. Scheduled a retry 1000ms later
3. `loadSession`'s `finally` then called `setIsLoaded(true)` with `profile=null`

This meant the app entered a "loaded but no profile" state, causing routing to fire prematurely and then re-fire when the retry succeeded — creating the double-loading cycle.

### The fix

Increased `PROFILE_FETCH` timeout from `8000ms` to `15000ms` to safely cover Supabase cold-start latency.

---

## Bug 4 — Concurrent Profile Fetches (Race Condition)

**File:** `utils/AuthContext.tsx`

### What was wrong

On startup, two code paths both called `fetchUserProfile()` for the same user:
1. `loadSession()` — which called `getSession()` and then fetched the profile
2. `onAuthStateChange(INITIAL_SESSION)` — which also fetched the profile

Both fired within milliseconds of each other. Each produced its own set of `setState` calls (`setProfile`, `setDealership`, `setIsLoaded`). These interleaved updates created a state cascade that pushed React over the nested-update limit.

### The fix

Added a **dedup ref** `profileFetchActiveForRef`. When `fetchUserProfile` starts for a userId, it records that userId in the ref. Any concurrent call for the same userId bails out immediately:

```ts
if (profileFetchActiveForRef.current === userId) {
  return; // already in flight
}
profileFetchActiveForRef.current = userId;
// ... fetch ...
// finally: profileFetchActiveForRef.current = null
```

The ref is cleared in a `finally` block so retries can proceed after the first fetch completes.

---

## Bug 5 — `loadSession` Setting State Caused Auth/Navigation Race

**File:** `utils/AuthContext.tsx`

### What was wrong

`loadSession()` was calling:
```ts
setSession(sessionResult.data.session);
setUser(sessionResult.data.session.user);
// ...
setIsLoaded(true); // in finally
```

Meanwhile, `onAuthStateChange` fired `INITIAL_SESSION` (triggered as a side-effect of `getSession()`) and also set the same state. Both paths were setting `session`, `user`, and `isLoaded` simultaneously.

This made `RootLayoutNav` and `UnAuthenticatedLayout` both observe state changes at slightly different times, each firing routing/redirect logic simultaneously — causing the remount cascade and double splash.

### The fix

`loadSession` was made **completely stateless**. It only calls `supabase.auth.getSession()` to warm up the SDK connection (which triggers the `INITIAL_SESSION` event as a side effect). It sets zero React state.

`onAuthStateChange` is now the **sole owner** of all auth state: `session`, `user`, `profile`, `isLoaded`. The session timeout remains as the only fallback if `onAuthStateChange` never fires.

---

## Bug 6 — `INITIAL_SESSION` Firing Twice

**File:** `utils/AuthContext.tsx`

### What was wrong

Supabase fires `INITIAL_SESSION` twice during startup:
1. When the `onAuthStateChange` subscription is first created
2. Again as a side-effect of the `getSession()` call in `loadSession`

Each occurrence ran the full `fetchUserProfile` → `setState` pipeline, doubling all state updates.

### The fix

Added `initialSessionHandledRef` — a boolean ref that tracks whether `INITIAL_SESSION` has already been processed. The second occurrence is skipped:

```ts
if (event === 'INITIAL_SESSION') {
  if (initialSessionHandledRef.current) return; // skip duplicate
  initialSessionHandledRef.current = true;
}
```

The ref is reset in the effect's cleanup function so it works correctly if `isGuest` changes and the effect re-runs.

---

## Bug 7 — Safety Timeouts Firing Even When Routing Succeeded

**File:** `app/(home)/_layout.tsx`

### What was wrong

The MASTER (8s) and EMERGENCY (6s) loader timeouts always fired after their delay, regardless of whether routing had already completed normally. When routing succeeded in ~1.5s, these timeouts still fired at 6s and 8s, producing warning logs and redundant `setState` calls that could destabilize the already-settled state.

### The fix

Both timeouts now check `operationStateRef.current.routing === 'completed'` before doing anything:

```ts
const masterTimeout = setTimeout(() => {
  if (operationStateRef.current.routing === 'completed') return;
  // ... force complete
}, 8000);
```

They only act as true safety nets when the normal routing path failed.

---

## Bug 8 — Black Screen After Splash (Root Cause)

**File:** `app/_layout.tsx`

### What was wrong

The `RootLayoutNav` routing effect handled two cases:
1. Signed in **and in `(auth)` group** → navigate to `/(home)`
2. Not signed in **and not in `(auth)` group** → navigate to `/(auth)/sign-in`

During cold start, Expo Router starts at the **root route** (empty segments — not `(auth)`, not `(home)`). The routing effect ran with `segments = []`, `isSignedIn = true`. Since `inAuthGroup = false` and `isEffectivelySignedIn = true`, **neither condition matched** — `targetRoute` stayed `null` and the app was stuck on the root (black screen) forever.

`HomeLayout` never mounted because routing never placed the user in `(home)`, so all HomeLayout logs were absent.

This was discovered by adding detailed logging that showed:
```
segments=, isSignedIn=true, inAuthGroup=false
Routing decision: targetRoute=null
No navigation needed — already on correct route  ← wrong!
```

### The fix

Changed the routing condition from `inAuthGroup` to `!inHomeGroup`:

```ts
// Before:
if (isEffectivelySignedIn && inAuthGroup) {
  targetRoute = "/(home)";
}

// After:
const inHomeGroup = currentSegments[0] === "(home)";
if (isEffectivelySignedIn && !inHomeGroup) {
  const isOnCompleteProfile = currentSegments[0] === 'complete-profile';
  if (!isOnCompleteProfile) {
    targetRoute = "/(home)";
  }
}
```

Now, any signed-in user who is **not already in `(home)`** (and not on the profile completion screen) gets routed to `/(home)`. This correctly handles:
- Empty segments (root, cold start)
- Being in `(auth)` group
- Any other unexpected route

---

## Summary of Changes

| File | Change | Bug Fixed |
|---|---|---|
| `app/(auth)/_layout.tsx` | `<Redirect>` → `return null`, added `isLoaded` guard | Bug 1 — Max update depth (persistent) |
| `app/(home)/_layout.tsx` | `'running'` setState → refs | Bug 2 — Max update depth (transient) |
| `app/(home)/_layout.tsx` | Guarded safety timeouts with routing-complete check | Bug 7 — Spurious timeout logs/setState |
| `app/(home)/_layout.tsx` | Clear stale routing timeout when proceeding | Routing timeout accumulation |
| `utils/AuthContext.tsx` | `PROFILE_FETCH` 8s → 15s | Bug 3 — Profile timeout on cold start |
| `utils/AuthContext.tsx` | `profileFetchActiveForRef` dedup guard | Bug 4 — Concurrent profile fetches |
| `utils/AuthContext.tsx` | `loadSession` made stateless | Bug 5 — Auth/navigation race |
| `utils/AuthContext.tsx` | `initialSessionHandledRef` dedup | Bug 6 — INITIAL_SESSION twice |
| `app/_layout.tsx` | `inAuthGroup` → `!inHomeGroup` routing condition | Bug 8 — Black screen after splash |

---

## Root Principle

All bugs traced back to **split ownership of auth state**. Multiple components (`loadSession`, `onAuthStateChange`, `RootLayoutNav`, `UnAuthenticatedLayout`, `HomeLayout`) were each independently reading and reacting to auth state at slightly different render cycles, producing races where navigation commands conflicted mid-commit.

The fix consolidated ownership: `onAuthStateChange` owns all auth state, `RootLayoutNav` owns top-level routing, and child layouts (`(auth)`, `(home)`) render passively based on state rather than issuing their own navigation commands.
