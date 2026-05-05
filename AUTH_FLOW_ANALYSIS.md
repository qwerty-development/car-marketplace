# Fleet Auth Flow — Critical Analysis

**Scope:** sign-in, sign-up, phone verification, complete-profile, OAuth, session restore
**Files traced (~3,400 lines):**
`utils/AuthContext.tsx`, `utils/GuestUserContext.tsx`, `utils/signOutState.ts`,
`app/_layout.tsx`, `app/(auth)/_layout.tsx`, `app/(auth)/index.tsx`,
`app/(auth)/sign-in.tsx`, `app/(auth)/sign-up.tsx`, `app/(auth)/callback.tsx`,
`app/complete-profile.tsx`, `app/(home)/_layout.tsx`,
`app/(home)/(user)/VerifyPhoneOtp.tsx`, `app/(home)/(user)/VerifyEmailOtp.tsx`,
`app/(home)/(user)/VerifyCurrentEmailOtp.tsx`,
`components/PhoneVerificationBottomSheet.tsx`,
`supabase/migrations/20260203_protect_phone_number_from_direct_updates.sql`.

---

## 1. Architecture map

```
RootLayout (app/_layout.tsx)
└── GuestUserProvider                          ← isGuest, guestId
    └── AuthProvider                            ← session, user, profile, dealership
        ├── DeepLinkHandler                     ← also subscribes to auth state
        └── RootLayoutNav                       ← ROUTING DECISION #1
            └── (auth)/_layout.tsx              ← shows spinner if signedIn/guest
            │   ├── index.tsx                   ← landing
            │   ├── sign-in.tsx                 ← email + phone-OTP + Google + Apple
            │   ├── sign-up.tsx                 ← email + phone-OTP + Google + Apple
            │   ├── callback.tsx                ← OAuth deep-link return
            │   └── forgot-password.tsx
            │
            ├── /complete-profile.tsx           ← onboarding form (name + email + phone + dealer)
            │
            └── (home)/_layout.tsx              ← ROUTING DECISION #2
                ├── (home)/(user)/...           ← VerifyPhoneOtp / VerifyEmailOtp live here
                └── (home)/(dealer)/...

DB triggers:
  - prevent_direct_phone_number_update         ← public.users.phone_number gated by auth.users.phone
  - sync_auth_phone_to_public_users            ← (referenced; assumed) syncs after OTP verify
```

### State that drives routing (the implicit state machine)

| Variable | Where read | Source of truth | Initial value | Update mechanism |
|---|---|---|---|---|
| `isLoaded` | RootLayoutNav, (home)/_layout, (auth)/_layout | AuthContext | false | `getSession` resolves OR `onAuthStateChange` fires |
| `isSignedIn` | everywhere | AuthContext (`!!user \|\| !!session`) | false | onAuthStateChange |
| `isGuest` | everywhere | GuestUserContext / AsyncStorage | false | `setGuestMode` |
| `user.user_metadata.signup_completed` | RootLayoutNav | auth.users.user_metadata | undefined | `updateUser({data:{signup_completed:true}})` in 4 places |
| `user.user_metadata.phone_prompt_completed` | RootLayoutNav | auth.users.user_metadata | undefined | only set in complete-profile submit |
| `user.user_metadata.role` | RootLayoutNav | auth.users.user_metadata | undefined | processOAuthUser, updateUserRole |
| `user.phone` | RootLayoutNav, complete-profile | auth.users.phone | null | `updateUser({phone})` (also clears `phone_confirmed_at`) |
| `user.phone_confirmed_at` | complete-profile.isInputVerified | auth.users.phone_confirmed_at | null | `verifyOtp({type:'phone_change'})` |
| `profile` | RootLayoutNav, (home)/_layout | public.users (via fetchUserProfile) | `null` (NOT undefined) | fetchUserProfile, processOAuthUser, updateUserProfile |
| `profile.role` | (home)/_layout | public.users.role | null | sign-up (default 'user'), processOAuthUser |
| `dealership` | RootLayoutNav | public.dealerships | `undefined` (means loading) | fetchDealershipProfile |

There are **eight independent flags** the routing logic combines, none of them atomic, all racy on cold start.

---

## 2. Journey traces — every state mutation

### 2.1 Email sign-up (happy path)

