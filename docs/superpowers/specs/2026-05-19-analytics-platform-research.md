# Fleet Analytics Platform Research — May 2026

## The Core Problem

Right now, every time the client asks "can we track X?", the answer is:

1. Write a new SQL migration (new table or column)
2. Write a new RPC function in Supabase
3. Instrument the app with new tracking calls
4. Hope nothing breaks

This is slow, error-prone, and completely unnecessary. The industry solved this 10 years ago with **event-based analytics platforms**.

## The Mental Model Shift

Instead of the current approach:
```
Client request → new migration → new RPC → new column → new code → new bug
```

With an analytics platform:
```
Client request → add one analytics.track() call → done (platform handles storage, dashboards, funnels)
```

You call something like:
```typescript
analytics.track('car_viewed', {
  car_id: '123',
  make: 'BMW',
  price: 45000,
  user_type: 'dealer',
})
```

And the platform automatically gives you: counts, trends over time, funnels, user paths, retention, cohorts — without touching your database schema ever again.

---

## Current State of Fleet Analytics

What's already tracked manually:

| What | How | Problem |
|------|-----|---------|
| App opens, sign-ins, registrations | Meta/Facebook SDK (`react-native-fbsdk-next`) | Ad-focused only, no product analytics |
| Car view counts | `views` column + `viewed_users` array on `cars` table | Rigid, no time dimension |
| Banner impressions/clicks | Custom `banner_analytics` table + RPC | Works but requires migrations for every new banner type |
| Signup platform + app version | Columns on `users` table | One-off columns, no queryable event history |

**None of this gives you**: active users over time, retention, funnels, user paths, session analysis, or any of the things the client actually wants.

---

## Cross-Platform Requirement (Expo + Next.js)

Fleet runs on both mobile (Expo/React Native) and web (Next.js). The analytics platform must:

1. Have an **official SDK for both** — no workarounds
2. Use a **single project/dashboard** — web and mobile events in the same place
3. Support **cross-platform user identity** — when the same user browses on web then opens the app, their journey is one unified timeline, not two separate users

### How cross-platform identity works

Every platform uses the same concept: you call `identify(userId)` on both SDKs with the same ID. The platform merges the sessions into one user profile. You can then see:

```
User #abc123 journey:
  [Web]    Browsed 3 BMW listings → Clicked "Download App"
  [Mobile] Opened app → Signed up → Favorited 2 cars → Sent message to dealer
```

### SDK availability matrix

| Platform | Next.js SDK | React Native SDK | Same project key |
|----------|------------|------------------|-----------------|
| **PostHog** | ✅ `@posthog/next` (App Router native) | ✅ `posthog-react-native` | ✅ Yes |
| **Mixpanel** | ✅ `mixpanel-browser` + Next.js docs | ✅ `mixpanel-react-native` | ✅ Yes |
| **Amplitude** | ✅ `@amplitude/analytics-browser` | ✅ `@amplitude/analytics-react-native` | ✅ Yes |
| **OpenPanel** | ✅ `@openpanel/nextjs` | ✅ `@openpanel/react-native` | ✅ Yes |
| **Firebase** | ⚠️ Firebase JS SDK (limited web analytics) | ✅ `@react-native-firebase/analytics` | ⚠️ Separate products |

**Firebase is a problem here:** Firebase Analytics for web and Firebase Analytics for mobile are technically the same product but the JS SDK doesn't support the same analytics API as the native SDK. Web analytics in Firebase is a different surface (Google Analytics 4), which means your web and mobile dashboards are in different places. Not ideal.

### Winner for Expo + Next.js: **PostHog**

PostHog's `@posthog/next` package is purpose-built for Next.js App Router — it handles React Server Components, client components, and middleware correctly out of the box. The React Native SDK works with Expo SDK 54. Both use the same project API key, so all events — from web and mobile — land in the same PostHog dashboard with unified user profiles.

---

## The Options

---

### OPTION A — Firebase Analytics (Google Analytics for Firebase)

**Cost: 100% Free forever**

**What it is:** Google's official mobile analytics platform. The industry standard for free mobile analytics. Already in the project (`google-services.json` exists).

**React Native SDK:** `@react-native-firebase/analytics` — mature, battle-tested, official Google support.

