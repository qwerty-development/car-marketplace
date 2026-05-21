# MyListings Stats Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tiny view/like overlay pills on vehicle listing cards in MyListings with a prominent Stats Banner section that shows views and likes as large, brand-colored numbers between the car photo and the spec row.

**Architecture:** Single-file change inside `MyListings.tsx`. Remove the two small `bg-black/60` pill badges from the image overlay, then insert an inline `StatsBar` View between the image block and the existing specs row inside `ListingCard`. No new files, no new components, no new data fetching — `views` and `likes` are already on the `CarListing` type and fetched.

**Tech Stack:** React Native, NativeWind (className), expo-vector-icons (FontAwesome), existing `CarListing` type

---

## File Map

| File | Change |
|------|--------|
| `app/(home)/(user)/(tabs)/MyListings.tsx` | Remove overlay pills (lines ~506–520), add StatsBar between image and specs |

---

### Task 1: Remove the existing overlay view/like pills

**Files:**
- Modify: `app/(home)/(user)/(tabs)/MyListings.tsx` (inside `ListingCard`, image overlay section ~lines 506–520)

- [ ] **Step 1: Locate and delete the pills block**

In `ListingCard`, find this block inside the `<View className='absolute top-4 w-full px-4 flex-row justify-between items-center'>` — it is the right-side pills group:

```tsx
<View className='flex-row space-x-2'>
    <View className='flex-row items-center bg-black/60 backdrop-blur-lg rounded-full px-3 py-1.5'>
        <FontAwesome name='eye' size={12} color='#FFFFFF' />
        <Text className='text-white text-xs font-medium ml-1.5'>
            {item.views || 0}
        </Text>
    </View>

    <View className='flex-row items-center bg-black/60 backdrop-blur-lg rounded-full px-3 py-1.5'>
        <FontAwesome name='heart' size={12} color='#FFFFFF' />
        <Text className='text-white text-xs font-medium ml-1.5'>
            {item.likes || 0}
        </Text>
    </View>
</View>
```

Delete this entire block. The overlay row now only contains the status badge on the left — leave the outer `<View className='absolute top-4 w-full px-4 flex-row justify-between items-center'>` and the status badge intact.

After deletion the overlay section looks like:

```tsx
<View className='absolute top-4 w-full px-4 flex-row justify-between items-center'>
    <View className='flex-row items-center'>
        <View
            style={{ backgroundColor: statusConfig.color }}
            className='rounded-full px-3 py-1.5 mr-2 flex-row items-center'>
            <View
                style={{ backgroundColor: statusConfig.dotColor }}
                className='w-2 h-2 rounded-full mr-2 animate-pulse'
            />
            <Text className='text-white text-xs font-bold uppercase tracking-wider'>
                {item.status}
            </Text>
        </View>
    </View>
</View>
```

- [ ] **Step 2: Verify type-check still passes**

```bash
npx tsc --noEmit app/(home)/\(user\)/\(tabs\)/MyListings.tsx 2>&1 | head -30
```

Expected: no new errors introduced (pre-existing ~780 errors are acceptable).

- [ ] **Step 3: Commit**

```bash
git add "app/(home)/(user)/(tabs)/MyListings.tsx"
git commit -m "refactor(my-listings): remove small overlay view/like pills from vehicle card"
```

---

### Task 2: Add the Stats Banner between image and specs

**Files:**
- Modify: `app/(home)/(user)/(tabs)/MyListings.tsx` (inside `ListingCard`, between closing `</View>` of image block and `<View className='px-5 py-4'>` specs row)

- [ ] **Step 1: Insert the StatsBar View**

Locate the closing `</View>` of the image/overlay block (the `<View className='relative'>` wrapper ends here) and the `<View className='px-5 py-4'>` that opens the specs row. Insert the following between them:

```tsx
{/* Stats Banner */}
<View
    style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(213, 80, 4, 0.12)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(213, 80, 4, 0.25)',
        paddingVertical: 14,
        paddingHorizontal: 20,
    }}>
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
        <Text style={{ color: '#D55004', fontSize: 26, fontWeight: '800', lineHeight: 28 }}>
            {(item.views || 0).toLocaleString()}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <FontAwesome name='eye' size={12} color='#888888' />
            <Text style={{ color: '#888888', fontSize: 11, fontWeight: '500' }}>
                Views
            </Text>
        </View>
    </View>
    <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 }} />
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
        <Text style={{ color: '#D55004', fontSize: 26, fontWeight: '800', lineHeight: 28 }}>
            {(item.likes || 0).toLocaleString()}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <FontAwesome name='heart' size={12} color='#888888' />
            <Text style={{ color: '#888888', fontSize: 11, fontWeight: '500' }}>
                Likes
            </Text>
        </View>
    </View>
</View>
```

The surrounding structure should now read:

```tsx
{/* image block */}
<View className='relative'>
    {/* ... car image, overlay badges, overlay bottom ... */}
</View>

{/* Stats Banner ← NEW */}
<View style={{ flexDirection: 'row', ... }}>
    {/* views column | divider | likes column */}
</View>

{/* Specs row — unchanged */}
<View className='px-5 py-4'>
    <View className='flex-row justify-between'>
        <SpecItem ... />
        ...
    </View>
</View>
```

- [ ] **Step 2: Verify type-check**

```bash
npx tsc --noEmit app/(home)/\(user\)/\(tabs\)/MyListings.tsx 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(home)/(user)/(tabs)/MyListings.tsx"
git commit -m "feat(my-listings): add prominent stats banner (views/likes) to vehicle listing card"
```

---

### Task 3: Visual smoke-test

- [ ] **Step 1: Start the dev server and open on a device/simulator**

```bash
npm start
```

Open MyListings tab. Verify:
- Vehicle cards show the orange-tinted stats banner between photo and specs
- Views and likes display as large orange numbers with icon + label below
- Status badge still visible on the photo (top-left overlay)
- Specs row (Year, KM, Transmission, Condition) unchanged below the banner
- Plate listing cards are completely unchanged
- Dark mode and light mode both look correct (banner tint is semi-transparent so it adapts)

- [ ] **Step 2: Edge-case check**

Verify a listing with `views: 0` and `likes: 0` shows "0" cleanly (not blank).
Verify a listing with views > 999 shows with comma separator (e.g., "1,247").
