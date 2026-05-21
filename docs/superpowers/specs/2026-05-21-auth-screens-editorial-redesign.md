# Auth Screens — Editorial Premium Redesign

**Scope:** Welcome, Sign-In, Sign-Up, Forgot-Password
**Out of scope:** terms-of-service, privacy-policy, callback (these are functional, not aesthetic surfaces)
**Goal:** Replace the dated, blob-and-scrolling-wall auth flow with an editorial-premium aesthetic worthy of a real car marketplace. Preserve every line of business logic verbatim.

## Why redesign

The current screens read as a 2018 mobile template:

- `index.tsx` (welcome) — scrolling car wall + giant centered logo + 3 equal-weight stacked CTAs. Logo placement is off-center (`top: height/3 - 80, left: width/2 - 150`), no real type hierarchy, "Your journey begins here" tagline is generic.
- `sign-in.tsx` and `sign-up.tsx` — animated translucent orange blobs as decoration, pillow-rounded filled inputs, "Welcome Back! 👋" with emoji, OAuth icons at the bottom afterthought.
- `forgot-password.tsx` — uses `#FF3B30`/`#FF9500` red→orange gradient that is **not the brand color**, plus animated particles, animated grid lines, and an animated pulse — three layers of decoration competing for attention.

The signals together read as AI-template slop: floating shapes, emoji greetings, gradient buttons, no typographic voice, no editorial restraint.

A car marketplace named "Fleet" with hero-grade photography in the asset library deserves the visual confidence of a Porsche/Aston-Martin digital experience.

## Aesthetic direction

**Editorial premium.** Inspirations: Porsche Configurator, Aston Martin's online configurator, Linear's signup, On Running's homepage.

Principles:
- Typography hierarchy carries the screen, imagery supports it
- Brand color `#D55004` is an **accent** (CTA fills, focus rings, link emphasis) — never a background wash
- Generous whitespace, large display type, system font with weight + tracking discipline
- One stunning hero photo (full-bleed top) with a cinematic gradient mask handing off to the content panel
- Subtle motion budget — entry transitions, ken-burns on hero, focus ring crossfade, haptic on button press. No always-on decoration.

## Typography system

Using system font (SF Pro on iOS, Roboto on Android) with weight + letter-spacing discipline. No new font files.

```
Display        44/52   weight 700  tracking -1.2   welcome headline
Title          28/34   weight 600  tracking -0.4   sign-in/up/forgot titles
Subtitle       17/24   weight 400  tracking  0     sub-line under titles
Body           16/24   weight 400  tracking  0     paragraph text
Label          13/16   weight 500  tracking +0.6   UPPERCASE — input labels, dividers
Button         16/20   weight 600  tracking  0     button text
Caption        12/16   weight 400  tracking  0     legal text
Mono           11/14   weight 500  tracking +0.4   version badge (system mono)
```

## Color tokens

```
                        Light                Dark
bg                      #FFFFFF              #0A0A0A
bg-elevated             #FAFAFA              #141414        surface for cards / segmented bg
border                  #E5E5E5              #232323        1px hairlines
border-strong           #CFCFCF              #353535        on focus / dividers
text-primary            #0A0A0A              #F5F5F5
text-secondary          #525252              #A1A1A1
text-tertiary           #8A8A8A              #6B6B6B
accent                  #D55004              #D55004        kept — brand
accent-pressed          #B84403              #E45F12
accent-soft             rgba(213,80,4,.08)   rgba(213,80,4,.14)   for focus rings, soft chips
error                   #DC2626              #EF4444
success                 #15803D              #22C55E
```

## Component library