```
sign-up.tsx::onSignUpPress
  → useAuth().signUp({email, password, name})
      → AuthContext.signUp
          → supabase.auth.signUp({email, password, options.data:{name, role:'user', signup_completed:false}})
              → SIGNED_IN event fires (if email auto-confirm) OR no event (if email-confirm required)
          → supabase.from('users').upsert([{id, name, email, favorite:[], role:'user', ...}])  ← UPSERT #1
      → returns {error:null, needsEmailVerification:bool}
  → if needsEmailVerification: show OTP screen (Alert.alert)
  → else: router.replace('/(home)')
       ↓ at the same time:
       AuthContext.onAuthStateChange handler fires (SIGNED_IN)
         → setSession, setUser
         → fetchUserProfile(id) — second fetch, might race upsert
       ↓
       RootLayoutNav routing effect (re-fires on user/segment changes)
         → user.user_metadata.signup_completed === false → isMissingFields = true
         → safeReplace('/complete-profile')
       ↓
       (home)/_layout routing effect (also runs once user is signed in)
         → checkAndCreateUser → upsert again (UPSERT #2)
```

**Number of upserts to public.users for one email sign-up: 2 — possibly 3 if PGRST116 fallback in fetchUserProfile triggers processOAuthUser.**

### 2.2 Phone sign-up

```
sign-up.tsx::handlePhoneSignUp
  → supabase.auth.signInWithOtp({phone, options:{shouldCreateUser:true, data:{full_name, name}}})
      → auth.users row CREATED (phone set, phone_confirmed_at null)
      → SMS sent
sign-up.tsx::handlePhoneOtpVerify
  → supabase.auth.verifyOtp({phone, token, type:'sms'})
      → SIGNED_IN event fires
      → phone_confirmed_at SET on auth.users
      → AuthContext.onAuthStateChange → fetchUserProfile → PGRST116 → processOAuthUser → upsert public.users with name from user_metadata.full_name
  → supabase.auth.updateUser({data:{full_name, name, signup_completed:true}})
      → USER_UPDATED event fires
      → Auth state listener doesn't refetch profile on USER_UPDATED, just updates session/user
  → no router.replace — relies on RootLayoutNav routing effect
       ↓
       RootLayoutNav: signup_completed=true, name=set, phone=set → falls through to home
```

**`pendingPhoneVerification` is never reset** — user keeps seeing the verify screen until routing kicks in. If routing has any glitch, they're stuck on the verification screen with no exit.

### 2.3 Apple / Google sign-up vs sign-in

Both routes (sign-up.tsx and sign-in.tsx) implement the same OAuth handlers but **differently**:

| Step | sign-up.tsx Apple | sign-in.tsx Apple | sign-up.tsx Google | sign-in.tsx Google |
|---|---|---|---|---|
| OAuth call | `signInWithIdToken` | `signInWithIdToken` | `useAuth().googleSignIn()` (OAuth via WebBrowser) | `useAuth().googleSignIn()` (same) |
| New-vs-existing detection | `created_at < 30s` | (none) | `created_at < 30s` | (none) |
| Token register | direct DB insert into `user_push_tokens` | direct DB insert | (handled in AuthContext with retry) | (same) |
| Navigation | direct `router.replace('/(home)')` | second `onAuthStateChange` listener does `router.replace('/(home)')` (re-creates listener every render) | direct `router.replace('/(home)')` | listener does it |
| Meta event | `COMPLETE_REGISTRATION` if new | `SIGN_IN` always | `complete_registration` if new | `SIGN_IN` always |

Three separate OAuth handlers exist for Apple, two for Google — divergent behaviour. The sign-in.tsx OAuth listener (lines 161-172) creates a **new subscription on every render** because `[router]` is in deps and `router` is a new ref every render in Expo Router v6.

### 2.4 OAuth user processing

```
AuthContext.processOAuthUser(session)
  ↓
  SELECT * FROM users WHERE id = ?
  ├── PGRST116 (not found):
  │     INSERT user with name from user_metadata.full_name || name || 'User', role='user'
  │     supabase.auth.updateUser({data:{role, signup_completed:false}})  ← FORCES /complete-profile
  └── existing row:
        if metadata missing role → metaUpdates.role = profile.role
        if metadata.signup_completed == null → metaUpdates.signup_completed = true   ← legacy backfill
        if updates → updateUser({data: metaUpdates})
```

OAuth returning users with `signup_completed === false` (e.g. they bailed last time) are **kept at false** — correct. But OAuth users who never had the flag get backfilled to true — they bypass /complete-profile. This is the legacy escape hatch.

### 2.5 complete-profile → home