**What you get out of the box (zero code):**
- Daily/weekly/monthly active users (DAU/WAU/MAU)
- Session counts and duration
- App open events
- First open tracking
- Device/OS/country breakdown
- Crash-free users (with Crashlytics)
- Screen views (auto-tracked with Expo Router integration)

**What you track with one line of code:**
```typescript
import analytics from '@react-native-firebase/analytics';

// Sign-in
analytics().logSignIn({ method: 'email' });

// Car viewed
analytics().logEvent('car_viewed', { car_id: '123', make: 'BMW', price: 45000 });

// Search performed
analytics().logSearch({ search_term: 'BMW X5 Lebanon' });

// Listing created
analytics().logEvent('listing_created', { car_type: 'sale', price: 45000 });

// Favorite added
analytics().logEvent('car_favorited', { car_id: '123' });
```

**Dashboard:** Firebase Console → Google Analytics dashboard. Shows funnels, user counts, event counts, audience segments.

**Limitations:**
- Requires a development build (not Expo Go) — you're already doing this via EAS
- Dashboard is "good enough" but not as powerful as Mixpanel/Amplitude for deep analysis
- 72-hour data delay on some reports
- To do complex SQL queries you need to export to BigQuery (free tier: 1TB queries/month)
- No session replay, no feature flags

**Effort to integrate:** 2–4 hours. The `google-services.json` is already in the project, so half the setup is done.

**Verdict:** Best bang for zero dollars. If budget is zero, this is the answer. Covers 90% of what any client will ever ask for.

---

### OPTION B — PostHog

**Cost: Free up to 1M events/month (cloud) | Free forever (self-hosted)**

**What it is:** Full-stack product analytics platform. Open source. Used by Airbus, Hasura, Y Combinator portfolio companies. The most complete free offering in the market.

**React Native SDK:** `posthog-react-native` — official, actively maintained.

