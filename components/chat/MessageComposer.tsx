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

  const hasText = message.trim().length > 0;

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
            backgroundColor: hasText
              ? '#D55004'
              : isDarkMode
              ? '#2A2A2A'
              : '#E2E8F0',
          },
        ]}
        onPress={handleSend}
        disabled={isSending || !hasText}
        activeOpacity={0.8}
      >
        {isSending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons
            name="paper-plane"
            size={18}
            color={hasText ? '#fff' : '#9CA3AF'}
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
