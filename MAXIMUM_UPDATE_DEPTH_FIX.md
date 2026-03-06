# Fix: "Maximum update depth exceeded" on iOS Cold Start

**Date:** March 5, 2026  
**Commit:** `c844d1c`  
**Affects:** Logged-in users on iOS (cold start). Auth/guest flows were unaffected.

---

## The Problem

On iOS, logged-in users saw this crash immediately on app launch:

```
Error: Maximum update depth exceeded. This can happen when a component
repeatedly calls setState inside componentWillUpdate or componentDidUpdate.
React limits the number of nested updates to prevent infinite loops.
```

The error pointed at `<Slot />` inside `RootLayoutNav` (app/_layout.tsx). Clicking "Try again" would successfully load the app, proving the issue was a transient cascade during initialization — not a permanent loop.

---

## Root Cause

The crash was caused by **five independent problems** that combined into a single cascade during the cold-start auth initialization:

1. **AuthContext.Provider** created a new value object on every render (13 non-memoized functions in the dependency list defeated `useMemo` entirely)
2. **GuestUserContext.Provider** did the same — new functions + new value object on every render, which re-rendered `AuthProvider` (a consumer of the guest context)
3. **DeepLinkHandler** used `segments` (Expo Router SDK 54 returns a new array ref every render) directly in a `useEffect` dependency, causing a 500ms navigation-ready timer to reset on every render and never complete
4. **RootLayoutNav** mounted `<Slot />` (Expo Router's navigator) synchronously during the auth state update cascade, whose internal setState calls counted as nested updates
5. **HomeLayout** used full `user`/`profile` objects as effect dependencies (new references every cold-start state update) and called `router.replace()` synchronously during React's commit phase

Together: auth initializes → sets user/session/profile → AuthProvider re-renders → new context value object → every `useAuth()` consumer re-renders → their effects fire → they call `router.replace()` as nested updates → navigator's setState fires → React's nested-update counter hits 50 → crash.

---

## Fixes Applied (6 files)

### 1. `utils/AuthContext.tsx` — Stable function wrappers via `fnsRef`

**Problem:** `useMemo` on the context value had all 13 functions (`signIn`, `signOut`, `signUp`, etc.) in its dependency array. These functions were plain `const fn = async () => {}` — recreated on **every render**. This meant `useMemo` recalculated on every render, producing a new context value object every time, which forced every `useAuth()` consumer to re-render.

**Fix:** Store the latest function references in a `useRef`, and expose **stable wrapper functions** in the memoized value that delegate through the ref:

```tsx
// Store latest function implementations in a ref (updated every render)
const fnsRef = useRef({ signIn, signUp, signOut, /* ... */ });
fnsRef.current = { signIn, signUp, signOut, /* ... */ };

const contextValue = useMemo(() => ({
  // Data values (these ARE in the deps array — trigger re-renders when they change)
  session, user, profile, dealership, isLoaded, isSignedIn, isSigningOut, isSigningIn,

  // Stable wrappers — identity never changes, but they always call the latest impl
  signIn: ((...args) => fnsRef.current.signIn(...args)) as typeof signIn,
  signOut: (() => fnsRef.current.signOut()) as typeof signOut,
  // ... same pattern for all 13 functions
}), [
  session, user, profile, dealership, isLoaded, isSigningOutState, isSigningIn,
  // Functions intentionally excluded — stable wrappers via fnsRef used instead
]);
```

**Why this works:** The wrapper functions are created once (during the initial `useMemo` call) and never change. But when called, they always invoke `fnsRef.current.signIn(...)` which points to the latest closure. Consumers only re-render when actual data values change.

---

### 2. `utils/GuestUserContext.tsx` — Memoized value + `useCallback`

**Problem:** `GuestUserProvider` created new function objects (`setGuestMode`, `clearGuestMode`) and a new `value` object on every render. Since `AuthProvider` is a consumer of `GuestUserContext` (via `useGuestUser()`), every `GuestUserProvider` render forced `AuthProvider` to re-render, which cascaded down to all `useAuth()` consumers.

**Fix:**
```tsx
// Wrap functions in useCallback so they have stable identity
const setGuestMode = useCallback(async (isActive: boolean) => { /* ... */ }, [guestId]);
const clearGuestMode = useCallback(async () => { /* ... */ }, []);

// Memoize the provider value
const value = useMemo(() => ({
  isGuest, guestId, setGuestMode, clearGuestMode
}), [isGuest, guestId, setGuestMode, clearGuestMode]);

return <GuestUserContext.Provider value={value}>...</GuestUserContext.Provider>;
```

**Why this works:** The context value object only changes when one of the four values actually changes. `AuthProvider` no longer re-renders on every `GuestUserProvider` render.

---

### 3. `app/_layout.tsx` — Two fixes

#### 3a. DeepLinkHandler: `segments` → `hasSegments` boolean

**Problem:** An effect that gates `isNavigationReady` used `segments` in its dependency array:
```tsx
// BEFORE — segments is a new array ref every render (SDK 54)
useEffect(() => {
  if (isLoaded && segments.length > 0) {
    const timeout = setTimeout(() => setIsNavigationReady(true), 500);
    return () => clearTimeout(timeout);
  }
}, [isLoaded, segments]); // ← re-fires every render, resetting the 500ms timer
```

This meant every re-render (caused by the cascading context updates above) would tear down the existing 500ms timeout and start a new one. `isNavigationReady` could never become `true` during the cascade.

**Fix:** Derive a stable primitive boolean:
```tsx
const hasSegments = segments.length > 0;
useEffect(() => {
  if (isLoaded && hasSegments) {
    const timeout = setTimeout(() => setIsNavigationReady(true), 500);
    return () => clearTimeout(timeout);
  }
}, [isLoaded, hasSegments]); // ← only fires when the boolean flips (once)
```

#### 3b. RootLayoutNav: Deferred `<Slot />` mounting via `requestAnimationFrame`

**Problem:** `<Slot />` (Expo Router's navigator component) was mounted synchronously as soon as `isLoaded` became `true`:
```tsx
{isLoaded ? <Slot /> : null}
```

On iOS with React Fabric, this initialization happened during the same commit phase where `AuthProvider` was setting `session`, `user`, and `profile`. The navigator's own internal `setState` calls counted as nested updates, pushing the accumulated count past React's 50-update limit.

**Fix:** Defer the mount by one animation frame:
```tsx
const [slotReady, setSlotReady] = useState(false);
useEffect(() => {
  if (isLoaded && !slotReady) {
    const frameId = requestAnimationFrame(() => setSlotReady(true));
    return () => cancelAnimationFrame(frameId);
  }
}, [isLoaded, slotReady]);

// In JSX:
{slotReady ? <Slot /> : null}
```

**Why this works:** `requestAnimationFrame` runs after the current commit and paint cycle completes. By the time the navigator mounts, all auth state updates have settled and the nested-update counter has reset to zero.

---

### 4. `app/CustomSplashScreen.tsx` — `React.memo`

**Problem:** `CustomSplashScreen` re-rendered every time `RootLayoutNav` re-rendered (which was every time the auth context changed). This was wasteful — the component's only prop (`onAnimationComplete`) was already stable via `useCallback`.

**Fix:**
```tsx
export default React.memo(CustomSplashScreen);
```

**Why this works:** `React.memo` does a shallow comparison of props. Since `onAnimationComplete` has a stable identity (from `useCallback`), the splash screen never re-renders during the auth cascade.

---

### 5. `app/(home)/_layout.tsx` — Three fixes

#### 5a. Primitive deps instead of object refs

**Problem:** The user-check and routing effects had `user` and `profile` objects in their dependency arrays. During cold start, these objects are re-set multiple times (initial null → session load → auth state change) and each set creates a new reference, re-firing the effects even when the meaningful data hasn't changed.

**Fix:** Derive primitives:
```tsx
const hasUser = !!user;
const hasProfile = !!profile;
const profileRole = profile?.role ?? null;
const profileName = profile?.name ?? null;

// Effect deps use primitives:
}, [isSignedIn, hasUser, isGuest, guestId, profileName, forceComplete]);
```

#### 5b. Deferred `router.replace()` calls

**Problem:** Three `router.replace()` calls happened synchronously during React's commit phase (inside `useEffect`). On iOS Fabric, these are nested state updates on the navigator component.

**Fix:** Wrap all `router.replace()` calls in `setTimeout(fn, 0)`:
```tsx
// BEFORE
routerRef.current.replace("/(auth)/sign-in");

// AFTER
setTimeout(() => { routerRef.current.replace("/(auth)/sign-in"); }, 0);
```

**Why this works:** `setTimeout(fn, 0)` defers execution to after the current React commit cycle, so the navigator's setState isn't counted as nested.

#### 5c. Added `operationState.userCheck` to routing effect deps

**Problem:** The routing effect had a ref-based guard (`routingStartedRef`) that prevented re-entry, but it also relied on `operationState.userCheck` being `'completed'` before proceeding. With unstable object deps removed (fix 5a), nothing re-triggered the routing effect after the user check completed. This caused the app to stall on the loading screen for 6–8 seconds until the master timeout fired.

**Fix:** Add `operationState.userCheck` to the dependency array:
```tsx
}, [isLoaded, isSignedIn, isGuest, hasUser, hasProfile, profileRole,
    operationState.userCheck, forceComplete]);
```

This is safe because the `routingStartedRef` guard prevents the routing logic from executing twice — the dep only ensures the effect gets a chance to run when the user check transitions to `'completed'`.

---

### 6. `app/(home)/(dealer)/_hooks/useDealershipProfile.ts` — Suppress PGRST116 alert

**Problem (bonus):** When a non-dealer user's page momentarily loaded the dealer layout, a Supabase "no rows found" error (PGRST116) triggered `Alert.alert('Error', ...)`, showing a confusing "JSON object requested" dialog to the user.

**Fix:** Only show the alert for actual errors, not the expected "no rows found" case:
```tsx
if (error?.code !== 'PGRST116') {
  Alert.alert('Error', error.message);
}
```

---

## Why the Previous Attempts Failed

| Attempt | What was tried | Why it didn't work |
|---------|---------------|-------------------|
| 1st (previous AI) | Removed `segments` and `safeReplace` from `RootLayoutNav` effect deps; used `segmentsRef` | Addressed one symptom but not the root amplifier (AuthContext creating new value objects every render). The effect still re-fired because `user`, `profile`, and `dealership` deps received new object references during cold start. |
| 2nd (previous AI) | Added `useMemo` on AuthContext value; added `routingDoneRef` guard; added fingerprint string | `useMemo` had all 13 functions in its deps — since none were wrapped in `useCallback`, they were new references every render, so `useMemo` recalculated every time and the fix was completely nullified. The routing guard helped but couldn't stop the cascade from other consumers. |

**The critical insight missed:** The `useMemo` added in attempt #2 was *correct in principle* but defeated by its own dependency array. The 13 function dependencies changed every render, making the memoization useless. The working fix uses `useRef` to bridge the gap — stable wrapper functions in the memoized value that delegate to the latest closures via a ref.

---

## How to Verify

1. **iOS cold start (logged-in user):** App should load directly to home screen without any error boundary flash.
2. **iOS cold start (guest user):** App should load to home screen.
3. **Sign out → Sign in:** No "Maximum update depth" error during the auth state transition.
4. **Deep links:** `fleet://cars/123` should work on both iOS and Android.
5. **Console output:** Look for `[RootLayoutNav] Routing effect fired:` — should appear ≤2 times during cold start (once for initial state, once after profile loads). If you see it repeating rapidly, the fix has regressed.
6. **Render count:** If `[RootLayoutNav] HIGH RENDER COUNT: 20 renders` appears, investigate — it means something is causing excessive re-renders.
