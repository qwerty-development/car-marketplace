---
description: React Native + Expo SDK 54 frontend conventions
globs: ["app/**", "components/**", "hooks/**"]
---

# Frontend Rules

## Expo Router v6 (SDK 54)
- `useRouter()` and `useSegments()` return NEW refs every render — store in `useRef`, never use directly in `useEffect` deps
- Wrap `router.replace()` in `setTimeout(0)` to avoid nested update cascades on iOS Fabric
- Never use `<Redirect>` in layouts — return `null` and handle navigation in parent
- Defer heavy component mounting with `requestAnimationFrame` when providers are settling

## Context & State
- All context provider `value` props MUST use `useMemo`
- Functions in context MUST use `useCallback` or ref-based stable wrappers (see `fnsRef` pattern in AuthContext)
- Use TanStack React Query for server state — contexts only for client-side state (theme, language, auth)
- Query config: 24h stale time, no refetch on focus/mount — respect existing `queryClient.ts` settings

## Styling
- Use NativeWind `className` prop with Tailwind classes (not inline `style` objects)
- Brand accent: `#D55004` — use `bg-red` / `text-red` from tailwind config
- Dark mode: `dark:` prefix classes, `night` (#0D0D0D) background
- Import themed colors from `tailwind.config.js` theme when needed in JS

## Components
- Files prefixed with `_` (e.g., `_ProfileHeader.tsx`) are route-local, not reusable
- Large forms/modals go in separate component files in `components/`
- Use skeleton components (`Skeleton*.tsx`, `ShimmerPlaceholder`) for loading states
- Guard against dealer-only data in `(user)` components and vice versa

## i18n
- All user-visible text must use `t('key')` from `react-i18next`
- Translation keys in `locales/en.json` and `locales/ar.json`
- RTL support: language change triggers app reload via `I18nManager.forceRTL()`
- Use `context7` MCP to check react-i18next API when unsure
