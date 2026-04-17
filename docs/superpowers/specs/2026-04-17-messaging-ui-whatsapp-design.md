# Messaging UI — WhatsApp-like Redesign

**Date:** 2026-04-17  
**Status:** Approved

## Problem

The in-app chat UI has three issues visible on Android:

1. The keyboard overlaps the input bar on Android — `KeyboardAvoidingView` has `behavior={undefined}` for Android, making it a no-op. The composer is hidden behind the keyboard.
2. The message bubbles are over-padded and spaced too loosely — feels airy and dated compared to WhatsApp.
3. The composer bar has a dark-blue (`#0F172A`) background that clashes with the `#0A0A0A` screen, and an unnecessary chevron-down keyboard dismiss button.

## Decisions

### Keyboard fix: `react-native-keyboard-controller`

Replace React Native's built-in `KeyboardAvoidingView` with the one from `react-native-keyboard-controller`.

- Install via `npx expo install react-native-keyboard-controller`
- Wrap the app root with `KeyboardProvider` in `app/_layout.tsx`
- Use `behavior="translate-with-padding"` — the library's recommended mode for chat apps
- No `Platform.OS` branching required — works identically on iOS and Android
- **Requires a new native build** (`npx expo prebuild` + rebuild the dev client or production build)

### Bubble density: WhatsApp-tight

| Property | Before | After |
|---|---|---|
| `paddingHorizontal` | 18 | 10 |
| `paddingVertical` | 14 | 7 |
| `marginBottom` (container) | 16 | 4 |
| `fontSize` | 16 | 14 |
| `lineHeight` | 22 | 20 |
| Timestamp `fontSize` | 12 | 11 |
| Timestamp `marginTop` | 6 | 3 |

### Composer: minimal clean

- Remove chevron-down keyboard dismiss button (was shown when keyboard visible — not a standard pattern)
- Background: `isDarkMode ? '#111111' : '#FFFFFF'` (was `#0F172A` / `#F9FAFB`)
- Vertical padding: 14 → 10
- Horizontal padding: 16 → 12

## Files to Change

| File | Change |
|---|---|
| `app/_layout.tsx` | Wrap provider chain with `KeyboardProvider` |
| `components/chat/MessageComposer.tsx` | Remove chevron-down, fix background + padding |
| `components/chat/MessageBubble.tsx` | Tighter bubble padding, spacing, font sizes |
| `app/(home)/(user)/conversations/[conversationId].tsx` | Swap `KeyboardAvoidingView` import + behavior |
| `app/(home)/(dealer)/conversations/[conversationId].tsx` | Same as above |

## Build Note

`react-native-keyboard-controller` includes native code. After installing:

```bash
npx expo install react-native-keyboard-controller
npx expo prebuild --clean
npm run android   # or ios
```

If using EAS: trigger a new `eas build` for the dev client. The JS-only changes (bubbles, composer) will hot-reload without a build — only the keyboard library requires one.
