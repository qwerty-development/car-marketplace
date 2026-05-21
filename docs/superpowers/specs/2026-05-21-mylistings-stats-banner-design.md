# MyListings Stats Banner — Design Spec

**Date:** 2026-05-21  
**Scope:** `app/(home)/(user)/(tabs)/MyListings.tsx` — vehicle `ListingCard` only

## Problem

Views and likes are currently shown as tiny pill badges overlaid on the car photo (top-right corner). They compete visually with the status badge and are easy to miss. For a seller, engagement metrics are the most important signal — they want to know at a glance how much interest their listing is generating.

## Solution

Add a dedicated **Stats Banner** section to the vehicle `ListingCard`, positioned between the image block and the spec row. Remove the existing overlay pills.

## Visual Design

```
┌──────────────────────────────────┐
│  [car photo]                     │
│  ● Available          [overlay]  │
│  BMW 3 Series  $28,000           │
├──────────────────────────────────┤
│   1,247          │      89       │  ← Stats Banner (orange tint)
│   👁 Views       │   ♥ Likes    │
├──────────────────────────────────┤
│  📅 2021 │ ⚡ 42K │ ⚙️ Auto │ 🚗 Used  │  ← Specs (unchanged)
└──────────────────────────────────┘
```

## Implementation Details

### Remove
- The two small view/like pill badges currently rendered in the image overlay (`bg-black/60` pills with `FontAwesome` eye/heart icons at ~12px).

### Add — `StatsBar` inline section
Rendered between the image `<View>` and the specs `<View className='px-5 py-4'>`.

```
Background:  rgba(213, 80, 4, 0.12)
Top border:  rgba(213, 80, 4, 0.25), 1px
Layout:      flex-row, two equal columns, centered
Divider:     1px vertical, rgba(255,255,255,0.08)

Number text: #D55004, fontSize 26, fontWeight 800
Label text:  #888888, fontSize 11, fontWeight 500
Icon:        FontAwesome 'eye' / 'heart', color #D55004, size 14 (inline before label)
Padding:     14px vertical, 20px horizontal
```

### Specs row
No changes. Full-size `SpecItem` components (Year, KM, Transmission, Condition) stay as-is.

### Plate cards (`PlateListingCard`)
No changes. `PlateListing` has no `views`/`likes` fields.

## Files Changed

- `app/(home)/(user)/(tabs)/MyListings.tsx` — modify `ListingCard` only

## Out of Scope

- Dealer listings views (separate screen)
- Plate listing cards
- Any animation or trend indicators on the stats
- Sort-by-engagement feature