All under `app/(auth)/_components/` (underscore prefix = route-local, won't accidentally be reused elsewhere).

### `tokens.ts`
Exports the colors above as `getColors(isDark: boolean)`, plus `spacing` (4, 8, 12, 16, 20, 24, 32, 40, 56, 80) and `type` (style objects matching the typography table).

### `Display.tsx`
Typography primitives: `<Display>`, `<Title>`, `<Subtitle>`, `<Body>`, `<Label>`, `<Caption>`, `<Mono>`. Each takes `children` and optional `color` / `muted` / `align`. Wraps `Text` with the right style — keeps text usage clean.

### `AuthScaffold.tsx`
Shared screen container — handles SafeArea, KeyboardAvoidingView (iOS padding / Android nothing), optional back button, brand wordmark in top-left, version badge in top-right.

Props: `showBack?: boolean`, `onBack?: () => void`, `children`.

### `HeroBackdrop.tsx`
Welcome-screen only. Renders a slideshow of 3 hero car photos with:
- Ken-burns scale (1.00 → 1.04 over 18s, then reverses), via Animated value
- Cross-fade between photos every 8s (600ms transition)
- Vertical LinearGradient mask at the bottom (transparent → bg color over the lower 25% of the hero)

The 3 hero photos: `car5.jpg` (Porsche Panamera in motion), `car8.jpg` (BMW M4 dusk), `car12.jpg` (Audi RS7 mountains). All three have clear focal subjects and dark/neutral skies suitable for masking.

### `AuthInput.tsx`
Underline-style input with floating label.

Behavior:
- Resting: label sits inside the input as placeholder text (Body 16, tertiary color)
- Focused or filled: label floats to a tiny `Label` (uppercase 13, accent color) above the input
- Bottom border: 1px `border` color resting → 1.5px `accent` when focused (animated, 180ms)
- Error state: bottom border + label color → error color, error text appears below (12pt)
- Right slot: optional eye-toggle (for password), country chip (for phone), check status icon

Props: `label`, `value`, `onChangeText`, `error?`, `secureTextEntry?`, `rightSlot?`, `keyboardType?`, etc.

### `AuthButton.tsx`
Three variants:
- `primary`: filled `accent` background, white text, 52px height, rounded 999 (pill), right-arrow icon. Press: scale 0.98 + `Haptics.impactAsync(Light)`. Loading: ActivityIndicator white.
- `secondary`: transparent bg, 1.5px `border-strong` border, primary text color. Same height/radius. Light haptic on press.
- `ghost`: text-only, accent color on press. No padding/border.

Props: `variant`, `title`, `onPress`, `loading?`, `disabled?`, `icon?`.

### `SegmentedToggle.tsx`
Editorial segmented control — line-style, NOT pill-style. Two labels (e.g. "Phone" / "Email"). Active = primary text color + 2px `accent` underline beneath, inactive = secondary text color. Animated underline slides on selection.

Props: `value: 'phone' | 'email'`, `onChange: (v) => void`, `options: { value, label }[]`.

### `OAuthRow.tsx`
Two outlined 56×56 chip buttons (Apple + Google) in a row, centered, gap 16. Uses the native Apple Authentication button on iOS where available, custom outlined button otherwise. Loading state shows ActivityIndicator inside the chip.

Props: `onApple?`, `onGoogle?`, `appleLoading?`, `googleLoading?`, `appleAvailable?`, `mode: 'sign_in' | 'sign_up'`.

### `OtpInput.tsx`
6-digit code input — six boxed cells, each 48×56, 1px border, rounded 8. Focused cell: 1.5px accent border. Auto-advances to next cell on entry. Backspace moves to previous. Paste fills all six.

Props: `value`, `onChange`, `onComplete?`, `error?`.

### `AuthDivider.tsx`
Horizontal line with centered uppercase `Label` text (e.g. "OR CONTINUE WITH"). 1px `border` color line.

## Screen layouts

### Welcome (`app/(auth)/index.tsx`)

```
SafeArea (no scroll — fixed layout)
├── Top header bar (h 56)
│   ├── Brand wordmark "FLEET" (Display weight, 20pt, tracking +2)
│   └── Version "v 1.0.0" (Mono, text-tertiary)
├── Hero (height = 55% of screen)
│   ├── HeroBackdrop (3-image ken-burns + cross-fade)
│   └── Gradient mask (transparent → bg, lower 30%)
├── Content panel (flex 1, padding 24 horizontal)
│   ├── Display headline "Drive what\nmoves you."
│   ├── Body subtitle (text-secondary, max 2 lines):
│   │     "Buy, sell, and explore Lebanon's most trusted car marketplace."
│   ├── Spacer 32
│   ├── AuthButton primary "Sign In" with arrow
│   ├── AuthButton secondary "Create Account"
│   └── AuthButton ghost "Continue as guest" (centered, no arrow)
└── Footer (padding bottom safe-area + 16)
    └── Caption "By continuing you agree to our Terms and Privacy Policy"
        (links are accent color, underlined on press)
```

Motion budget on mount:
- Wordmark + version fade-in (0–400ms)
- Hero crossfade starts at 0ms, ken-burns starts at 0ms
- Headline + subtitle slide-up + fade (300–700ms, easing.out cubic)
- Buttons stagger fade-up (400ms each, 80ms apart)
- Footer fade-in (700–900ms)

### Sign-In (`app/(auth)/sign-in.tsx`)

```
SafeArea + KeyboardAvoidingView
├── Header (h 56)
│   ├── Back arrow (left)
│   └── Wordmark "FLEET" (center)
├── ScrollView content (padding 24)
│   ├── Title "Welcome back."
│   ├── Subtitle "Sign in to continue."
│   ├── Spacer 32
│   ├── (Pre-OTP state)
│   │   ├── SegmentedToggle Phone | Email
│   │   ├── Spacer 28
│   │   ├── (if 'phone') AuthInput "PHONE NUMBER" with country chip rightSlot
│   │   ├── (if 'email') AuthInput "EMAIL ADDRESS" + AuthInput "PASSWORD" with eye toggle
│   │   ├── Error text (if any)
│   │   ├── AuthButton primary "Send code" / "Sign in" with arrow
│   │   ├── (if 'email') Ghost link "Forgot password?" (right-aligned, below button)
│   │   ├── AuthDivider "OR CONTINUE WITH"
│   │   └── OAuthRow mode="sign_in"
│   └── (Post-OTP state, only for phone)
│       ├── Body "We sent a 6-digit code to +961 70 123 456."
│       ├── OtpInput 6-digit boxed
│       ├── AuthButton primary "Verify"
│       └── Ghost link "Change phone number"
├── Footer (sticky bottom)
│   ├── Inline link "Don't have an account?  Create one →"
│   └── Ghost "Continue as guest" (smaller, below)
```

### Sign-Up (`app/(auth)/sign-up.tsx`)

Same skeleton as Sign-In, with:
- Title "Create your account."
- Subtitle "It only takes a minute."
- Additional `AuthInput "FULL NAME"` above the phone/email input
- Email mode also includes the password input
- Footer link reversed: "Already have an account?  Sign in →"
- OTP / email-verification states use same `OtpInput` component

### Forgot-Password (`app/(auth)/forgot-password.tsx`)

```
SafeArea + KeyboardAvoidingView
├── Header (back arrow, wordmark)
├── Content
│   ├── Title (stage='request') "Forgot password?"
│   │       (stage='reset')   "Set a new password."
│   ├── Subtitle (request) "Enter your email — we'll send a verification code."
│   │           (reset) "Enter the code we sent to {email} and choose a new password."
│   ├── (stage='request')
│   │   ├── AuthInput "EMAIL ADDRESS"
│   │   └── AuthButton primary "Send code"
│   └── (stage='reset')
│       ├── OtpInput (6-digit code)
│       ├── AuthInput "NEW PASSWORD" (with eye toggle)
│       ├── AuthInput "CONFIRM PASSWORD"
│       ├── AuthButton primary "Reset password"
│       └── Ghost "Back to email" (← arrow)
```

Stage transition uses a 200ms fade-out / fade-in scale animation (same shape as the current implementation, preserved).

## What stays untouched

All business logic is preserved verbatim — the redesign only touches presentation:

1. **Welcome (`index.tsx`)**
   - `useGuestUser().setGuestMode(true)` → `router.replace('/(home)')` flow
   - Loading state with `ActivityIndicator` color `#D55004`

2. **Sign-In**
   - Email/password flow via `supabase.auth.signInWithPassword`
   - Phone OTP flow via `signInWithOtp` + `verifyOtp`
   - Apple Sign-In + push-token registration block (`SecureStore`, `Notifications.getExpoPushTokenAsync`, `user_push_tokens` upsert) — copied verbatim
   - Google OAuth via `googleSignIn()` from `useAuth`
   - `onAuthStateChange` listener that fires `safeLogEvent(META_EVENTS.SIGN_IN, ...)` and navigates
   - Account-age check + `signup_completed` stamp + complete-profile redirect for OTP edge cases
   - Guest mode handler
   - Forgot-password navigation
   - All error messages (PGRST116 guarding, "no account found", etc.)

3. **Sign-Up**
   - Phone OTP flow with `shouldCreateUser: true` and `updateUser({ signup_completed: true })`
   - Email signup via `useAuth().signUp({ email, password, name })`
   - Email verification via `useAuth().verifyOtp(email, code)`
   - OAuth + push-token block (Apple Sign-Up path)
   - `waitForSession` polling helper
   - Meta events: `COMPLETE_REGISTRATION` with `fb_registration_method` for each provider
   - Name validation (`/\d/.test(name)`)
   - All error messages

4. **Forgot-Password**
   - `useAuth().resetPassword(emailAddress)` for request stage
   - `supabase.auth.verifyOtp` with `type: 'recovery'` + `updateUser({ password })` for reset stage
   - Alert dialogs (preserved as-is since they are part of the trust UX — but I'll see if any can be replaced with inline error text per editorial style)

5. **Auth layout (`_layout.tsx`)** — completely untouched. Its routing-gate logic (`isLoaded`, `isSignedIn`, `isGuest`) and branded spinner are preserved.

## Implementation order

1. **Tokens + typography primitives** (`tokens.ts`, `Display.tsx`). Cheap, foundational.
2. **AuthButton + AuthInput + AuthDivider** — workhorses, used everywhere.
3. **SegmentedToggle + OtpInput + OAuthRow** — specialized.
4. **AuthScaffold + HeroBackdrop** — page-shell pieces.
5. **Rewrite `index.tsx` (welcome)** — uses HeroBackdrop, AuthScaffold, AuthButton, Display.
6. **Rewrite `sign-in.tsx`** — wire the existing handler functions to the new components.
7. **Rewrite `sign-up.tsx`** — same.
8. **Rewrite `forgot-password.tsx`** — same. Drop the particle/grid/pulse decoration; fix the non-brand red gradient.
9. **TypeScript typecheck (`npx tsc --noEmit`) on each rewritten file.**
10. **Manual flow check** in the dev server — golden paths for each auth method.

## Verification plan

- `npx tsc --noEmit` clean for the new/modified files
- Boot `npm start`, manually navigate: Welcome → Sign In (phone + email) → OTP → home; Welcome → Create Account → Sign Up (phone + email) → OTP → home; Welcome → Sign In → Forgot Password → request → reset; Welcome → Continue as guest
- Apple Sign-In + Google Sign-In smoke check (won't actually log in, just verify the buttons trigger the handlers without exception)
- Light mode + Dark mode toggle on each screen
- RTL check: `direction: 'ltr'` is explicitly forced on these screens by the existing code (auth screens are LTR even in Arabic-locale users) — I will preserve that

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Subtle Supabase auth-flow regression | Copy the handler functions byte-for-byte. Do not refactor them. |
| Apple push-token block (50+ lines) lost in the rewrite | Extract it to a tiny helper `registerPushTokenForUser(userId)` inside `app/(auth)/_lib/pushToken.ts`. Sign-in and sign-up both call the same helper. Behavior is identical. |
| `useTheme()` vs `useColorScheme()` inconsistency between files | Use `useTheme()` from `@/utils/ThemeContext` throughout the new files (matches forgot-password and the rest of the app). |
| KeyboardAvoidingView regression on Android | Use `Platform.OS === 'ios' ? 'padding' : undefined` (matches existing forgot-password pattern). Test scroll behavior with keyboard open. |
| New components break existing imports elsewhere | All new files live in `app/(auth)/_components/` — leading underscore = route-local, Expo Router will not treat them as routes. No other file imports them. |

## Out of scope

- `terms-of-service.tsx`, `privacy-policy.tsx` — text-only legal documents
- `callback.tsx` — OAuth callback handler with no UI to speak of
- i18n keys — page strings are currently hardcoded English; adding translation would be a separate change
- Updating `(auth)/_layout.tsx` — its loading spinner already uses the brand color and is acceptable

## File inventory

**New files (11):**
- `app/(auth)/_components/tokens.ts`
- `app/(auth)/_components/Display.tsx`
- `app/(auth)/_components/AuthScaffold.tsx`
- `app/(auth)/_components/HeroBackdrop.tsx`
- `app/(auth)/_components/AuthInput.tsx`
- `app/(auth)/_components/AuthButton.tsx`
- `app/(auth)/_components/SegmentedToggle.tsx`
- `app/(auth)/_components/OAuthRow.tsx`
- `app/(auth)/_components/OtpInput.tsx`
- `app/(auth)/_components/AuthDivider.tsx`
- `app/(auth)/_lib/pushToken.ts`

**Rewritten files (4):**
- `app/(auth)/index.tsx`
- `app/(auth)/sign-in.tsx`
- `app/(auth)/sign-up.tsx`
- `app/(auth)/forgot-password.tsx`

**Untouched (intentional):**
- `app/(auth)/_layout.tsx`
- `app/(auth)/callback.tsx`
- `app/(auth)/privacy-policy.tsx`
- `app/(auth)/terms-of-service.tsx`