**What you get:**
- Events, funnels, retention, cohorts, user paths
- Session replay (watch real user sessions, see exactly what they tap)
- Feature flags (roll out features to % of users)
- A/B testing
- User profiles (see individual user's full event history)
- Real-time event stream
- SQL-level data access (HogQL)
- Dashboard builder
- Alerts and anomaly detection

**Dashboard quality:** Excellent. The client can have their own login and explore data themselves.

**Cloud pricing:**
| Volume | Monthly Cost |
|--------|-------------|
| 0–1M events | Free |
| 1M–2M | ~$0 (still included in free tier) |
| 10M events | ~$324/month |

For Fleet Lebanon, 1M events/month is likely more than enough for years.

**Self-hosted pricing:** Free forever. You run it on a VPS ($10–20/month on Hetzner or DigitalOcean). PostHog provides a Docker Compose setup that takes ~30 minutes.

**Integration example:**
```typescript
import PostHog from 'posthog-react-native';

const posthog = new PostHog('YOUR_API_KEY', {
  host: 'https://app.posthog.com', // or your self-hosted URL
});

// Identify user on login
posthog.identify(userId, {
  email: user.email,
  role: user.role, // 'user' | 'dealer'
  signup_platform: user.signup_platform,
});

// Track any event
posthog.capture('car_viewed', {
  car_id: '123',
  make: 'BMW',
  price: 45000,
  dealer_id: 'abc',
});

// Track screens automatically
posthog.screen('CarListingPage', { filter: 'BMW' });
```

**Effort to integrate:** 4–8 hours for full instrumentation.

**Verdict:** Best overall option. Free tier is generous, feature set is unmatched at any price point, open source means no vendor lock-in. This is what I'd recommend if you want one platform to replace everything.

---

### OPTION C — OpenPanel

**Cost: $2.50/month (cloud) | Free forever (self-hosted)**

**What it is:** Open-source Mixpanel alternative. Newer (2023) but actively maintained. Combines Mixpanel's power with Plausible's simplicity.

**React Native SDK:** Official SDK with automatic offline event queuing.

**What you get:**
- Events, funnels, retention, cohorts, user profiles
- Clean, modern dashboard
- First-party SDK (events are queued offline and sent when online — good for Lebanon connectivity issues)
- Full self-hosting support

**Cloud pricing:** $2.50/month for small apps. Scales with usage.

**Self-hosted:** Free forever on your own VPS.

**Integration example:**
```typescript
import { OpenPanel } from '@openpanel/react-native';

const op = new OpenPanel({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
});

op.identify({ profileId: userId, email, role });
op.track('car_viewed', { car_id: '123', make: 'BMW' });
op.screenView('CarListing');
```

**Limitations:**
- Younger project than PostHog (less battle-tested)
- Smaller community
- Fewer integrations

**Effort to integrate:** 3–6 hours.

**Verdict:** Great budget option, especially self-hosted. If you want something simpler than PostHog with a cleaner UI, this is it. The $2.50/month cloud option is essentially free.

---

### OPTION D — Aptabase

**Cost: Free tier (10K events/day) | Paid plans start ~$9/month | Self-hostable**

**What it is:** Purpose-built mobile/desktop app analytics. Privacy-first, no user IDs, GDPR-compliant out of the box. Open source (AGPLv3).

**React Native SDK:** `@aptabase/react-native` — lightweight, simple.

**What you get:**
- Event counts, trends
- App sessions, DAU/MAU
- OS/device/country breakdown
- Simple clean dashboard

**What you DON'T get:**
- Full funnels
- Session replay
- User-level tracking (by design — privacy-first means no individual user profiles)
- Cohort analysis

**Verdict:** Too simple for what Fleet needs. Good for indie apps that just want basic metrics. Skip this one.

---

### OPTION E — Mixpanel

**Cost: Free up to 1M events/month | $0.00028/event beyond that**

**What it is:** The gold standard of product analytics. Used by Uber, Airbnb, Twitter. Best-in-class funnel analysis and user path visualization.

**React Native SDK:** `mixpanel-react-native` — wraps native iOS/Android SDKs. Rock solid.

**What you get:**
- Everything PostHog offers, plus more mature tooling
- Best funnel visualization in the industry
- User path analysis (see what users do before converting/churning)
- Cohort analysis
- Session replay (paid add-on)
- Notifications (paid)

**Pricing reality:**
| Events/month | Monthly Cost |
|-------------|-------------|
| 0–1M | Free |
| 5M | ~$1,120 |
| 10M | ~$2,520 |

The free tier is fine for Fleet. But if you ever exceed 1M events (which happens as the app grows), the jump is very expensive.

**Verdict:** Best dashboard quality, client will love it. But the pricing cliff at 1M events is a risk. PostHog has a much better pricing curve at scale.

---

### OPTION F — Amplitude

**Cost: Free (Starter) | $49/month (Plus) | Custom (Growth)**

**What it is:** PostHog/Mixpanel competitor, strong focus on behavioral analytics and "digital optimization."

**React Native SDK:** Official `@amplitude/analytics-react-native`.

**What you get:**
- Events, funnels, retention, cohorts
- User journeys
- A/B testing (Experiment, paid add-on)
- Session replay (paid add-on)

**Free tier:** Generous for small apps but limited features. Advanced features (A/B testing, session replay, behavioral cohorts) are paywalled.

**Verdict:** Good but the feature gating is frustrating. PostHog gives you more for free. Unless the client is already on Amplitude, use PostHog or Mixpanel instead.

---

### OPTION G — Segment (CDP)

**Cost: Free up to 1,000 MTUs/month | $120+/month**

**What it is:** Not an analytics tool. It's a **data router** (Customer Data Platform). You write events once, Segment sends them everywhere — Firebase, Mixpanel, PostHog, Supabase, Slack, anything.

**Why this is interesting:** You instrument the app once with `analytics.track()`. Then in the Segment dashboard, you point the data at Firebase AND PostHog AND Mixpanel. You can switch analytics tools without touching app code.

**Why it's NOT the right choice here:**
- 1,000 MTU free limit is tiny (one MTU = one user who sent at least one event per month)
- $120/month for 10,000 users is expensive just for routing
- Adds complexity and a third-party middleman
- The power features (identity resolution, audiences) require the Enterprise plan

**Verdict:** Great for large enterprises with 10+ analytics destinations. Overkill for Fleet. Skip it.

---

## Client Dashboard Requirements

The client specifically wants:
- **Active users graph** — DAU/WAU/MAU over time
- **Signups graph** — new registrations per day/week/month
- **Custom time ranges** — pick any start/end date, not just presets
- **Multiple graphs on one screen** — a dashboard with several metrics side by side

This requirement **eliminates Firebase Analytics** from the top picks. Firebase's dashboard has limited time range controls, you can't build a custom multi-graph dashboard, and the UI is designed for developers — not clients who want to explore data.

### Dashboard Quality Ranking (for this requirement)

| Platform | Custom Time Range | Multiple Graphs | Client-Friendly | Score |
|----------|------------------|-----------------|-----------------|-------|
| **Mixpanel** | ✅ Anywhere | ✅ Full dashboards | ✅ Best in class | ⭐⭐⭐⭐⭐ |
| **PostHog** | ✅ Anywhere | ✅ Full dashboards | ✅ Very good | ⭐⭐⭐⭐⭐ |
| **Amplitude** | ✅ Anywhere | ✅ Full dashboards | ✅ Good | ⭐⭐⭐⭐ |
| **OpenPanel** | ✅ Preset + custom | ✅ Limited | Decent | ⭐⭐⭐ |
| **Firebase** | ⚠️ Limited presets | ❌ Fixed layout | ❌ Developer-only | ⭐⭐ |

Both **Mixpanel** and **PostHog** let you build a pinned dashboard that looks exactly like:

```
┌─────────────────────────┐  ┌─────────────────────────┐
│  Active Users           │  │  New Signups             │
│  [Last 30 days ▼]       │  │  [Last 30 days ▼]        │
│  📈 Graph               │  │  📊 Graph                │
│  DAU: 412  WAU: 1,840   │  │  Today: 23  This wk: 94 │
└─────────────────────────┘  └─────────────────────────┘
┌─────────────────────────┐  ┌─────────────────────────┐
│  Car Views by Make      │  │  Listings Created        │
│  [Custom: Apr–May ▼]    │  │  [This month ▼]          │
│  BMW 34%  Toyota 28%... │  │  📈 Graph                │
└─────────────────────────┘  └─────────────────────────┘
```

The client can click any graph, change the date range, drill down into individual users — all without asking you.

---

## Head-to-Head Comparison

| | Firebase | PostHog | OpenPanel | Mixpanel | Amplitude |
|---|---|---|---|---|---|
| **Price (small app)** | Free | Free | $2.50/mo | Free | Free |
| **Price (growing)** | Free | Very cheap | Cheap | Expensive | Moderate |
| **Self-hostable** | No | Yes | Yes | No | No |
| **React Native SDK** | ✅ Official | ✅ Official | ✅ Official | ✅ Official | ✅ Official |
| **Active users (DAU/MAU)** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Funnels** | Basic | ✅ Advanced | ✅ | ✅ Best | ✅ |
| **User-level tracking** | Limited | ✅ | ✅ | ✅ | ✅ |
| **Session replay** | ❌ | ✅ (free tier) | ❌ | 💰 Paid add-on | 💰 Paid add-on |
| **Feature flags** | ❌ | ✅ | ❌ | ❌ | 💰 Paid add-on |
| **Retention analysis** | Basic | ✅ | ✅ | ✅ | ✅ |
| **SQL access** | BigQuery | HogQL (built-in) | ❌ | ❌ | ❌ |
| **Open source** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Client dashboard** | Good | Excellent | Good | Excellent | Good |
| **Expo SDK 54 compat.** | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Events to Track for Fleet (Day One List)

No matter which platform you pick, these are the events to instrument. One line of code each, zero schema changes ever:

```
# User lifecycle
user_signed_up       { method, platform, app_version }
user_signed_in       { method, role }
user_signed_out      { role }
guest_session_start  { guest_id }
guest_converted      { guest_id }   # guest who then signs up

# Car browsing
car_viewed           { car_id, make, model, year, price, type: 'sale'|'rent' }
car_favorited        { car_id, make, price }
car_unfavorited      { car_id }
search_performed     { query, filters, results_count }
filter_applied       { filter_type, filter_value }

# Dealer actions
listing_created      { car_id, type: 'sale'|'rent', price }
listing_updated      { car_id, fields_changed }
listing_deleted      { car_id }
listing_boosted      { car_id, credits_spent }
autoclip_created     { clip_id, credits_spent }
export_triggered     { export_type, credits_spent }

# Engagement
message_sent         { car_id, sender_role: 'user'|'dealer' }
chat_ai_used         { prompt_type }
comparison_started   { car_ids }
number_plate_viewed  { plate_id }
deeplink_opened      { target_type, target_id }

# Business events
credit_purchased     { amount, currency }
subscription_renewed { plan, duration }
payment_initiated    { amount, gateway: 'whish' }
payment_completed    { amount, gateway: 'whish' }
payment_failed       { reason }
```

Any future analytics request = just add a new event to this list. No migrations, no RPCs.

---

## My Recommendation

Given the client specifically wants interactive graphs, custom time ranges, and multiple dashboard panels — the recommendation shifts clearly:

### Top Pick: **PostHog Cloud (free tier)**

- **Active users graph:** built-in, configurable to any time range
- **Signups graph:** just track `user_signed_up` event and graph it over any period
- **Custom dashboard:** drag-and-drop panels, each with independent time range controls
- **Client access:** give the client a read-only login — they can explore everything themselves
- 1M events/month free — enough for Fleet for years
- Session replay included (bonus: watch what users do before signing up or churning)
- If you self-host on a $10/month VPS, it's free forever with unlimited events

### Runner-up: **Mixpanel (free tier)**

- Slightly more polished dashboard UI than PostHog
- Client will find it more intuitive to explore
- Free up to 1M events/month
- Risk: pricing jumps very sharply after 1M events ($0.00028/event = ~$2,520/month at 10M)
- No session replay on free tier

### Budget option: **OpenPanel self-hosted**

- Free forever on your own VPS
- Good enough dashboards with custom time ranges
- Not as polished but covers the basics
- Actively developed in 2026

### Eliminated by the client's dashboard requirement: **Firebase Analytics**

- Cannot build a custom multi-graph dashboard
- Time range controls are limited presets (7d, 30d, 60d, 90d)
- UI designed for developers, not clients
- Skip it for this use case

### What to keep from the current setup

- **Meta/Facebook SDK** — keep it. It serves a different purpose (ad attribution, Facebook pixel events). It's not a replacement for product analytics.
- **Banner analytics Supabase tables** — can keep or migrate to analytics platform events. Not urgent.
- **Car view counts** — keep the `views` column for the dealer dashboard (shows "your listing has X views"). The analytics platform gives the global picture; the column gives the per-listing count to dealers.

---

## Integration Complexity

| Platform | Setup Time | Risk |
|----------|-----------|------|
| Firebase Analytics | 2–4 hours | Low (`google-services.json` already in project) |
| PostHog | 4–8 hours | Low (well-documented React Native SDK) |
| OpenPanel | 3–6 hours | Low-Medium (newer SDK, less community answers) |
| Mixpanel | 4–6 hours | Low (mature SDK, lots of React Native examples) |

All of them:
- Work with Expo SDK 54 + bare workflow (no Expo Go required — you're already on dev builds)
- Don't conflict with the existing Meta SDK
- Fire-and-forget event calls that never block the UI

---

## Decision Checklist

Answer these to pick:

1. **Is budget a concern?**
   - No → Mixpanel (best dashboard polish for client) or PostHog (more features free)
   - Yes → PostHog free cloud tier (1M events/month free)
   - Zero budget → PostHog self-hosted on $10/month VPS

2. **Does the client want to log in and explore data themselves?**
   - Yes → Both PostHog and Mixpanel support this. Mixpanel is slightly more intuitive for non-technical users.
   - No, just internal — PostHog cloud is fine.

3. **Worried about vendor lock-in or data leaving Lebanon?**
   - Yes → PostHog self-hosted. You control the server, the data never leaves.
   - No → PostHog cloud or Mixpanel cloud.

4. **Do you want session replay (watch real user sessions)?**
   - PostHog includes it free. Mixpanel charges extra.

5. **Simple recommendation if you just want to decide now:**
   → **PostHog cloud free tier.** Set it up, give the client a read-only login, build a dashboard with active users + signups + car views. Client asks for more? Add one `track()` call. Done.

---

*Research compiled May 2026. Pricing verified from official sources.*
