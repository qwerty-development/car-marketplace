# Messaging UI — WhatsApp-like Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the chat UI to feel like WhatsApp — compact bubbles, clean composer bar, and a keyboard that reliably pushes the input up on Android.

**Architecture:** Install `react-native-keyboard-controller` to replace React Native's broken Android `KeyboardAvoidingView`, wrap the app root with its `KeyboardProvider`, then update the two conversation screens to use `behavior="translate-with-padding"`. Style changes to `MessageBubble` and `MessageComposer` are pure JS — they hot-reload without a rebuild.

**Tech Stack:** React Native 0.81, Expo SDK 54, `react-native-keyboard-controller`, `react-test-renderer` (jest-expo)

---

## File Map

| File | What changes |
|---|---|
| `app/_layout.tsx` | Add `KeyboardProvider` wrapper around `RootLayoutNav` |
| `components/chat/MessageComposer.tsx` | Remove chevron-down button, fix background, reduce padding |
| `components/chat/MessageBubble.tsx` | Tighter padding, spacing, and font sizes |
| `app/(home)/(user)/conversations/[conversationId].tsx` | Swap `KeyboardAvoidingView` import + behavior |
| `app/(home)/(dealer)/conversations/[conversationId].tsx` | Same as above |
| `components/chat/__tests__/MessageBubble.test.tsx` | New — snapshot tests |
| `components/chat/__tests__/MessageComposer.test.tsx` | New — snapshot tests |

---

## Task 1: Install `react-native-keyboard-controller` and prebuild

**Files:**
- No source files changed — install + native codegen only

- [ ] **Step 1: Install the package via Expo**

```bash
npx expo install react-native-keyboard-controller
```

Expected: package added to `package.json` dependencies, `node_modules/react-native-keyboard-controller` present.

- [ ] **Step 2: Prebuild to link the native module**

```bash
npx expo prebuild --clean
```

Expected: `android/` and `ios/` directories regenerated with the library linked. No errors in output.

- [ ] **Step 3: Commit the install**

```bash
git add package.json package-lock.json android/ ios/
git commit -m "feat: install react-native-keyboard-controller"
```

---

## Task 2: Wrap app root with `KeyboardProvider`

**Files:**
- Modify: `app/_layout.tsx` (around line 1607–1610)

- [ ] **Step 1: Add the import**

In `app/_layout.tsx`, add this import alongside the other provider imports (near the top of the file):

```tsx
import { KeyboardProvider } from 'react-native-keyboard-controller';
```

- [ ] **Step 2: Wrap `RootLayoutNav` with `KeyboardProvider`**

Find this block (around line 1607–1610):

```tsx
<FavoritesProvider>
  <NotificationsProvider />
  <RootLayoutNav />
  <Toast config={toastConfig} />
</FavoritesProvider>
```

Replace with:

```tsx
<FavoritesProvider>
  <NotificationsProvider />
  <KeyboardProvider>
    <RootLayoutNav />
  </KeyboardProvider>
  <Toast config={toastConfig} />
</FavoritesProvider>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero new errors introduced.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: add KeyboardProvider to root layout"
```

---

## Task 3: Update `MessageBubble` styles

**Files:**
- Modify: `components/chat/MessageBubble.tsx`
- Create: `components/chat/__tests__/MessageBubble.test.tsx`

- [ ] **Step 1: Write the snapshot test first**

Create `components/chat/__tests__/MessageBubble.test.tsx`:

```tsx
import React from 'react';
import renderer from 'react-test-renderer';
import MessageBubble from '../MessageBubble';
import { ChatMessage } from '@/types/chat';

const baseMessage: ChatMessage = {
  id: 1,
  conversation_id: 1,
  sender_id: 'user-abc',
  sender_role: 'user',
  body: 'Is the car still available?',
  media_url: null,
  is_read: false,
  read_at: null,
  created_at: '2024-01-01T12:00:00Z',
};

test('own message renders correctly', () => {
  const tree = renderer
    .create(<MessageBubble message={baseMessage} isOwn={true} isDarkMode={false} />)
    .toJSON();
  expect(tree).toMatchSnapshot();
});

test('received message renders correctly', () => {
  const tree = renderer
    .create(<MessageBubble message={baseMessage} isOwn={false} isDarkMode={true} />)
    .toJSON();
  expect(tree).toMatchSnapshot();
});
```