```
complete-profile.tsx::handleSubmit
  → updateUserProfile({name, email?})         ← writes public.users
  → supabase.auth.updateUser({data:{signup_completed:true, phone_prompt_completed:true}})  ← USER_UPDATED
  → if dealer: updateDealershipProfile(...)
  → if email changed: updateUser({email}) → triggers email_change OTP → router.push('/VerifyEmailOtp') from inside an Alert.alert callback
       ↓ concurrently:
       USER_UPDATED → AuthContext updates user state
       RootLayoutNav routing effect re-fires
         → isMissingFields=false (signup_completed now true)
         → on /complete-profile → safeReplace('/(home)')      ← RACE with the email-OTP push!
```

User can be bounced between `/(home)` and `/VerifyEmailOtp` because the routing effect doesn't know an email-change was just triggered.

---

## 3. Bug catalogue (severity-ordered)

### CRITICAL — affects real users

#### **BUG-1: OTP doesn't arrive on retry — same phone, same session**
**Symptom (real user `433fba74-...`):** Google OAuth user has phone set on auth.users (`96170559916`) but `phone_verified:false`. After session expiry + re-sign-in, they hit phone OTP form, request code → no SMS → sign out & sign in → SMS arrives.

**Root cause:** When the client calls `supabase.auth.updateUser({phone: P})` and `auth.users.phone === P` already, gotrue's "phone unchanged" branch may not re-send the SMS, or it sends it but the per-session phone-change challenge token is reused/expired. The pending phone-change challenge is **session-scoped** in gotrue — sign-out invalidates it; new sign-in gets a fresh challenge.

Plus: phone comparison in `complete-profile.tsx::isInputVerified` (line 114) is strict-equal: `user.phone === fullInputPhone`. If `user.phone` is stored without `+` (`96170559916`) and `fullInputPhone` is `+96170559916`, they don't match — even when the phone IS confirmed.

**Locations:**
- `app/complete-profile.tsx:114` — `isInputVerified` strict compare without normalization
- `app/complete-profile.tsx:207` — `updateUser({phone})` re-fires regardless of state
- `components/PhoneVerificationBottomSheet.tsx:103` — same pattern
- `components/PhoneVerificationBottomSheet.tsx:162` — `handleResend` also uses `updateUser({phone})` instead of `auth.resend()`

**Fix (this commit):** Use `supabase.auth.resend({type:'phone_change', phone})` for re-sends; skip OTP entirely if phone already confirmed; normalize phone comparisons to digits-only.

#### **BUG-2: Dealer users can be permanently routed to `/(home)/(user)`**
`app/(home)/_layout.tsx:359` sets `routingStartedRef.current = true` *before* checking if profile is loaded. If profile is null when the routing effect first runs (cold-start race), the effect returns at line 402 with the ref already true. When profile loads with `role='dealer'`, the effect re-fires, hits `routingStartedRef.current === true` at line 336, returns early — **dealer never gets routed to `/(home)/(dealer)`**.

The 1.5s profile timeout fallback at line 390 also hard-codes `defaultRole = 'user'`.

**Effect:** Dealer users can be stuck in `(user)` route group, missing dashboard, analytics, dealer-specific UI.

#### **BUG-3: Email sign-in calls Supabase signInWithPassword TWICE**
`app/(auth)/sign-in.tsx:450` calls `supabase.auth.signInWithPassword({...})` directly, then on success at line 483 calls `useAuth().signIn({...})` which calls the same Supabase API again. Two network requests, two `onAuthStateChange` events, two profile fetches.

#### **BUG-4: sign-in.tsx OAuth listener re-subscribes every render**
`app/(auth)/sign-in.tsx:160-172`: `useEffect(() => supabase.auth.onAuthStateChange(...), [router])`. `router` is a new ref every render in Expo Router v6 → effect re-fires every render → tear down + re-subscribe constantly. Plus this listener is **redundant** with the AuthContext's listener and competes with RootLayoutNav for navigation.

#### **BUG-5: Phone sign-up name overwrite via verifyOtp**
`app/(auth)/sign-up.tsx:531-538`: After `verifyOtp` succeeds, `updateUser({data:{full_name, name, signup_completed:true}})`. If a malicious sign-up flow targets an existing phone number, this can OVERWRITE the existing user's name in metadata even though `signInWithOtp` itself doesn't (it ignores `data` for existing users). Mitigated only because the attacker needs the OTP delivered to the legitimate owner's phone.

#### **BUG-6: Hijack-detection clears legitimate user's name**
`app/(auth)/sign-in.tsx:582-588`: If a phone-account is `signup_completed !== true` AND `created_at < 1 hour`, the code assumes hijack and `updateUser({data:{name:null, full_name:null}})`. Legitimate scenarios that hit this:
- User signs up via phone, verifies OTP, but `updateUser({signup_completed:true})` fails (network glitch)
- User retries sign-in within an hour → name wiped → routed to /complete-profile

