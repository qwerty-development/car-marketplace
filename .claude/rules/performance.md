---
description: React Native performance patterns for Fleet app
globs: ["app/**", "components/**", "hooks/**"]
---

# Performance Rules

## Re-render Prevention
- Memoize expensive computations with `useMemo`, component renders with `React.memo`
- Context values MUST use `useMemo` — a new object reference triggers all consumers to re-render
- Functions passed as props should be wrapped in `useCallback` or stored in `useRef`
- Never create objects/arrays inline in JSX props (e.g., `style={{ flex: 1 }}` — define outside)

## Lists
- Use `FlatList` (not `ScrollView`) for any list with 10+ items
- Always provide `keyExtractor` and stable `renderItem` callbacks
- Use `getItemLayout` for fixed-height items to skip measurement
- Set `removeClippedSubviews={true}` on long lists
- Use `windowSize` and `maxToRenderPerBatch` to control memory on large datasets

## Images
- Use `expo-image` (not `Image` from react-native) — it has built-in caching and WebP support
- Compress images before upload via `react-native-compressor` (see `utils/imageProcessor.ts`)
- Use appropriate `contentFit` instead of `resizeMode`
- Provide explicit `width` and `height` to avoid layout thrashing

## Network
- React Query is configured with 24h stale time — don't add refetchOnFocus/mount overrides
- Use `queryClient.prefetchQuery()` for predictable navigation targets (see `utils/smartPrefetch.ts`)
- Realtime subscriptions: always clean up in useEffect return function

## Bundle
- Use dynamic imports (`React.lazy`) for heavy screens not in the initial route
- Keep component files focused — split 1000+ line components into sub-components

## Tool Dispatch
- **react-performance-optimizer agent:** Dispatch for performance investigations — re-renders, jank, memory leaks, slow startup, large bundle
- **impeccable /optimize:** Verify loading speed, rendering, animations, images, bundle size on completed features
- **context7 MCP:** Verify React Native performance patterns and expo-image API against current docs before implementing optimizations