- [ ] **Step 2: Run test to confirm it fails (no snapshot yet)**

```bash
npm test -- --testPathPattern="MessageBubble" --watchAll=false
```

Expected: PASS with "1 snapshot written" on first run (snapshots are written fresh). This is fine — the test's job is to catch future regressions.

- [ ] **Step 3: Apply the style changes to `MessageBubble.tsx`**

In `components/chat/MessageBubble.tsx`, replace the `styles` block (lines 117–162) with:

```tsx
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 3,
  },
  time: {
    fontSize: 11,
    fontWeight: '400',
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  attachmentText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
```

- [ ] **Step 4: Delete the old snapshot and re-run to capture new one**

```bash
rm -rf components/chat/__tests__/__snapshots__
npm test -- --testPathPattern="MessageBubble" --watchAll=false
```

Expected: PASS, 2 snapshots written.

- [ ] **Step 5: Commit**

```bash
git add components/chat/MessageBubble.tsx components/chat/__tests__/MessageBubble.test.tsx components/chat/__tests__/__snapshots__/
git commit -m "feat: tighten MessageBubble padding and spacing to WhatsApp density"
```

---

## Task 4: Simplify `MessageComposer`

**Files:**
- Modify: `components/chat/MessageComposer.tsx`
- Create: `components/chat/__tests__/MessageComposer.test.tsx`

- [ ] **Step 1: Write the snapshot test first**

Create `components/chat/__tests__/MessageComposer.test.tsx`:

```tsx
import React from 'react';
import renderer from 'react-test-renderer';
import MessageComposer from '../MessageComposer';

test('renders idle state (no text)', () => {
  const tree = renderer
    .create(
      <MessageComposer
        onSend={jest.fn()}
        isDarkMode={false}
        placeholder="Type a message…"
      />
    )
    .toJSON();
  expect(tree).toMatchSnapshot();
});

test('renders dark mode', () => {
  const tree = renderer
    .create(
      <MessageComposer
        onSend={jest.fn()}
        isDarkMode={true}
        placeholder="Type a message…"
      />
    )
    .toJSON();
  expect(tree).toMatchSnapshot();
});
```

- [ ] **Step 2: Run test to write initial snapshots**

```bash
npm test -- --testPathPattern="MessageComposer" --watchAll=false
```

Expected: PASS, 2 snapshots written.

- [ ] **Step 3: Replace `MessageComposer.tsx` with the simplified version**

Replace the entire file content of `components/chat/MessageComposer.tsx` with:

```tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MessageComposerProps {
  onSend: (message: string) => Promise<void> | void;
  isSending?: boolean;
  isDarkMode?: boolean;
  placeholder?: string;
}

export default function MessageComposer({
  onSend,
  isSending = false,
  isDarkMode = false,
  placeholder = 'Type a message…',
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const { bottom } = useSafeAreaInsets();

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;
    setMessage('');
    onSend(trimmed);
  }, [message, onSend, isSending]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDarkMode ? '#111111' : '#FFFFFF',
          paddingBottom: 10 + bottom,
        },
      ]}
    >
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder={placeholder}
        placeholderTextColor={isDarkMode ? '#64748B' : '#9CA3AF'}
        multiline
        numberOfLines={1}
        maxLength={1000}
        style={[
          styles.input,
          {
            color: isDarkMode ? '#F8FAFC' : '#1F2937',
            backgroundColor: isDarkMode ? '#1C1C1C' : '#F3F4F6',
          },
        ]}
        blurOnSubmit={false}
        onSubmitEditing={handleSend}
        returnKeyType="send"
      />

      <TouchableOpacity
        style={[
          styles.sendButton,
          {
            backgroundColor: message.trim()
              ? '#D55004'
              : isDarkMode
              ? '#2A2A2A'
              : '#E2E8F0',
          },
        ]}
        onPress={handleSend}
        disabled={isSending || !message.trim()}
        activeOpacity={0.8}
      >
        {isSending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons
            name="paper-plane"
            size={18}
            color={message.trim() ? '#fff' : '#9CA3AF'}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
    textAlignVertical: 'center',
  },
  sendButton: {
    marginLeft: 8,
    height: 44,
    width: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

- [ ] **Step 4: Delete old snapshot and re-run to capture new one**

```bash
rm -rf components/chat/__tests__/__snapshots__
npm test -- --testPathPattern="MessageComposer" --watchAll=false
```

Expected: PASS, 2 snapshots written.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 6: Commit**

```bash
git add components/chat/MessageComposer.tsx components/chat/__tests__/MessageComposer.test.tsx components/chat/__tests__/__snapshots__/
git commit -m "feat: simplify MessageComposer — remove chevron-down, fix dark bg, tighten padding"
```

---

## Task 5: Fix keyboard avoidance in user conversation screen

**Files:**
- Modify: `app/(home)/(user)/conversations/[conversationId].tsx`

- [ ] **Step 1: Swap `KeyboardAvoidingView` import**

In `app/(home)/(user)/conversations/[conversationId].tsx`, find the `react-native` import block (lines 1–11):

```tsx
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
```

Replace with (remove `KeyboardAvoidingView` from react-native, keep `Platform` since it's used for `edges`):

```tsx
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
```

- [ ] **Step 2: Update the `KeyboardAvoidingView` behavior prop**

Find (around line 237–241):

```tsx
<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  keyboardVerticalOffset={headerHeight}
>
```

Replace with:

```tsx
<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior="translate-with-padding"
  keyboardVerticalOffset={headerHeight}
>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(home)/(user)/conversations/[conversationId].tsx"
git commit -m "feat: fix Android keyboard avoidance in user conversation screen"
```

---

## Task 6: Fix keyboard avoidance in dealer conversation screen

**Files:**
- Modify: `app/(home)/(dealer)/conversations/[conversationId].tsx`

- [ ] **Step 1: Swap `KeyboardAvoidingView` import**

In `app/(home)/(dealer)/conversations/[conversationId].tsx`, find the `react-native` import block (lines 1–11):

```tsx
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
```

Replace with:

```tsx
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
```

- [ ] **Step 2: Update the `KeyboardAvoidingView` behavior prop**

Find (around line 220–223):

```tsx
<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  keyboardVerticalOffset={headerHeight}
>
```

Replace with:

```tsx
<KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior="translate-with-padding"
  keyboardVerticalOffset={headerHeight}
>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(home)/(dealer)/conversations/[conversationId].tsx"
git commit -m "feat: fix Android keyboard avoidance in dealer conversation screen"
```

---

## Task 7: Run full test suite and verify

- [ ] **Step 1: Run all tests**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 2: Build and test on Android**

```bash
npm run android
```

Open a conversation, tap the input, and verify:
- Keyboard slides up and the input bar stays visible above it
- No jump or flash when keyboard opens
- Messages scroll normally

- [ ] **Step 3: Verify on iOS**

```bash
npm run ios
```

Same checks as Step 2 — behavior must be identical.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: WhatsApp-like messaging UI — compact bubbles, clean composer, keyboard fix"
```

---

## Build Note

Tasks 3–6 are **pure JS** — they work immediately in the running dev client via hot reload. Task 1–2 (the `react-native-keyboard-controller` install) require a native rebuild. Run `npm run android` or `npm run ios` after Task 2 to get a fresh build with the keyboard fix active.