### HIGH — broken behaviour, occasional

#### **BUG-7: `pendingPhoneVerification` not reset on success**
`app/(auth)/sign-up.tsx:506-551`: `handlePhoneOtpVerify` doesn't clear `pendingPhoneVerification`. User stays on verify-phone screen until RootLayoutNav navigates them away. If routing fails or has any guard hit, user is stuck.

#### **BUG-8: complete-profile email-change races with routing**
`app/complete-profile.tsx:349-352`: `signup_completed=true` is stamped BEFORE `updateUser({email})` triggers email-change OTP. The USER_UPDATED event fires → RootLayoutNav redirects to /(home), but the user is also being pushed to /VerifyEmailOtp via Alert.alert. Race between `safeReplace('/(home)')` and `router.push('/VerifyEmailOtp')`.

#### **BUG-9: VerifyPhoneOtp.tsx is dead code with type mismatch**
`app/(home)/(user)/VerifyPhoneOtp.tsx:122` uses `type:'sms'`. No call site navigates here (the route is registered in `(user)/_layout.tsx` but only declarative). If something starts using it, the type is wrong: phone changes from `updateUser({phone})` need `type:'phone_change'`, not `'sms'`.

#### **BUG-10: profile state never goes to "undefined" — wait branch is dead**
`app/_layout.tsx:1332-1336`:
```js
} else if (profileIsUndefined) {
  console.log('[RootLayout] Waiting for profile to load...');
  return;
}
```
Never fires — `useState<UserProfile | null>(null)` initializes to `null`, not `undefined`. The intended "still loading" wait state doesn't exist.

#### **BUG-11: `(home)/_layout` routes to `(user)` with hardcoded default after 1.5s**
`app/(home)/_layout.tsx:390-402`: When profile is null, schedules a 1.5s timeout that routes to `(user)` regardless of actual role. On slow network, dealers always get misrouted.

### MEDIUM — wasteful or inconsistent

#### **BUG-12: Duplicate user upserts**
- AuthContext.signUp upserts to `public.users`
- AuthContext.processOAuthUser upserts to `public.users`
- (home)/_layout.checkAndCreateUser upserts to `public.users`

Three independent paths upserting the same row. Last write wins; can clobber a name set by complete-profile if (home)/_layout runs late with stale `user_metadata.name`.

#### **BUG-13: appleSignIn forgets to setUser/setSession**
`utils/AuthContext.tsx:1142-1162` calls `setProfile(userProfile)` only — relies on `onAuthStateChange` to set user/session. `googleSignIn` does it explicitly. Inconsistent + extra render cycle.

#### **BUG-14: AuthContext useEffect re-creates listener on `[isGuest]` change**
`utils/AuthContext.tsx:537`: When `isGuest` flips (guest→signed-in), the `onAuthStateChange` subscription tears down and rebuilds, calling `loadSession` again. Wasteful + race-prone.

#### **BUG-15: Three onAuthStateChange listeners can compete**
- AuthContext (the canonical one)
- sign-in.tsx (re-subscribed every render — see BUG-4)
- DeepLinkHandler reads via useAuth (not a listener but reacts to state)

#### **BUG-16: forceComplete in (home)/_layout doesn't trigger re-route**
The 8s master timeout flips `forceComplete=true` and marks all operations completed, but never re-runs the routing logic. User is left wherever they were when timeout fired.

### LOW — code quality

#### **BUG-17: stripCallingCode brittle prefix-match**
`app/complete-profile.tsx:74-88` strips known calling codes longest-first. If a user picks one country but `user.phone` was saved with another country's code that happens to be a prefix substring, wrong digits get stripped. Mitigated by the fact that the displayed local number is just for the input field.

#### **BUG-18: `verifyOtp` in AuthContext hardcoded to `type:'signup'`**
`utils/AuthContext.tsx:1391-1416`: The only call site is sign-up.tsx email verification, which is correct. But the function signature suggests reusability — should accept type or be renamed `verifyEmailSignupOtp`.

---

## 4. Root-cause patterns

### Pattern A — Multiple sources of truth for routing
Three separate routing effects (`RootLayoutNav`, `(home)/_layout`, ad-hoc `router.replace` in screens) plus three direct OAuth navigations. They don't coordinate; whoever fires last wins.

### Pattern B — Implicit state machine encoded as flag combinations
Eight flags determine routing. No single state-machine definition. Adding a flag (e.g. `phone_prompt_completed`) requires touching 3+ files and reasoning about cold-start ordering.

