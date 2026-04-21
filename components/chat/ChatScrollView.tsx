import React, { forwardRef } from 'react';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ScrollViewProps } from 'react-native';
import type { KeyboardChatScrollViewProps } from 'react-native-keyboard-controller';

type Ref = React.ElementRef<typeof KeyboardChatScrollView>;

/**
 * Wrapper around KeyboardChatScrollView for use with FlatList's renderScrollComponent.
 * Handles keyboard-aware content repositioning (WhatsApp-style) in chat screens.
 *
 * Pass this to FlatList via renderScrollComponent to get:
 * - Messages push up when keyboard opens
 * - Smooth 60fps keyboard animations
 * - Proper safe-area offset handling
 */
const ChatScrollView = forwardRef<
  Ref,
  ScrollViewProps & KeyboardChatScrollViewProps
>((props, ref) => {
  const { bottom } = useSafeAreaInsets();

  return (
    <KeyboardChatScrollView
      ref={ref}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="interactive"
      offset={bottom}
      {...props}
    />
  );
});

ChatScrollView.displayName = 'ChatScrollView';

export default ChatScrollView;