### Pattern C — auth.users.phone vs profile.phone_number split
auth.users.phone is the verification source; public.users.phone_number is synced via trigger. The DB enforces this, but the app sometimes reads from `user.phone` (auth) and sometimes from `profile.phone_number` (public). Comparisons across the two need normalization (digits-only) — this is missing in `isInputVerified`.

### Pattern D — Pending-state never cleared
- `pendingPhoneVerification` not reset after success
- `auth.users.phone` left set with `phone_confirmed_at=null` after a cancelled OTP — leaves the user in a broken state where re-sending OTP is rate-limited at the session level
- `verifyingPhone` not cleared on cancel

### Pattern E — OAuth flow duplicated across files
`processOAuthUser` lives in AuthContext, but sign-in.tsx and sign-up.tsx both contain their own OAuth Apple handlers with direct `auth.signInWithIdToken` + manual push-token registration. Three places to fix when OAuth changes.

### Pattern F — Race-prone optimistic UI
`updateUserProfile` does optimistic local set → DB update → re-fetch → re-set. If the re-fetch races with another USER_UPDATED event, profile ping-pongs.

---

## 5. Phased remediation plan

### Phase 1 — Stop the bleeding (this commit)
1. **Fix BUG-1 (OTP not arriving)** — covered in this commit:
   - Add E.164 normalization helper (`utils/phoneFormat.ts`)
   - In complete-profile.tsx and PhoneVerificationBottomSheet.tsx:
     - Compare `user.phone` to input as digits-only
     - If already confirmed and matches → mark verified, skip OTP
     - If set but unconfirmed → use `supabase.auth.resend({type:'phone_change', phone})`
     - Else → `updateUser({phone})` (new phone)
   - Better error messages on rate-limit / already-registered

### Phase 2 — Routing consolidation
1. Delete the redundant `onAuthStateChange` in sign-in.tsx (BUG-4) — let AuthContext + RootLayoutNav own routing
2. Delete the duplicate Apple handlers — funnel through `useAuth().appleSignIn()`
3. Make profile state explicitly `undefined`-initial so the wait branch (BUG-10) actually fires

### Phase 3 — State machine
1. Define a single auth-state enum: `LOADING | UNAUTH | AUTH_INCOMPLETE | AUTH_DEALER_INCOMPLETE | AUTH_USER | AUTH_DEALER`
2. Compute it once in AuthContext from primitive flags
3. Routing effects react to enum changes only — no flag-by-flag combinations

### Phase 4 — Phone flow hardening
1. Add server-side cleanup: cron job clears `auth.users.phone` for users with `phone_confirmed_at IS NULL AND phone_change_sent_at < now() - 24h`
2. Store phone in canonical E.164 format everywhere (enforce in DB trigger)
3. Replace the "1-hour hijack heuristic" with explicit `signup_completed` enforcement

### Phase 5 — Test coverage
Currently zero tests. At minimum:
- Cold-start auth state machine (each flag combo)
- Phone OTP send/resend/verify happy paths and error paths
- OAuth (Google/Apple) new + returning user paths
- Dealer route preservation across cold-start race

---

## 6. The bug being fixed in this commit

**Symptom:** User signs in via Google → session expires → re-signs in → goes to /complete-profile → enters phone they previously verified → no OTP arrives. Sign out + sign in fixes it.

**User affected:** `433fba74-0869-4cf1-94f7-2b0cf6279d86`
- `auth.users.phone = "96170559916"`
- `user_metadata.phone_verified = false` (phone was set but not confirmed, OR flag is stale)
- `user_metadata.phone_prompt_completed = true`

**Root cause:** `supabase.auth.updateUser({phone: P})` when `auth.users.phone === P` already (regardless of confirmation state) is a no-op or a session-scoped rate-limited resend. Sign-out invalidates the session-scoped pending challenge; new session gets a fresh OTP slot.

Plus a normalization bug: `user.phone` compared strict-equal to `+${callingCode}${number}` — fails when `user.phone` is stored without the `+`.

**Fix:** Replaced in `complete-profile.tsx::handleSendOtp` and `PhoneVerificationBottomSheet.tsx::handleSendCode` / `handleResend`:
- Normalize both sides to digits-only for comparison
- If `phone_confirmed_at` set AND digits match → skip OTP, treat as already verified
- If digits match but unconfirmed → use `supabase.auth.resend({type:'phone_change', phone})` to bypass the "phone unchanged" branch in gotrue
- Else → `updateUser({phone})` (new phone — original behaviour)
